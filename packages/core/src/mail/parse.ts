import type { GmailMessage, GmailMessagePart } from "./gmail.ts";

export function header(msg: GmailMessage, name: string): string | undefined {
  const lower = name.toLowerCase();
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === lower)?.value;
}

/** "Pia Moll <Pia@slalom.example>" -> "pia@slalom.example" */
export function addressOf(value: string | undefined): string {
  if (!value) return "";
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1]! : value).trim().toLowerCase();
}

function findPart(part: GmailMessagePart | undefined, mimeType: string): GmailMessagePart | undefined {
  if (!part) return undefined;
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const found = findPart(p, mimeType);
    if (found) return found;
  }
  return undefined;
}

const decode = (data: string) => Buffer.from(data, "base64url").toString("utf8");

function htmlToText(html: string) {
  return html
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** The message's text, preferring text/plain over HTML. */
export function bodyText(msg: GmailMessage): string {
  const plain = findPart(msg.payload, "text/plain");
  if (plain?.body?.data) return decode(plain.body.data);
  const html = findPart(msg.payload, "text/html");
  if (html?.body?.data) return htmlToText(decode(html.body.data));
  return msg.snippet ?? "";
}

// "On Mon, 5 Oct 2026 at 10:30, Iker <iker@x.com> wrote:" and its Spanish/French/German/Portuguese/Italian forms.
const QUOTE_INTRO = /^\s*(On\b.+wrote:|El\b.+escribi[oó]:|Le\b.+a écrit\s?:|Am\b.+schrieb.+:|Em\b.+escreveu:|Il\b.+ha scritto:)\s*$/im;
const OUTLOOK_SEPARATOR = /^\s*(-{2,}\s*Original Message\s*-{2,}|_{10,}|From:\s.+|De:\s.+)$/im;

/** Just the new text of a reply: drops the quoted history and ">" lines. */
export function stripQuoted(text: string): string {
  let body = text.replace(/\r\n/g, "\n");
  for (const re of [QUOTE_INTRO, OUTLOOK_SEPARATOR]) {
    const m = body.match(re);
    if (m?.index !== undefined) body = body.slice(0, m.index);
  }
  return body
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n")
    .trim();
}
