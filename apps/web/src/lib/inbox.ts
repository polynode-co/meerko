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

/**
 * Splits an email body into what the person wrote and what follows: the quoted earlier message and the
 * signature ("-- " delimiter). Quote headers often wrap over two lines, so a header is matched on the
 * line joined with the next one too.
 */
export function splitQuoted(body: string): { text: string; quoted: string } {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const joined = `${line} ${lines[i + 1]?.trim() ?? ""}`.trim();
    if (line === "--" || line === "-- " || line.startsWith(">") || QUOTE_HEADERS.some((re) => re.test(line) || re.test(joined))) {
      cut = i;
      break;
    }
  }
  const text = lines.slice(0, cut).join("\n").trim();
  // Never hide everything: if the cut leaves nothing, show the whole body.
  if (!text) return { text: body.trim(), quoted: "" };
  return { text, quoted: lines.slice(cut).join("\n").trim() };
}
