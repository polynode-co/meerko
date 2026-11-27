// Gmail over IMAP and SMTP with an app password: no Gmail API scopes, so no Google verification or CASA
// Gmail's IMAP extensions keep it shaped like the API client: X-GM-RAW takes
// the same search syntax, and X-GM-MSGID / X-GM-THRID are the API's message and thread ids in decimal.
import type { FetchMessageObject } from "imapflow";
import type { InboundRef, MailClient, OutgoingRaw, SentIds } from "./client.ts";
import { GmailError, type GmailMessage } from "./gmail.ts";
import { defaultConnectors, guardMail, parseHeaders, toPayload, type ImapConnectors, type ImapSession, type SmtpTransport } from "./imap-common.ts";
import { addressOf } from "./parse.ts";

export interface GmailAccount {
  /** The address mail is sent from. */
  email: string;
  /** The Google account to sign in as: `email` itself, or the account it's an alias of. */
  login: string;
  password: string;
}

const SERVERS = {
  imap: { host: "imap.gmail.com", port: 993 },
  smtp: { host: "smtp.gmail.com", port: 465 },
};

/** Waits before looking for a just-sent message again. Gmail had it indexed within 2 s when tested. */
const LOOKUP_RETRY_MS = [1000, 2000, 4000];

const NO_IDS: SentIds = { id: null, threadId: null };

export class GmailImapClient implements MailClient {
  private session?: Promise<ImapSession>;
  /** The connection behind `session`, from before it finishes opening, so `abort` can drop one stuck opening. */
  private connection?: ImapSession;
  private transport?: SmtpTransport;
  /** UID in All Mail of each message id this client has seen, so getMessage needn't search for it. */
  private readonly uids = new Map<string, number>();

  constructor(
    private readonly account: GmailAccount,
    private readonly connect: ImapConnectors = defaultConnectors,
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

  /** Mail that arrived since `since`, not sent by this account. */
  listInbound(since: Date): Promise<InboundRef[]> {
    return this.listMessageIds(`after:${Math.floor(since.getTime() / 1000)} -from:me`);
  }

  async listMessageIds(q: string, max = 500) {
    const imap = await this.imap();
    await guard(() => imap.noop());
    const uids = (await guard(() => imap.search({ gmraw: q }, { uid: true }))) || [];
    // Newest first, like the API.
    const newest = uids.sort((a, b) => b - a).slice(0, max);
    if (!newest.length) return [];
    const out: { uid: number; id: string; threadId: string; from: string }[] = [];
    await guard(async () => {
      // The From header comes in the same FETCH, so the reply tick needn't fetch each message's headers on its own.
      for await (const msg of imap.fetch(newest, { uid: true, threadId: true, headers: ["from"] }, { uid: true })) {
        const ids = this.remember(msg);
        const from = addressOf(parseHeaders(msg.headers?.toString() ?? "").find((h) => h.name.toLowerCase() === "from")?.value);
        if (ids.id && ids.threadId) out.push({ uid: msg.uid, id: ids.id, threadId: ids.threadId, from });
      }
    });
    // FETCH answers in mailbox order, whatever order the UIDs were asked in.
    return out.sort((a, b) => b.uid - a.uid).map(({ id, threadId, from }) => ({ id, threadId, from }));
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
    this.connection = undefined;
    if (session) await (await session.catch(() => null))?.logout().catch(() => {});
    this.transport?.close();
    this.transport = undefined;
  }

  abort() {
    try {
      this.connection?.close();
    } catch {
      // Already closed.
    }
    this.session = this.connection = undefined;
    this.transport?.close();
    this.transport = undefined;
  }

  private smtp() {
    return (this.transport ??= this.connect.smtp({ user: this.account.login, pass: this.account.password }, SERVERS.smtp));
  }

  /** One IMAP session per client, with All Mail open read-only: every message is there, whatever its labels. */
  private imap() {
    this.session ??= (async () => {
      const imap = (this.connection = this.connect.imap({ user: this.account.login, pass: this.account.password }, SERVERS.imap));
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

/** A rejected password means the user must make a new app password and reconnect. */
const guard = <T>(fn: () => Promise<T>) =>
  guardMail(fn, { auth: "Gmail didn't accept the app password. Create a new one at myaccount.google.com/apppasswords and connect the mailbox again", other: "Gmail IMAP/SMTP" });
