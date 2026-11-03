// Browser-safe: no Node imports, so client components can use these (the client in index.ts reads ~/.meerko).

export const STAGES = ["new", "contacted", "replied", "meeting", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const REPLY_INTENTS = ["interested", "not_interested", "not_now", "question", "referral", "wrong_person", "other"] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

/**
 * Mail providers Meerko connects to, and their servers. `gmail` uses connectGmailAppPassword, `outlook` signs in
 * with Microsoft (connectOutlook, no password), `other` takes the servers the user gives.
 */
export type MailProviderId = "gmail" | "outlook" | "zoho" | "zoho-eu" | "fastmail" | "other";
export const MAIL_PROVIDERS: Record<MailProviderId, { name: string; servers?: MailServers }> = {
  gmail: { name: "Gmail / Google Workspace" },
  outlook: { name: "Outlook / Microsoft 365" },
  zoho: { name: "Zoho Mail", servers: { imap: { host: "imappro.zoho.com", port: 993 }, smtp: { host: "smtppro.zoho.com", port: 465 } } },
  "zoho-eu": { name: "Zoho Mail (EU)", servers: { imap: { host: "imappro.zoho.eu", port: 993 }, smtp: { host: "smtppro.zoho.eu", port: 465 } } },
  fastmail: { name: "Fastmail", servers: { imap: { host: "imap.fastmail.com", port: 993 }, smtp: { host: "smtp.fastmail.com", port: 465 } } },
  other: { name: "Other (IMAP/SMTP)" },
};

export interface MailServers {
  imap: { host: string; port: number };
  smtp: { host: string; port: number };
}
