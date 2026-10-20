// Gmail over IMAP and SMTP with an app password: no Gmail API scopes, so no Google verification or CASA
// (docs/APP_PASSWORD_PLAN.md). Gmail's IMAP extensions keep it shaped like the API client: X-GM-RAW takes
// the same search syntax, and X-GM-MSGID / X-GM-THRID are the API's message and thread ids in decimal.
import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import type { MailClient, OutgoingRaw, SentIds } from "./client.ts";
import { GmailError, type GmailMessage } from "./gmail.ts";

export interface GmailAccount {
  /** The address mail is sent from. */
  email: string;
  /** The Google account to sign in as: `email` itself, or the account it's an alias of. */
  login: string;
  password: string;
}

type ImapSession = Pick<ImapFlow, "connect" | "logout" | "list" | "mailboxOpen" | "noop" | "search" | "fetch" | "fetchOne" | "capabilities" | "on">;

interface SmtpTransport {
  sendMail(mail: { envelope: { from: string; to: string[] }; raw: string }): Promise<unknown>;
  verify(): Promise<unknown>;
  close(): void;
}

/** Opens the IMAP and SMTP connections. Tests pass fakes. */
export interface ImapConnectors {
  imap(auth: { user: string; pass: string }): ImapSession;
  smtp(auth: { user: string; pass: string }): SmtpTransport;
  /** Waits between lookups of a just-sent message. */
  sleep?(ms: number): Promise<void>;
}

const connectors: ImapConnectors = {
  imap: (auth) => new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth, logger: false }),
  smtp: (auth) => nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth }),
};

/** Waits before looking for a just-sent message again. Gmail had it indexed within 2 s when tested. */
const LOOKUP_RETRY_MS = [1000, 2000, 4000];

const NO_IDS: SentIds = { id: null, threadId: null };

export class GmailImapClient implements MailClient {
  private session?: Promise<ImapSession>;
  private transport?: SmtpTransport;
  /** UID in All Mail of each message id this client has seen, so getMessage needn't search for it. */
  private readonly uids = new Map<string, number>();

  constructor(
    private readonly account: GmailAccount,
    private readonly connect: ImapConnectors = connectors,
  ) {}

  private sleep(ms: number) {
    return this.connect.sleep ? this.connect.sleep(ms) : new Promise((r) => setTimeout(r, ms));
  }

  /** Signs in to SMTP and IMAP, so a wrong password or a non-Gmail account fails before anything is saved. */
  async verify() {
    await guard(() => this.smtp().verify());
    await this.imap();
  }

  /** Sends over SMTP, then finds the sent copy for its Gmail ids. Gmail threads it by its headers. */
  async send(email: OutgoingRaw): Promise<SentIds> {
    await guard(() => this.smtp().sendMail({ envelope: { from: email.from, to: [email.to] }, raw: email.raw }));
    // The email is out: from here nothing may throw, or the caller would treat a sent email as failed.
    try {
      for (const wait of [0, ...LOOKUP_RETRY_MS]) {
        if (wait) await this.sleep(wait);
        const ids = await this.findByMessageId(email.messageId);
        if (ids.id) return ids;
      }
    } catch {
      // The reply tick looks it up again.
    }
    return NO_IDS;
  }

  async findByMessageId(rfcMessageId: string): Promise<SentIds> {
    const imap = await this.imap();
    // A session only sees mail that arrived after it opened the folder once it asks again.
    await guard(() => imap.noop());
    const uids = await guard(() => imap.search({ gmraw: `rfc822msgid:${rfcMessageId.replace(/^<|>$/g, "")}` }, { uid: true }));
    if (!uids || !uids.length) return NO_IDS;
    const msg = await guard(() => imap.fetchOne(String(uids[0]), { uid: true, threadId: true }, { uid: true }));
    return msg ? this.remember(msg) : NO_IDS;
  }

  async listMessageIds(q: string, max = 500) {
    const imap = await this.imap();
    await guard(() => imap.noop());
    const uids = (await guard(() => imap.search({ gmraw: q }, { uid: true }))) || [];
    // Newest first, like the API.
    const newest = uids.sort((a, b) => b - a).slice(0, max);
    if (!newest.length) return [];
    const out: { uid: number; id: string; threadId: string }[] = [];
    await guard(async () => {
      for await (const msg of imap.fetch(newest, { uid: true, threadId: true }, { uid: true })) {
        const ids = this.remember(msg);
        if (ids.id && ids.threadId) out.push({ uid: msg.uid, id: ids.id, threadId: ids.threadId });
      }
    });
    // FETCH answers in mailbox order, whatever order the UIDs were asked in.
    return out.sort((a, b) => b.uid - a.uid).map(({ id, threadId }) => ({ id, threadId }));
  }

  async getMessage(id: string, format: "full" | "metadata" = "full", metadataHeaders: string[] = []): Promise<GmailMessage> {
    const imap = await this.imap();
    const uid = this.uids.get(id) ?? (await this.uidOf(imap, id));
    const query = { uid: true, threadId: true, internalDate: true };
    // The folder is open read-only, so fetching never marks a message read.
    const msg = await guard(() =>
      imap.fetchOne(String(uid), format === "metadata" ? { ...query, headers: metadataHeaders.length ? metadataHeaders : true } : { ...query, source: true }, { uid: true }),
    );
    if (!msg) throw new GmailError(`Gmail message ${id} not found`, 404);
    const base = { id, threadId: hex(msg.threadId!), internalDate: msg.internalDate ? String(new Date(msg.internalDate).getTime()) : undefined };
    if (format === "metadata") return { ...base, payload: { headers: parseHeaders(msg.headers?.toString() ?? "") } };
    return { ...base, ...(await toPayload(msg.source!)) };
  }

  async close() {
    const session = this.session;
    this.session = undefined;
    if (session) await (await session.catch(() => null))?.logout().catch(() => {});
    this.transport?.close();
    this.transport = undefined;
  }

  private smtp() {
    return (this.transport ??= this.connect.smtp({ user: this.account.login, pass: this.account.password }));
  }

  /** One IMAP session per client, with All Mail open read-only: every message is there, whatever its labels. */
  private imap() {
    this.session ??= (async () => {
      const imap = this.connect.imap({ user: this.account.login, pass: this.account.password });
      // ImapFlow emits connection errors as events; the next command reports them.
      imap.on("error", () => {});
      await guard(() => imap.connect());
      if (!imap.capabilities.has("X-GM-EXT-1")) throw new GmailError(`${this.account.login} isn't a Gmail or Google Workspace account`, undefined, true);
      const all = (await guard(() => imap.list())).find((f) => f.specialUse === "\\All");
      if (!all) throw new GmailError('Gmail hides "All Mail" from IMAP for this account. Turn on "Show in IMAP" for it in Gmail settings, Labels', undefined, true);
      await guard(() => imap.mailboxOpen(all.path, { readOnly: true }));
      return imap;
    })();
    // Don't keep a session that failed to open.
    this.session.catch(() => (this.session = undefined));
    return this.session;
  }

  private async uidOf(imap: ImapSession, id: string) {
    const uids = await guard(() => imap.search({ emailId: BigInt(`0x${id}`).toString() }, { uid: true }));
    if (!uids || !uids.length) throw new GmailError(`Gmail message ${id} not found`, 404);
    return uids[0]!;
  }

  private remember(msg: FetchMessageObject): SentIds {
    if (!msg.emailId || !msg.threadId) return NO_IDS;
    const id = hex(msg.emailId);
    this.uids.set(id, msg.uid);
    return { id, threadId: hex(msg.threadId) };
  }
}

/** X-GM-MSGID / X-GM-THRID are decimal; the API (and what's stored) uses hex. */
const hex = (decimal: string) => BigInt(decimal).toString(16);

/** Maps IMAP and SMTP failures to GmailError; a rejected password means the user must reconnect. */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GmailError) throw err;
    const e = err as { authenticationFailed?: boolean; code?: string; responseCode?: number; message?: string };
    if (e.authenticationFailed || e.code === "EAUTH") {
      throw new GmailError("Gmail didn't accept the app password. Create a new one at myaccount.google.com/apppasswords and connect the mailbox again", e.responseCode, true);
    }
    throw new GmailError(`Gmail IMAP/SMTP: ${e.message ?? String(err)}`, e.responseCode);
  }
}

/** Header lines, unfolded, with RFC 2047 encoded words decoded (the API returns them decoded too). */
export function parseHeaders(block: string): { name: string; value: string }[] {
  return block
    .replace(/\r?\n[ \t]+/g, " ")
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf(":");
      return i > 0 ? { name: line.slice(0, i).trim(), value: decodeWords(line.slice(i + 1).trim()) } : null;
    })
    .filter((h): h is { name: string; value: string } => h !== null);
}

/** "=?UTF-8?B?w4lsw6g=?=" -> "Élè". */
export function decodeWords(value: string): string {
  return value.replace(/(\?=)\s+(?==\?)/g, "$1").replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (word, charset: string, enc: string, text: string) => {
    const bytes =
      enc.toUpperCase() === "B"
        ? Buffer.from(text, "base64")
        : Buffer.from(text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1");
    try {
      return new TextDecoder(charset.split("*")[0]).decode(bytes);
    } catch {
      return word;
    }
  });
}

/** The parts of a message that parse.ts reads: headers, and the text and HTML bodies (decoded by mailparser). */
async function toPayload(source: Buffer): Promise<Pick<GmailMessage, "payload" | "snippet">> {
  const raw = source.toString("utf8");
  const end = raw.search(/\r?\n\r?\n/);
  const headers = parseHeaders(end < 0 ? raw : raw.slice(0, end));
  const parsed = await simpleParser(source);
  const encode = (s: string) => ({ data: Buffer.from(s).toString("base64url") });
  const parts = [
    ...(parsed.text ? [{ mimeType: "text/plain", body: encode(parsed.text) }] : []),
    ...(typeof parsed.html === "string" ? [{ mimeType: "text/html", body: encode(parsed.html) }] : []),
  ];
  return { snippet: (parsed.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200), payload: { mimeType: "multipart/alternative", headers, parts } };
}
