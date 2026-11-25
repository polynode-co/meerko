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

const unquoted = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim();

/** A signature starts at "-- " (or "--", or "-- Name" on one line). Only what the person wrote above it counts. */
const SIGNATURE = /^\s*--\s*($|\S.*$)/m;
const withoutSignature = (text: string) => {
  const m = text.match(SIGNATURE);
  return (m?.index !== undefined ? text.slice(0, m.index) : text).trim();
};

/**
 * Just the new text of a reply: drops the quoted history and ">" lines. A reply written under the quote
 * (bottom-posted) keeps the person's text: when nothing but a signature sits above the "On … wrote:" line,
 * the unquoted lines after it are what they wrote.
 */
export function stripQuoted(text: string): string {
  let body = text.replace(/\r\n/g, "\n");
  const intro = body.match(QUOTE_INTRO);
  if (intro?.index !== undefined) {
    const above = body.slice(0, intro.index);
    const below = unquoted(body.slice(intro.index + intro[0].length));
    body = !withoutSignature(unquoted(above)) && below ? below : above;
  }
  const outlook = body.match(OUTLOOK_SEPARATOR);
  if (outlook?.index !== undefined) body = body.slice(0, outlook.index);
  return unquoted(body);
}
