// Browser-safe: no Node imports, so client components can use these (the client in index.ts reads ~/.meerko).

export const STAGES = ["new", "contacted", "replied", "meeting", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const REPLY_INTENTS = ["interested", "not_interested", "not_now", "question", "referral", "wrong_person", "other"] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];
