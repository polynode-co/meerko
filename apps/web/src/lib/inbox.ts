import type { Draft, Reply } from "@meerko/sdk";

/** One lead's conversation: every reply in the same email thread, newest last. */
export interface Conversation {
  key: string;
  /** The newest reply: what the list shows, and what an answer goes to. */
  latest: Reply;
  replies: Reply[];
  /** A pending draft answering any reply in the conversation (the newest one wins). */
  draft?: Draft;
  /** Replies nobody has handled yet. */
  open: number;
}

/**
 * Groups replies into conversations. Every reply carries its whole thread, so the thread's first message
 * identifies the conversation; a reply with no thread is its own.
 */
export function conversations(replies: Reply[], drafts: Draft[]): Conversation[] {
  const byKey = new Map<string, Reply[]>();
  for (const r of replies) {
    const key = r.thread[0]?.id ?? r.id;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  return [...byKey.entries()]
    .map(([key, rs]) => {
      const sorted = [...rs].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
      const ids = new Set(sorted.map((r) => r.id));
      const draft = drafts.filter((d) => ids.has(d.replyId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      return { key, latest: sorted.at(-1)!, replies: sorted, draft, open: sorted.filter((r) => !r.handledAt).length };
    })
    .sort((a, b) => b.latest.receivedAt.localeCompare(a.latest.receivedAt));
}

/**
 * How many conversations wait on the person, from `listReplies({ needsYou: true })`. The sidebar badge, the Inbox
 * header and its tab, and the Overview's "Needs you" all show this one number.
 */
export function needYouCount(needsYouReplies: Reply[]): number {
  return conversations(needsYouReplies, []).filter((c) => c.open > 0).length;
}

// Where an email client starts quoting the previous message, in the languages Meerko's users write in.
const QUOTE_HEADERS = [
  /^On .+wrote:\s*$/i,
  /^El .+escribió:\s*$/i,
  /^Le .+a écrit\s*:\s*$/i,
  /^Am .+schrieb.*:\s*$/i,
  /^Il .+ha scritto:\s*$/i,
  /^Em .+escreveu:\s*$/i,
  /^Op .+schreef.*:\s*$/i,
  /^-{2,}\s*(Original Message|Mensaje original|Message d'origine|Ursprüngliche Nachricht)\s*-{2,}\s*$/i,
  /^_{5,}\s*$/,
  /^(From|De|Von):\s.+$/i,
];

// Where a signature starts: the "-- " delimiter (alone, or with the name on the same line) and mobile footers.
const SIGNATURES = [/^--(\s|$)/, /^(Sent from my|Enviado desde mi|Envoyé de mon|Von meinem|Inviato da)\b/i];

const isQuoteLine = (lines: string[], i: number) => {
  const line = lines[i].trim();
  const joined = `${line} ${lines[i + 1]?.trim() ?? ""}`.trim();
  return line.startsWith(">") || QUOTE_HEADERS.some((re) => re.test(line) || re.test(joined));
};
const isSignatureLine = (line: string) => SIGNATURES.some((re) => re.test(line.trim()));

/** Where what the person wrote ends: the first quote header, quoted line or signature. */
function writtenEnd(lines: string[]) {
  const cut = lines.findIndex((l, i) => isSignatureLine(l) || isQuoteLine(lines, i));
  return cut === -1 ? lines.length : cut;
}

/**
 * Splits an email body into what the person wrote and what follows: the quoted earlier message and the
 * signature ("-- " delimiter). Quote headers often wrap over two lines, so a header is matched on the
 * line joined with the next one too.
 */
export function splitQuoted(body: string): { text: string; quoted: string } {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const cut = writtenEnd(lines);
  const text = lines.slice(0, cut).join("\n").trim();
  // Never hide everything: if the cut leaves nothing, show the whole body.
  if (!text) return { text: body.trim(), quoted: "" };
  return { text, quoted: lines.slice(cut).join("\n").trim() };
}

/**
 * The line a conversation list shows for a reply: what the person wrote, without quoted history or signature.
 * When they wrote nothing above those, the first real line outside the quote (a signature line loses its "-- ").
 * Null when the body has no text at all, so the list never shows an empty quote.
 */
export function preview(body: string): string | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const written = lines.slice(0, writtenEnd(lines)).join("\n").trim();
  if (written) return written;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(">")) continue;
    // Under a quote header everything is the earlier message, quoted or not (HTML mail drops the ">").
    if (isQuoteLine(lines, i)) break;
    const line = lines[i].trim().replace(/^--\s*/, "").trim();
    if (line) return line;
  }
  return null;
}
