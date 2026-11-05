// OAuth 2.1 authorization server for remote MCP clients (Claude Code, Cursor, Codex…) and the CLI, as the
// MCP authorization spec describes: dynamic client registration (RFC 7591), the authorization code flow
// with PKCE (S256 only), and short-lived access tokens with a rotating refresh token.
// The person approves an app on the dashboard's consent page; the app then acts on that workspace.
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, lte, memberships, oauthClients, oauthCodes, oauthGrants, sql, users, workspaces, type Db } from "@meerko/db";
import type { SecretBox } from "./provider-keys.ts";

const ACCESS_PREFIX = "mo_";
const REFRESH_PREFIX = "mr_";
const CODE_PREFIX = "mx_";
const ACCESS_TTL_MS = 60 * 60_000;
const REFRESH_TTL_MS = 60 * 24 * 60 * 60_000;
const CODE_TTL_MS = 10 * 60_000;
/** How long the consent page has to approve a request. */
const REQUEST_TTL_MS = 15 * 60_000;
const TOUCH_EVERY_MS = 60 * 60_000;
const UNUSED_CLIENT_TTL_MS = 24 * 60 * 60_000;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const token = (prefix: string) => prefix + randomBytes(32).toString("base64url");
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** An OAuth error response: `error` is the RFC 6749 code, the message its description. */
export class OAuthError extends Error {
  constructor(
    public error: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type" | "invalid_redirect_uri" | "invalid_client_metadata",
    message: string,
  ) {
    super(message);
  }
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "about:", "blob:"]);

/** https, http on loopback (native apps and CLIs), or an app's own scheme (e.g. cursor://). No fragments. */
export function isValidRedirectUri(uri: string) {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || BLOCKED_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname);
  return true;
}

/** Exact match, except that loopback redirects may use any port (RFC 8252 §7.3). */
function redirectUriMatches(registered: string[], given: string) {
  if (registered.includes(given)) return true;
  let g: URL;
  try {
    g = new URL(given);
  } catch {
    return false;
  }
  if (g.protocol !== "http:" || !LOOPBACK.has(g.hostname)) return false;
  return registered.some((r) => {
    const u = new URL(r);
    return u.protocol === "http:" && u.hostname === g.hostname && u.pathname === g.pathname && u.search === g.search;
  });
}

export async function registerOAuthClient(db: Db, input: { name?: string; redirectUris: string[] }) {
  if (input.redirectUris.length === 0 || input.redirectUris.length > 10) throw new OAuthError("invalid_redirect_uri", "Give 1 to 10 redirect_uris");
  const bad = input.redirectUris.find((u) => !isValidRedirectUri(u));
  if (bad) throw new OAuthError("invalid_redirect_uri", `Redirect URI not allowed: ${bad}`);
  const name = (input.name?.trim() || "MCP client").slice(0, 100);
  // Some clients register again on every reconnect; drop registrations that never got access.
  await db
    .delete(oauthClients)
    .where(and(lte(oauthClients.createdAt, new Date(Date.now() - UNUSED_CLIENT_TTL_MS)), sql`not exists (select 1 from ${oauthGrants} where ${oauthGrants.clientId} = ${oauthClients.id})`));
  const [client] = await db.insert(oauthClients).values({ name, redirectUris: input.redirectUris }).returning();
  return client!;
}

export async function getOAuthClient(db: Db, clientId: string) {
  if (!isUuid(clientId)) return null;
  const [client] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId));
  return client ?? null;
}

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
}

/**
 * Checks an /authorize request and seals it for the consent page. Errors before the redirect URI is
 * known to be the client's are thrown (shown to the person), never redirected (RFC 6749 §4.1.2.1).
 */
export async function startAuthorization(db: Db, box: SecretBox, q: Record<string, string | undefined>) {
  const client = q.client_id ? await getOAuthClient(db, q.client_id) : null;
  if (!client) throw new OAuthError("invalid_client", "Unknown client_id. Remove the server from your app and add it again.");
  if (!q.redirect_uri || !redirectUriMatches(client.redirectUris, q.redirect_uri)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uri isn't one this client registered.");
  }
  const toClient = (error: string, description: string) => errorRedirect(q.redirect_uri!, error, description, q.state);
  if (q.response_type !== "code") return { redirect: toClient("unsupported_response_type", "Only response_type=code is supported") };
  if (!q.code_challenge || q.code_challenge_method !== "S256") {
    return { redirect: toClient("invalid_request", "PKCE is required: send code_challenge with code_challenge_method=S256") };
  }
  const request: AuthorizationRequest & { exp: number } = {
    clientId: client.id,
    redirectUri: q.redirect_uri,
    codeChallenge: q.code_challenge,
    state: q.state,
    exp: Date.now() + REQUEST_TTL_MS,
  };
  return { request: Buffer.from(box.encrypt(JSON.stringify(request)), "base64").toString("base64url") };
}

function openRequest(box: SecretBox, sealed: string): AuthorizationRequest {
  let req: (AuthorizationRequest & { exp?: number }) | null = null;
  try {
    req = JSON.parse(box.decrypt(Buffer.from(sealed, "base64url").toString("base64")));
  } catch {}
  if (!req?.exp || req.exp < Date.now()) throw new OAuthError("invalid_request", "This approval link expired. Start connecting again from your app.");
  return req;
}

function errorRedirect(redirectUri: string, error: string, description: string, state?: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

/** What the consent page shows: which app is asking, and where it'll send you back. */
export async function describeAuthorization(db: Db, box: SecretBox, sealed: string) {
  const req = openRequest(box, sealed);
  const client = await getOAuthClient(db, req.clientId);
  if (!client) throw new OAuthError("invalid_client", "This app is no longer registered. Start connecting again from your app.");
  const target = new URL(req.redirectUri);
  return { clientName: client.name, redirectTo: target.protocol === "http:" || target.protocol === "https:" ? target.host : target.protocol.replace(/:$/, "") };
}

/** The person said yes: issues a one-time code and returns where to send their browser. */
export async function approveAuthorization(db: Db, box: SecretBox, sealed: string, who: { userId: string; workspaceId: string }, issuer: string) {
  const req = openRequest(box, sealed);
  if (!(await getOAuthClient(db, req.clientId))) throw new OAuthError("invalid_client", "This app is no longer registered.");
  await db.delete(oauthCodes).where(lte(oauthCodes.expiresAt, new Date()));
  const code = token(CODE_PREFIX);
  await db.insert(oauthCodes).values({
    codeHash: hash(code),
    clientId: req.clientId,
    userId: who.userId,
    workspaceId: who.workspaceId,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  const url = new URL(req.redirectUri);
  url.searchParams.set("code", code);
  if (req.state) url.searchParams.set("state", req.state);
  url.searchParams.set("iss", issuer); // RFC 9207
  return url.toString();
}

/** The person said no. */
export function denyAuthorization(box: SecretBox, sealed: string) {
  const req = openRequest(box, sealed);
  return errorRedirect(req.redirectUri, "access_denied", "The request was declined", req.state);
}

async function issueTokens(db: Db, grant: { clientId: string; userId: string; workspaceId: string }, replaceId?: string) {
  const access = token(ACCESS_PREFIX);
  const refresh = token(REFRESH_PREFIX);
  const values = {
    accessHash: hash(access),
    accessExpiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    refreshHash: hash(refresh),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  };
  if (replaceId) await db.update(oauthGrants).set(values).where(eq(oauthGrants.id, replaceId));
  else await db.insert(oauthGrants).values({ ...grant, ...values });
  return { access_token: access, token_type: "Bearer" as const, expires_in: ACCESS_TTL_MS / 1000, refresh_token: refresh };
}

/** authorization_code grant: checks the code, the client, the redirect URI and the PKCE verifier. */
export async function exchangeOAuthCode(db: Db, input: { code?: string; clientId?: string; redirectUri?: string; codeVerifier?: string }) {
  if (!input.code || !input.clientId || !input.codeVerifier) throw new OAuthError("invalid_request", "code, client_id and code_verifier are required");
  if (!input.code.startsWith(CODE_PREFIX)) throw new OAuthError("invalid_grant", "Invalid authorization code");
  // Deleting first makes the code single-use even under concurrent requests.
  const [row] = await db.delete(oauthCodes).where(eq(oauthCodes.codeHash, hash(input.code))).returning();
  if (!row || row.expiresAt <= new Date()) throw new OAuthError("invalid_grant", "Invalid or expired authorization code");
  if (row.clientId !== input.clientId) throw new OAuthError("invalid_grant", "The code was issued to another client");
  if (input.redirectUri !== undefined && input.redirectUri !== row.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri doesn't match");
  const challenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
  if (challenge !== row.codeChallenge) throw new OAuthError("invalid_grant", "PKCE verification failed");
  // One grant per app install: reconnecting replaces the old one.
  await db
    .delete(oauthGrants)
    .where(and(eq(oauthGrants.clientId, row.clientId), eq(oauthGrants.userId, row.userId), eq(oauthGrants.workspaceId, row.workspaceId)));
  return issueTokens(db, row);
}

/** refresh_token grant. Each refresh token works once: the response carries its replacement. */
export async function refreshOAuthToken(db: Db, input: { refreshToken?: string; clientId?: string }) {
  if (!input.refreshToken?.startsWith(REFRESH_PREFIX)) throw new OAuthError("invalid_grant", "Invalid refresh token");
  const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.refreshHash, hash(input.refreshToken)));
  if (!grant || grant.refreshExpiresAt <= new Date()) throw new OAuthError("invalid_grant", "Invalid or expired refresh token");
  if (input.clientId && grant.clientId !== input.clientId) throw new OAuthError("invalid_grant", "The token was issued to another client");
  return issueTokens(db, grant, grant.id);
}

/** Resolves an access token to its workspace and person, or null if unknown, expired, or they left the workspace. */
export async function verifyAccessToken(db: Db, accessToken: string) {
  if (!accessToken.startsWith(ACCESS_PREFIX)) return null;
  const [row] = await db
    .select({
      grantId: oauthGrants.id,
      expiresAt: oauthGrants.accessExpiresAt,
      lastUsedAt: oauthGrants.lastUsedAt,
      userId: users.id,
      email: users.email,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      clientName: oauthClients.name,
    })
    .from(oauthGrants)
    .innerJoin(users, eq(oauthGrants.userId, users.id))
    .innerJoin(workspaces, eq(oauthGrants.workspaceId, workspaces.id))
    .innerJoin(oauthClients, eq(oauthGrants.clientId, oauthClients.id))
    .innerJoin(memberships, and(eq(memberships.userId, oauthGrants.userId), eq(memberships.workspaceId, oauthGrants.workspaceId)))
    .where(eq(oauthGrants.accessHash, hash(accessToken)));
  if (!row || row.expiresAt <= new Date()) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(oauthGrants).set({ lastUsedAt: new Date() }).where(eq(oauthGrants.id, row.grantId));
  }
  return row;
}

/** RFC 7009: revokes the grant behind an access or refresh token. Unknown tokens are not an error. */
export async function revokeOAuthToken(db: Db, anyToken: string) {
  const h = hash(anyToken);
  if (anyToken.startsWith(ACCESS_PREFIX)) await db.delete(oauthGrants).where(eq(oauthGrants.accessHash, h));
  else if (anyToken.startsWith(REFRESH_PREFIX)) await db.delete(oauthGrants).where(eq(oauthGrants.refreshHash, h));
}

/** Apps with access to the workspace, for Connections → Connected apps. */
export async function listConnectedApps(db: Db, workspaceId: string) {
  return db
    .select({ id: oauthGrants.id, name: oauthClients.name, userEmail: users.email, createdAt: oauthGrants.createdAt, lastUsedAt: oauthGrants.lastUsedAt })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthGrants.clientId, oauthClients.id))
    .innerJoin(users, eq(oauthGrants.userId, users.id))
    .where(eq(oauthGrants.workspaceId, workspaceId))
    .orderBy(desc(oauthGrants.createdAt));
}

export async function revokeConnectedApp(db: Db, workspaceId: string, grantId: string) {
  if (!isUuid(grantId)) return;
  await db.delete(oauthGrants).where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.workspaceId, workspaceId)));
}
