// Outlook and Microsoft 365 through Microsoft Graph, signed in with Microsoft (delegated Mail.Send and
// Mail.Read). Microsoft allows no password sign-in to its mailboxes, so this is the only way in. Like the
// generic IMAP client, a sent email's id and thread are Message-IDs, and replies are matched by the
// Message-IDs they reference.
import type { InboundRef, MailClient, OutgoingRaw, SentIds } from "./client.ts";
import { GmailError, type GmailMessage } from "./gmail.ts";
import { decodeWords, toPayload } from "./imap-common.ts";
import { messageIds, quotedMessageIds } from "./imap.ts";

const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_URL = "https://graph.microsoft.com/v1.0/me";

/** Sign-in, the address, a refresh token, and sending and reading mail. */
export const OUTLOOK_SCOPES = ["openid", "email", "offline_access", "User.Read", "Mail.Send", "Mail.Read"];

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** `${MEERKO_PUBLIC_URL}/oauth/microsoft/callback`; must be registered on the app. */
  redirectUri: string;
  fetch?: typeof fetch;
}

/** The Meerko app registered with Microsoft (any work, school or personal Microsoft account). */
export class MicrosoftOAuth {
  private readonly fetch: typeof fetch;

  constructor(private readonly config: MicrosoftOAuthConfig) {
    this.fetch = config.fetch ?? globalThis.fetch;
  }

  authUrl(state: string, loginHint?: string) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: OUTLOOK_SCOPES.join(" "),
      prompt: "select_account",
      state,
    });
    if (loginHint) params.set("login_hint", loginHint);
    return `${AUTH_URL}/authorize?${params}`;
  }

  /** Exchanges the callback code for a refresh token and checks both mail permissions were granted. */
  async exchangeCode(code: string) {
    const token = await this.token({ grant_type: "authorization_code", code, redirect_uri: this.config.redirectUri });
    if (!token.refresh_token) throw new GmailError("Microsoft returned no refresh token. Try connecting again.");
    const granted = String(token.scope ?? "").toLowerCase();
    const missing = ["Mail.Send", "Mail.Read"].filter((s) => !granted.includes(s.toLowerCase()));
    if (missing.length) throw new GmailError(`Permission not granted: ${missing.join(", ")}. Accept every permission Microsoft asks for.`);
    return { refreshToken: token.refresh_token as string, accessToken: token.access_token as string };
  }

  /** A new access token. Microsoft usually returns a new refresh token too; the caller should keep the latest. */
  async refresh(refreshToken: string) {
    const token = await this.token({ grant_type: "refresh_token", refresh_token: refreshToken, scope: OUTLOOK_SCOPES.join(" ") });
    return {
      accessToken: token.access_token as string,
      expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
      refreshToken: typeof token.refresh_token === "string" ? token.refresh_token : undefined,
    };
  }

  private async token(params: Record<string, string>) {
    const res = await this.fetch(`${AUTH_URL}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // A revoked or expired grant, or consent that was withdrawn: the user must connect again.
      const needsReconnect = json.error === "invalid_grant" || json.error === "interaction_required" || json.error === "consent_required";
      const reason = String(json.error_description ?? json.error ?? res.status).split("\r\n")[0];
      throw new GmailError(`Microsoft sign-in failed: ${reason}`, res.status, needsReconnect);
    }
    return json;
  }
}

interface GraphMessage {
  id: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  internetMessageHeaders?: { name: string; value: string }[];
}

const NO_MAILBOX =
  "This Microsoft account has no Outlook mailbox Meerko can use. Work accounts need a Microsoft 365 license with Exchange Online (Outlook); ask your admin, or connect an account that has one.";

/** Waits before looking for a just-sent message in Sent Items. */
const LOOKUP_RETRY_MS = [1000, 2000, 4000];

export class OutlookClient implements MailClient {
  private accessToken?: { value: string; expiresAt: number };
  private refreshToken: string;
  private readonly fetch: typeof fetch;
  /** Graph id, thread and headers of each message this client listed, so getMessage needn't search. */
  private readonly seen = new Map<string, { graphId: string; threadId: string; headers: { name: string; value: string }[]; receivedAt?: string }>();

  constructor(
    private readonly oauth: MicrosoftOAuth,
    refreshToken: string,
    private readonly opts: {
      /** The mailbox's address, to leave its own mail out of the inbox scan. */
      email?: string;
      fetch?: typeof fetch;
      /** Called with each new refresh token Microsoft issues; store it, or the mailbox stops working when the old one expires. */
      onRefreshToken?: (token: string) => Promise<void>;
      sleep?: (ms: number) => Promise<void>;
    } = {},
  ) {
    this.refreshToken = refreshToken;
    this.fetch = opts.fetch ?? globalThis.fetch;
  }

  /** The signed-in account's address. */
  async profile() {
    const me = await this.call<{ mail?: string | null; userPrincipalName?: string }>("GET", "?$select=mail,userPrincipalName");
    const email = (me.mail || me.userPrincipalName || "").toLowerCase();
    if (!email) throw new GmailError("Microsoft didn't return an email address for this account");
    return { emailAddress: email };
  }

  /**
   * Sends the MIME message as built (its headers, Message-ID included). Exchange saves a copy in Sent Items;
   * if it gave the email a different Message-ID, that copy says so, and the caller stores that one.
   */
  async send(email: OutgoingRaw, threadId?: string): Promise<SentIds> {
    await this.call("POST", "/sendMail", Buffer.from(email.raw).toString("base64"), "text/plain");
    // The email is out: from here nothing may throw, or the caller would treat a sent email as failed.
    let rfcMessageId = email.messageId;
    try {
      rfcMessageId = (await this.sentMessageId(email)) ?? email.messageId;
    } catch {
      // Keep Meerko's own Message-ID.
    }
    return {
      id: rfcMessageId,
      threadId: threadId ?? rfcMessageId,
      ...(rfcMessageId !== email.messageId ? { rfcMessageId } : {}),
    };
  }

  async listInbound(since: Date, max = 500): Promise<InboundRef[]> {
    const me = this.opts.email?.toLowerCase();
    const params = new URLSearchParams({
      $filter: `receivedDateTime ge ${since.toISOString()}`,
      $orderby: "receivedDateTime desc",
      $top: "50",
      $select: "id,internetMessageId,from,receivedDateTime,internetMessageHeaders",
    });
    const found: (InboundRef & { graphId: string; report: boolean; from: string })[] = [];
    let next: string | undefined = `/mailFolders/inbox/messages?${params}`;
    while (next && found.length < max) {
      const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await this.call("GET", next);
      for (const m of page.value) {
        if (me && m.from?.emailAddress?.address?.toLowerCase() === me) continue;
        const headers = (m.internetMessageHeaders ?? []).map((h) => ({ name: h.name, value: decodeWords(h.value) }));
        const get = (name: string) => headers.filter((h) => h.name.toLowerCase() === name).map((h) => h.value).join(" ");
        const id = m.internetMessageId ?? `<graph-${m.id}@outlook.invalid>`;
        const refs = messageIds(`${get("references")} ${get("in-reply-to")}`);
        const from = m.from?.emailAddress?.address?.trim().toLowerCase() ?? "";
        found.push({ id, threadId: refs[0] ?? id, refs, from, graphId: m.id, report: /multipart\/report/i.test(get("content-type")) });
        this.seen.set(id, { graphId: m.id, threadId: refs[0] ?? id, headers, receivedAt: m.receivedDateTime });
      }
      next = page["@odata.nextLink"];
    }
    // A bounce rarely references the email it's about, but quotes it: read its Message-ID from the body.
    for (const m of found.filter((f) => f.report && !f.refs!.length)) {
      const source = await this.call<string>("GET", `/messages/${m.graphId}/$value`, undefined, undefined, true);
      m.refs = quotedMessageIds(source).filter((r) => r !== m.id);
      m.threadId = m.refs[0] ?? m.id;
      this.seen.set(m.id, { ...this.seen.get(m.id)!, threadId: m.threadId });
    }
    return found.slice(0, max).map(({ id, threadId, refs, from }) => ({ id, threadId, refs, from }));
  }

  async getMessage(id: string, format: "full" | "metadata" = "full"): Promise<GmailMessage> {
    const known = this.seen.get(id) ?? (await this.lookup(id));
    const base = { id, threadId: known.threadId, internalDate: known.receivedAt ? String(Date.parse(known.receivedAt)) : undefined };
    if (format === "metadata") return { ...base, payload: { headers: known.headers } };
    const source = await this.call<string>("GET", `/messages/${known.graphId}/$value`, undefined, undefined, true);
    return { ...base, ...(await toPayload(Buffer.from(source))) };
  }

  /** Checks the account has a mailbox Meerko can use, so a connection can be refused up front. */
  async assertMailbox() {
    await this.call("GET", "/mailFolders/inbox?$select=id");
  }

  async close() {}

  private async profileLoads() {
    const res = await this.fetch(`${GRAPH_URL}?$select=id`, { headers: { authorization: `Bearer ${await this.token()}` } }).catch(() => null);
    return !!res?.ok;
  }

  /** Finds a message this client didn't list, by its Message-ID. */
  private async lookup(id: string) {
    const params = new URLSearchParams({ $filter: `internetMessageId eq '${id.replace(/'/g, "''")}'`, $select: "id,receivedDateTime,internetMessageHeaders" });
    const { value } = await this.call<{ value: GraphMessage[] }>("GET", `/messages?${params}`);
    const m = value[0];
    if (!m) throw new GmailError(`Message ${id} not found`, 404);
    const headers = (m.internetMessageHeaders ?? []).map((h) => ({ name: h.name, value: decodeWords(h.value) }));
    const refs = messageIds(headers.filter((h) => /^(references|in-reply-to)$/i.test(h.name)).map((h) => h.value).join(" "));
    return { graphId: m.id, threadId: refs[0] ?? id, headers, receivedAt: m.receivedDateTime };
  }

  /** The Message-ID of the sent copy: Meerko's own if Exchange kept it, otherwise the one it assigned. */
  private async sentMessageId(email: OutgoingRaw): Promise<string | undefined> {
    const subject = email.raw.match(/^Subject: (.*)$/m)?.[1]?.trim();
    for (const wait of [0, ...LOOKUP_RETRY_MS]) {
      if (wait) await (this.opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(wait);
      const byId = new URLSearchParams({ $filter: `internetMessageId eq '${email.messageId.replace(/'/g, "''")}'`, $select: "id" });
      const kept = await this.call<{ value: GraphMessage[] }>("GET", `/mailFolders/sentitems/messages?${byId}`);
      if (kept.value.length) return email.messageId;
      // Not under Meerko's Message-ID: the newest copy to this recipient with this subject is the one.
      const recent = new URLSearchParams({ $orderby: "sentDateTime desc", $top: "5", $select: "internetMessageId,subject,toRecipients,sentDateTime" });
      const { value } = await this.call<{ value: (GraphMessage & { subject?: string; toRecipients?: { emailAddress?: { address?: string } }[] })[] }>(
        "GET",
        `/mailFolders/sentitems/messages?${recent}`,
      );
      const match = value.find(
        (m) => m.subject === subject && m.toRecipients?.some((r) => r.emailAddress?.address?.toLowerCase() === email.to.toLowerCase()),
      );
      if (match?.internetMessageId) return match.internetMessageId;
    }
    return undefined;
  }

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt - 60_000 > Date.now()) return this.accessToken.value;
    const { accessToken, expiresAt, refreshToken } = await this.oauth.refresh(this.refreshToken);
    this.accessToken = { value: accessToken, expiresAt };
    if (refreshToken && refreshToken !== this.refreshToken) {
      this.refreshToken = refreshToken;
      await this.opts.onRefreshToken?.(refreshToken);
    }
    return accessToken;
  }

  private async call<T>(method: string, path: string, body?: string | object, contentType = "application/json", raw = false): Promise<T> {
    const url = path.startsWith("https://") ? path : `${GRAPH_URL}${path}`;
    const res = await this.fetch(url, {
      method,
      headers: { authorization: `Bearer ${await this.token()}`, ...(body === undefined ? {} : { "content-type": contentType }) },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    if (res.ok) {
      if (raw) return (await res.text()) as T;
      return (res.status === 202 || res.status === 204 ? {} : await res.json()) as T;
    }
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    const code = json.error?.code ?? "";
    if (res.status === 401) {
      // Graph answers a mail call for an account with no Exchange Online mailbox (no license) with a bare 401,
      // while the profile still loads: say that, since connecting again wouldn't help.
      if (path !== "" && !path.startsWith("?") && !code && (await this.profileLoads())) throw new GmailError(NO_MAILBOX, 401, true);
      throw new GmailError(`Microsoft rejected the sign-in (${code || 401}). Connect the mailbox again.`, 401, true);
    }
    // A Microsoft account without an Exchange Online mailbox (no license, or a consumer account without Outlook).
    if (code === "MailboxNotEnabledForRESTAPI" || code === "MailboxNotSupportedForRESTAPI") {
      throw new GmailError(NO_MAILBOX, res.status, true);
    }
    throw new GmailError(`Microsoft Graph ${res.status}: ${json.error?.message ?? res.statusText}`, res.status);
  }
}
