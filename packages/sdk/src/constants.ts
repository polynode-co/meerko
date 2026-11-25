// Browser-safe: no Node imports, so client components can use these (the client in index.ts reads ~/.meerko).

export const STAGES = ["new", "contacted", "replied", "meeting", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export const REPLY_INTENTS = ["interested", "not_interested", "not_now", "question", "referral", "wrong_person", "other"] as const;
export type ReplyIntent = (typeof REPLY_INTENTS)[number];

/**
 * Hosts that aren't a company's own site (social networks, link-in-bio pages, app stores, marketplaces…). A copy of
 * core's list (packages/core/src/enrichment/icypeas.ts), which a core test keeps equal: the dashboard uses it to
 * show a lead's instagram.com "domain" as a profile link.
 */
export const PLATFORM_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "youtube.com", "youtu.be",
  "pinterest.com", "threads.net", "snapchat.com", "t.me", "wa.me", "whatsapp.com", "linktr.ee", "linktree.com", "beacons.ai",
  "bio.link", "lnk.bio", "campsite.bio", "etsy.com", "amazon.com", "ebay.com", "depop.com", "vinted.com", "shopify.com",
  "myshopify.com", "wixsite.com", "squarespace.com", "carrd.co", "wordpress.com", "blogspot.com", "medium.com", "substack.com",
  "github.io", "sites.google.com", "play.google.com", "apps.apple.com", "itunes.apple.com", "gmail.com", "yahoo.com",
  "hotmail.com", "outlook.com", "icloud.com", "calendly.com", "yelp.com", "tripadvisor.com", "booking.com", "airbnb.com",
  "eventbrite.com", "patreon.com", "spotify.com", "soundcloud.com", "behance.net", "dribbble.com", "google.com",
];

/** The host of a site value ("https://www.instagram.com/acme" → "instagram.com"). */
export const siteHost = (site: string) =>
  site.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]!.toLowerCase();

export const isPlatformHost = (host: string) => PLATFORM_HOSTS.some((p) => host === p || host.endsWith(`.${p}`));

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
