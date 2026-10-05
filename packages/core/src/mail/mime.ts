import { randomBytes } from "node:crypto";

export interface OutgoingEmail {
  from: { email: string; name?: string | null };
  to: string;
  subject: string;
  text: string;
  /** Message-ID of the email being replied to, so follow-ups thread in the recipient's inbox. */
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

/** RFC 2047 encoded-word for non-ASCII header values (names, subjects with accents). */
function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatAddress({ email, name }: { email: string; name?: string | null }) {
  return name ? `${encodeHeader(name.replace(/["\\]/g, ""))} <${email}>` : email;
}

/** Builds a plain-text MIME message and returns it with its generated Message-ID. */
export function buildMime(msg: OutgoingEmail): { raw: string; messageId: string } {
  const domain = msg.from.email.split("@")[1] ?? "meerko.local";
  const messageId = `<${randomBytes(12).toString("hex")}@${domain}>`;
  const headers: [string, string][] = [
    ["From", formatAddress(msg.from)],
    ["To", msg.to],
    ["Subject", encodeHeader(msg.subject)],
    ["Message-ID", messageId],
    ["Date", new Date().toUTCString()],
    ["MIME-Version", "1.0"],
    ["Content-Type", 'text/plain; charset="UTF-8"'],
    ["Content-Transfer-Encoding", "base64"],
  ];
  if (msg.inReplyTo) headers.push(["In-Reply-To", msg.inReplyTo]);
  if (msg.references?.length) headers.push(["References", msg.references.join(" ")]);
  for (const [k, v] of Object.entries(msg.headers ?? {})) headers.push([k, v]);

  // Header values must never carry line breaks (header injection).
  const head = headers.map(([k, v]) => `${k}: ${v.replace(/[\r\n]+/g, " ")}`).join("\r\n");
  const body = Buffer.from(msg.text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return { raw: `${head}\r\n\r\n${body}`, messageId };
}
