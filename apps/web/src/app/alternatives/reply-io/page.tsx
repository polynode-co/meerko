import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { replySources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "reply.io alternatives" (720/mo) (DataForSEO, US, Nov 2026).
  title: "Open-source Reply.io alternative & Reply.io pricing (2026) | Meerko",
  description:
    "Reply.io's plans and features next to Meerko, the open-source outbound engine that runs inside Claude, ChatGPT or your coding agent. From Reply's own pricing page.",
  alternates: { canonical: "/alternatives/reply-io" },
};

// Every Reply cell cites Reply's pricing page, checked 5 Nov 2026 with the toggle on Monthly
// (the page opens on Annually). Email Volume's price moves with its active-contacts slider; $59 is the slider's minimum.
const reply: Comparison = {
  slug: "reply-io",
  name: "Reply.io",
  pitch:
    "Reply.io is a sales engagement platform for email, LinkedIn, calls and SMS, with an AI SDR called Jason. Meerko is an open-source outbound engine you run from Claude, ChatGPT or your coding agent: it finds and verifies emails, sends from your own mailboxes and drafts replies you approve. Self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro)", them: "$59 per user/mo (Email Volume, 1,000 active contacts)", source: replySources.pricing },
    { label: "Mailboxes", meerko: "Your own Gmail, Outlook or IMAP; unlimited on Pro", them: "Unlimited on Email Volume (fair usage), 5 on Multichannel", source: replySources.pricing },
    { label: "Lead data", meerko: "Found and verified emails, pay per result", them: "50 live data credits a month", source: replySources.pricing },
    { label: "Channels", meerko: "Email", them: "Email; LinkedIn, calls and SMS on Multichannel or as add-ons", source: replySources.pricing },
    { label: "AI replies", meerko: "Your own assistant drafts them, you approve", them: "Jason AI SDR, from $500/mo", source: replySources.pricing },
    { label: "API", meerko: "Every plan: MCP server, CLI and REST API", them: "API and integrations; an enhanced API for teams of 20+", source: replySources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Email Volume", price: "$59/mo", detail: "Per user, for 1,000 active contacts a month; unlimited emails and mailboxes. Higher contact tiers cost more." },
      { name: "Multichannel", price: "$99/mo", detail: "Per user: email (5 mailboxes), LinkedIn, calls and SMS, and WhatsApp semi-automation." },
      { name: "Jason AI SDR", price: "$500/mo", detail: "Starting price: contact search, intent signals, AI personalization and AI-generated responses." },
    ],
    note: "Monthly billing as listed on Reply's pricing page. Billed annually, Email Volume starts at $49 and Multichannel at $89 per user a month (save up to 17%). On Email Volume, LinkedIn is a $69 and calls & SMS a $29 add-on per account a month.",
    source: replySources.pricing,
  },
  faq: [
    [
      "How much does Reply.io cost?",
      "On monthly billing, Reply's pricing page lists Email Volume from $59 per user a month (1,000 active contacts), Multichannel at $99 per user a month and the Jason AI SDR from $500 a month. Annual billing saves up to 17%.",
    ],
    [
      "Does Reply.io have a free trial?",
      "Yes. Reply's pricing page offers a 14-day free trial with its B2B database, multichannel sequences, reports, the API and integrations.",
    ],
    [
      "Is there an open-source alternative to Reply.io?",
      "Meerko is open source under AGPL-3.0. Self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits and runs from Claude, ChatGPT or your coding agent.",
    ],
  ],
  theyWin: [
    { text: "Multichannel: LinkedIn, calls, SMS and WhatsApp alongside email.", source: replySources.pricing },
    { text: "Direct CRM sync with Salesforce, HubSpot, Pipedrive, Copper and Close.", source: replySources.pricing },
  ],
};

export default function ReplyAlternativePage() {
  return <ComparePage c={reply} />;
}
