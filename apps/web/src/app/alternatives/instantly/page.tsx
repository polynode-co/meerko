import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { instantlySources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "instantly pricing" (590/mo, KD 8) and "instantly alternative(s)" (140, KD 2) (DataForSEO, US, Oct 2026).
  title: "Open-source Instantly alternative & pricing (2026) | Meerko",
  description: "Instantly's plans and features next to Meerko, the open-source AI sales agent that runs inside Claude, ChatGPT or your coding agent. From Instantly's own pricing page.",
  alternates: { canonical: "/alternatives/instantly" },
};

// Every Instantly cell cites Instantly's pricing page, checked 5 Nov 2026 (Outreach and Instantly Credits tabs).
const instantly: Comparison = {
  slug: "instantly",
  name: "Instantly",
  pitch:
    "Instantly is built for sending cold email at volume. Meerko is an open-source AI sales agent that finds the leads, sends from your own Gmail or Outlook and handles the replies, from inside Claude, ChatGPT or your coding agent. Self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro)", them: "$47/mo (Growth)", source: instantlySources.pricing },
    { label: "Sending accounts", meerko: "Your own Gmail, Outlook or IMAP mailboxes", them: "Unlimited email accounts and warmup", source: instantlySources.pricing },
    { label: "Lead data", meerko: "Icypeas, or your own key on Pro", them: "Database of 450M+ B2B leads (credit plans)", source: instantlySources.pricing },
    { label: "Reply inbox", meerko: "Built in, with agent-drafted replies", them: "CRM with Unibox, from Hypergrowth", source: instantlySources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Growth", price: "$47/mo", detail: "Unlimited email accounts and warmup, 5,000 emails and 1,000 uploaded contacts a month." },
      { name: "Hypergrowth", price: "$107/mo", detail: "125,000 emails and 25,000 uploaded contacts a month, CRM with Unibox." },
      { name: "Light Speed", price: "$358/mo", detail: "500,000 emails and 100,000 uploaded contacts a month." },
      { name: "Enterprise", price: "Custom", detail: "More volume and a private deliverability network." },
    ],
    note: "Outreach plans, monthly billing, as listed on Instantly's pricing page. Leads are a separate subscription: Instantly Credits from $47/mo (1,500–2,000 credits and the 450M+ lead database).",
    source: instantlySources.pricing,
  },
  faq: [
    [
      "How much does Instantly cost?",
      "Instantly's pricing page lists outreach plans at $47/mo (Growth), $107/mo (Hypergrowth) and $358/mo (Light Speed) on monthly billing, plus Enterprise. Lead credits are a separate plan, from $47/mo.",
    ],
    [
      "Does Instantly include leads?",
      "Through a separate Instantly Credits plan, from $47/mo, which includes its database of 450M+ B2B leads. The outreach plans cover sending.",
    ],
    [
      "Is there an open-source alternative to Instantly?",
      "Meerko is open source under AGPL-3.0. It sends sequences from your own Gmail or Outlook, stops them when someone replies and keeps every lead in your own Postgres when self-hosted.",
    ],
  ],
  theyWin: [
    { text: "Unlimited email accounts with built-in warmup, for sending at volume.", source: instantlySources.pricing },
    { text: "A database of 450M+ B2B leads on its credit plans.", source: instantlySources.pricing },
  ],
};

export default function InstantlyAlternativePage() {
  return <ComparePage c={instantly} />;
}
