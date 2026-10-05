// Gmail over Google's REST endpoints with fetch, like the Icypeas client: no googleapis dependency.
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

/** The minimum for sending and detecting replies. Both are Google "restricted" scopes (verification + CASA for public use). */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];

export class GmailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** True when the refresh token is revoked or expired and the user must reconnect. */
    readonly needsReconnect = false,
  ) {
    super(message);
  }
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** `${MEERKO_PUBLIC_URL}/oauth/google/callback`; must be registered on the OAuth client. */
  redirectUri: string;
  fetch?: typeof fetch;
}

export class GoogleOAuth {
  private readonly fetch: typeof fetch;

  constructor(private readonly config: GoogleOAuthConfig) {
    this.fetch = config.fetch ?? globalThis.fetch;
  }

  authUrl(state: string, loginHint?: string) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      // offline + consent guarantees a refresh token even if the user connected before.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    if (loginHint) params.set("login_hint", loginHint);
    return `${AUTH_URL}?${params}`;
  }

  /** Exchanges the callback code for a refresh token and checks every scope was granted. */
  async exchangeCode(code: string) {
    const token = await this.token({ grant_type: "authorization_code", code, redirect_uri: this.config.redirectUri });
    if (!token.refresh_token) throw new GmailError("Google returned no refresh token; remove Meerko's access in your Google account and connect again");
    const granted = new Set(String(token.scope ?? "").split(" "));
    const missing = GMAIL_SCOPES.filter((s) => !granted.has(s));
    if (missing.length) throw new GmailError(`Permission not granted: ${missing.map((s) => s.split("/").pop()).join(", ")}. Tick every box on Google's consent screen.`);
    return { refreshToken: token.refresh_token as string, accessToken: token.access_token as string };
  }

  async refresh(refreshToken: string) {
    const token = await this.token({ grant_type: "refresh_token", refresh_token: refreshToken });
    return { accessToken: token.access_token as string, expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000 };
  }

  private async token(params: Record<string, string>) {
    const res = await this.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // invalid_grant = refresh token revoked/expired (7 days for apps in "testing" mode).
      const needsReconnect = json.error === "invalid_grant";
      throw new GmailError(`Google OAuth failed: ${json.error_description ?? json.error ?? res.status}`, res.status, needsReconnect);
    }
    return json;
  }
}

export interface GmailMessagePart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
}

export interface GmailSendResult {
  id: string;
  threadId: string;
}

/** Gmail API client for one mailbox. Refreshes and caches its access token. */
export class GmailClient {
  private accessToken?: { value: string; expiresAt: number };
  private readonly fetch: typeof fetch;

  constructor(
    private readonly oauth: GoogleOAuth,
    private readonly refreshToken: string,
    fetchImpl?: typeof fetch,
  ) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  profile() {
    return this.call<{ emailAddress: string }>("GET", "/profile");
  }

  /** Sends a raw RFC 822 message. Pass `threadId` to keep follow-ups in the sender's thread too. */
  send(raw: string, threadId?: string) {
    return this.call<GmailSendResult>("POST", "/messages/send", { raw: Buffer.from(raw).toString("base64url"), threadId });
  }

  /** Message ids matching a Gmail search query (e.g. `after:1759650000 -from:me`), following pages up to `max`. */
  async listMessageIds(q: string, max = 500) {
    const out: { id: string; threadId: string }[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q, maxResults: "100" });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await this.call<{ messages?: { id: string; threadId: string }[]; nextPageToken?: string }>("GET", `/messages?${params}`);
      out.push(...(page.messages ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken && out.length < max);
    return out.slice(0, max);
  }

  /** `metadata` returns only the requested headers (cheap); `full` includes the body. */
  getMessage(id: string, format: "full" | "metadata" = "full", metadataHeaders: string[] = []) {
    const params = new URLSearchParams({ format });
    for (const h of metadataHeaders) params.append("metadataHeaders", h);
    return this.call<GmailMessage>("GET", `/messages/${id}?${params}`);
  }

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > Date.now()) return this.accessToken.value;
    const { accessToken, expiresAt } = await this.oauth.refresh(this.refreshToken);
    this.accessToken = { value: accessToken, expiresAt };
    return accessToken;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetch(`${GMAIL_URL}${path}`, {
      method,
      headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) throw new GmailError(`Gmail API ${res.status}: ${json.error?.message ?? res.statusText}`, res.status, res.status === 401);
    return json as T;
  }
}
