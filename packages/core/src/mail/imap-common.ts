// What the Gmail and generic IMAP/SMTP clients share: connections, error mapping and turning a raw message
// into the Gmail API's message shape, which parse.ts and the reply tick read.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { GmailError, type GmailMessage } from "./gmail.ts";

export type ImapSession = Pick<
  ImapFlow,
  "connect" | "logout" | "close" | "list" | "mailboxOpen" | "noop" | "search" | "fetch" | "fetchOne" | "append" | "capabilities" | "on"
>;

export interface SmtpTransport {
  sendMail(mail: { envelope: { from: string; to: string[] }; raw: string }): Promise<unknown>;
  verify(): Promise<unknown>;
  close(): void;
}

/** A mail server. `address` is the IP it resolved to, connected to directly so DNS can't change under a check. */
export interface MailServer {
  host: string;
  port: number;
  address?: string;
}

type Auth = { user: string; pass: string };

/** Opens the IMAP and SMTP connections. Tests pass fakes. */
export interface ImapConnectors {
  imap(auth: Auth, server: MailServer): ImapSession;
  smtp(auth: Auth, server: MailServer): SmtpTransport;
  /** Waits between lookups of a just-sent message. */
  sleep?(ms: number): Promise<void>;
  /** DNS lookup for user-given servers (tests). */
  resolve?(host: string): Promise<string[]>;
}

/**
 * IMAP timeouts, shorter than ImapFlow's defaults (90s to connect, 5 minutes of silence), which let one mail server
 * that stops answering hold a tick past its deadline. The reply scan's own limit per mailbox is shorter still.
 */
const IMAP_TIMEOUTS = { connectionTimeout: 30_000, greetingTimeout: 16_000, socketTimeout: 60_000 };

// TLS always: implicit on 993 and 465, STARTTLS (required) on 587. The certificate is checked against the host name.
export const defaultConnectors: ImapConnectors = {
  imap: (auth, server) =>
    new ImapFlow({ host: server.address ?? server.host, servername: server.host, port: server.port, secure: true, auth, logger: false, ...IMAP_TIMEOUTS }),
  smtp: (auth, server) =>
    nodemailer.createTransport({
      host: server.address ?? server.host,
      port: server.port,
      secure: server.port === 465,
      requireTLS: true,
      tls: { servername: server.host },
      auth,
    }),
};

/** Maps IMAP and SMTP failures to GmailError; a rejected password means the user must reconnect. */
export async function guardMail<T>(fn: () => Promise<T>, messages: { auth: string; other: string }): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GmailError) throw err;
    const e = err as { authenticationFailed?: boolean; code?: string; responseCode?: number; message?: string };
    if (e.authenticationFailed || e.code === "EAUTH") throw new GmailError(messages.auth, e.responseCode, true);
    throw new GmailError(`${messages.other}: ${e.message ?? String(err)}`, e.responseCode);
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
export async function toPayload(source: Buffer): Promise<Pick<GmailMessage, "payload" | "snippet">> {
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
