// Any mail provider over IMAP and SMTP (Zoho, Fastmail, a host's own mail server), signed in with a password
// or app password, like GmailImapClient but without Gmail's extensions. Message-IDs stand in for Gmail's ids:
// a sent email's id is its Message-ID and its thread is the conversation's first one, and replies are matched
// by the Message-IDs they reference (InboundRef.refs).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateAddress } from "../routines/http.ts";
import type { InboundRef, MailClient, OutgoingRaw, SentIds } from "./client.ts";
import { GmailError, type GmailMessage } from "./gmail.ts";
import { defaultConnectors, guardMail, parseHeaders, toPayload, type ImapConnectors, type ImapSession, type MailServer, type SmtpTransport } from "./imap-common.ts";

export interface MailServers {
  imap: { host: string; port: number };
  smtp: { host: string; port: number };
}

export interface ImapAccount {
  email: string;
  /** The user name to sign in with: usually the address itself. */
  login: string;
  password: string;
  servers: MailServers;
}

/** TLS only: IMAP on 993, SMTP on 465 (implicit TLS) or 587 (STARTTLS, required). */
export const MAIL_PORTS = { imap: [993], smtp: [465, 587] };

/** A newly sent email gets this long to show up in Sent on its own before Meerko saves a copy. */
const SENT_COPY_WAIT_MS = 2000;

const resolveHost = async (host: string) => (await lookup(host, { all: true })).map((a) => a.address);

/**
 * Checks a user-given server before connecting: a mail port, and a public address (never the cloud's own
 * network). Returns it pinned to the address it resolved to, so DNS can't change between check and connect.
 */
export async function resolveMailServer(server: { host: string; port: number }, kind: "imap" | "smtp", resolve = resolveHost): Promise<MailServer> {
  const host = server.host.trim().toLowerCase();
  if (!MAIL_PORTS[kind].includes(server.port)) {
    throw new GmailError(`${kind.toUpperCase()} port ${server.port} isn't supported: use ${MAIL_PORTS[kind].join(" or ")} (Meerko only connects over TLS)`, undefined, true);
  }
  if (!/^[a-z0-9.-]+$/.test(host) && !isIP(host)) throw new GmailError(`"${server.host}" isn't a server name`, undefined, true);
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    addresses = [];
  }
  if (!addresses.length) throw new GmailError(`Can't find the server ${host}`);
  if (addresses.some(isPrivateAddress)) throw new GmailError(`${host} isn't a public internet address`, undefined, true);
  return { host, port: server.port, address: addresses[0] };
}

export class ImapClient implements MailClient {
  private session?: Promise<ImapSession>;
  /** The connection behind `session`, from before it finishes opening, so `abort` can drop one stuck opening. */
  private connection?: ImapSession;
  private transport?: Promise<SmtpTransport>;
  private sentFolder?: string | null;
  /** INBOX UID and thread of each message this client listed, so getMessage needn't search. */
  private readonly seen = new Map<string, { uid: number; threadId: string }>();

  constructor(
    private readonly account: ImapAccount,
    private readonly connect: ImapConnectors = defaultConnectors,
  ) {}

  /** Signs in to SMTP and IMAP, so a wrong password or server fails before anything is saved. */
  async verify() {
    const smtp = await this.smtp();
    await this.guard(() => smtp.verify());
    await this.imap();
  }

  /** Sends over SMTP, and makes sure a copy lands in Sent, which most providers (unlike Gmail) leave to the client. */
  async send(email: OutgoingRaw, threadId?: string): Promise<SentIds> {
    const smtp = await this.smtp();
    await this.guard(() => smtp.sendMail({ envelope: { from: email.from, to: [email.to] }, raw: email.raw }));
    // The email is out: from here nothing may throw, or the caller would treat a sent email as failed.
    try {
      await this.keepSentCopy(email);
    } catch {
      // Only the copy in Sent is missing.
    }
    return { id: email.messageId, threadId: threadId ?? email.messageId };
  }

  async listInbound(since: Date, max = 500): Promise<InboundRef[]> {
    const imap = await this.select("INBOX");
    // SINCE matches whole days in the server's time zone: ask from the day before and filter exactly below.
    const uids = (await this.guard(() => imap.search({ since: new Date(since.getTime() - 24 * 60 * 60_000) }, { uid: true }))) || [];
    const newest = uids.sort((a, b) => b - a).slice(0, max);
    if (!newest.length) return [];

    const me = new Set([this.account.email, this.account.login].map((a) => a.toLowerCase()));
    const found: { uid: number; id: string; refs: string[]; report: boolean; from: string }[] = [];
    await this.guard(async () => {
      const query = { uid: true, internalDate: true, envelope: true, headers: ["message-id", "references", "in-reply-to", "content-type"] };
      for await (const msg of imap.fetch(newest, query, { uid: true })) {
        if (msg.internalDate && new Date(msg.internalDate).getTime() < since.getTime()) continue;
        const from = msg.envelope?.from?.[0]?.address?.toLowerCase();
        if (from && me.has(from)) continue;
        const headers = parseHeaders(msg.headers?.toString() ?? "");
        const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
        const id = get("message-id").match(/<[^>]+>/)?.[0] ?? `<uid-${msg.uid}@${this.account.servers.imap.host}>`;
        found.push({ uid: msg.uid, id, refs: messageIds(`${get("references")} ${get("in-reply-to")}`), report: /multipart\/report/i.test(get("content-type")), from: from ?? "" });
      }
    });
    // A bounce rarely references the email it's about, but quotes it: read its Message-ID from the body.
    for (const m of found.filter((f) => f.report && !f.refs.length)) {
      const msg = await this.guard(() => imap.fetchOne(String(m.uid), { uid: true, source: true }, { uid: true }));
      if (msg && msg.source) m.refs = quotedMessageIds(msg.source.toString("utf8")).filter((r) => r !== m.id);
    }
    return found
      .sort((a, b) => b.uid - a.uid)
      .map((m) => {
        const threadId = m.refs[0] ?? m.id;
        this.seen.set(m.id, { uid: m.uid, threadId });
        return { id: m.id, threadId, refs: m.refs, from: m.from };
      });
  }

  async getMessage(id: string, format: "full" | "metadata" = "full", metadataHeaders: string[] = []): Promise<GmailMessage> {
    const imap = await this.select("INBOX");
    const known = this.seen.get(id);
    const uid = known?.uid ?? (await this.uidOf(imap, id));
    const query = { uid: true, internalDate: true };
    // INBOX is open read-only, so fetching never marks a message read.
    const msg = await this.guard(() =>
      imap.fetchOne(
        String(uid),
        format === "metadata" ? { ...query, headers: [...metadataHeaders, "references", "in-reply-to"] } : { ...query, source: true },
        { uid: true },
      ),
    );
    if (!msg) throw new GmailError(`Message ${id} not found`, 404);
    const payload = format === "metadata" ? { payload: { headers: parseHeaders(msg.headers?.toString() ?? "") } } : await toPayload(msg.source!);
    const refs = messageIds(
      (payload.payload?.headers ?? [])
        .filter((h) => /^(references|in-reply-to)$/i.test(h.name))
        .map((h) => h.value)
        .join(" "),
    );
    return {
      id,
      threadId: known?.threadId ?? refs[0] ?? id,
      internalDate: msg.internalDate ? String(new Date(msg.internalDate).getTime()) : undefined,
      ...payload,
    };
  }

  async close() {
    const session = this.session;
    this.session = undefined;
    this.connection = undefined;
    if (session) await (await session.catch(() => null))?.logout().catch(() => {});
    const transport = this.transport;
    this.transport = undefined;
    (await transport?.catch(() => null))?.close();
  }

  abort() {
    try {
      this.connection?.close();
    } catch {
      // Already closed.
    }
    this.session = this.connection = undefined;
    const transport = this.transport;
    this.transport = undefined;
    void transport?.then((t) => t.close()).catch(() => {});
  }

  /** Waits for the provider to file the sent email; if it doesn't, appends it to Sent, marked read. */
  private async keepSentCopy(email: OutgoingRaw) {
    await this.imap();
    if (!this.sentFolder) return;
    await this.sleep(SENT_COPY_WAIT_MS);
    const imap = await this.select(this.sentFolder);
    const there = await this.guard(() => imap.search({ header: { "message-id": email.messageId } }, { uid: true }));
    if (there && there.length) return;
    await this.guard(() => imap.append(this.sentFolder!, email.raw, ["\\Seen"]));
  }

  private sleep(ms: number) {
    return this.connect.sleep ? this.connect.sleep(ms) : new Promise((r) => setTimeout(r, ms));
  }

  private guard<T>(fn: () => Promise<T>) {
    const { imap } = this.account.servers;
    return guardMail(fn, {
      auth: `${imap.host} didn't accept the password for ${this.account.login}. Check it (many providers want an app password) and connect the mailbox again`,
      other: `Mail server ${imap.host}`,
    });
  }

  private resolve(kind: "imap" | "smtp") {
    return resolveMailServer(this.account.servers[kind], kind, this.connect.resolve);
  }

  private smtp() {
    this.transport ??= this.resolve("smtp").then((server) => this.connect.smtp({ user: this.account.login, pass: this.account.password }, server));
    this.transport.catch(() => (this.transport = undefined));
    return this.transport;
  }

  private imap() {
    this.session ??= (async () => {
      const imap = (this.connection = this.connect.imap({ user: this.account.login, pass: this.account.password }, await this.resolve("imap")));
      // ImapFlow emits connection errors as events; the next command reports them.
      imap.on("error", () => {});
      await this.guard(() => imap.connect());
      this.sentFolder = (await this.guard(() => imap.list())).find((f) => f.specialUse === "\\Sent")?.path ?? null;
      return imap;
    })();
    // Don't keep a session that failed to open.
    this.session.catch(() => (this.session = undefined));
    return this.session;
  }

  /** Opens a folder read-only (re-opening INBOX also shows mail that arrived since). */
  private async select(path: string) {
    const imap = await this.imap();
    await this.guard(() => imap.mailboxOpen(path, { readOnly: true }));
    return imap;
  }

  private async uidOf(imap: ImapSession, id: string) {
    const uids = await this.guard(() => imap.search({ header: { "message-id": id } }, { uid: true }));
    if (!uids || !uids.length) throw new GmailError(`Message ${id} not found`, 404);
    return uids[0]!;
  }
}

/** The Message-ID headers quoted in a bounce (the original email's, among others). */
export function quotedMessageIds(source: string): string[] {
  return [...source.matchAll(/^Message-ID:\s*(<[^<>\s]+>)/gim)].map((m) => m[1]!);
}

/** Every `<…>` Message-ID in a References or In-Reply-To value, in order. */
export function messageIds(text: string): string[] {
  return [...new Set([...text.matchAll(/<[^<>\s@]+@[^<>\s]+>/g)].map((m) => m[0]))];
}
