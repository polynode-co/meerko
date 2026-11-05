import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { instantlySources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "instantly pricing" (590/mo, KD 8) and "instantly alternative(s)" (140, KD 2) (DataForSEO, US, Oct 2026).
  title: "Open-source Instantly alternative & pricing (2026) | Meerko",
  description: "Instantly's plans and features next to Meerko, the open-source AI sales agent you run from Claude Code. From Instantly's own pricing page.",
  alternates: { canonical: "/alternatives/instantly" },
};

// Every Instantly cell cites Instantly's pricing page, checked 6 Oct 2026.
const instantly: Comparison = {
  slug: "instantly",
  name: "Instantly",
  pitch:
    "Instantly is built for sending cold email at volume. Meerko is an open-source AI sales agent that finds the leads, sends from your own Gmail or Outlook and handles the replies, driven from Claude Code. Self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro)", them: "$47/mo (Outreach Growth)", source: instantlySources.pricing },
    { label: "Sending accounts", meerko: "Your own Gmail, Outlook or IMAP mailboxes", them: "Unlimited email accounts and warmup", source: instantlySources.pricing },
    { label: "Lead data", meerko: "Icypeas, or your own key", them: "Database of 450M+ B2B leads", source: instantlySources.pricing },
    { label: "Reply inbox", meerko: "Built in, with agent-drafted replies", them: "Unibox and AI Reply Agent (Scale bundle)", source: instantlySources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Outreach Growth", price: "$47/mo", detail: "Unlimited email accounts and warmup, 5,000 emails and 1,000 uploaded contacts a month." },
      { name: "Starter bundle", price: "$94/mo", detail: "5,000 emails, 1,000 uploaded contacts and 1,500 Instantly credits a month." },
      { name: "Scale bundle", price: "$194/mo", detail: "100,000 emails and 25,000 uploaded contacts a month, AI Reply Agent and Unibox." },
      { name: "Agency bundle", price: "$555/mo", detail: "500,000 emails, 100,000 uploaded contacts and 10,000 Instantly credits a month." },
    ],
    note: "Monthly billing as listed on Instantly's pricing page; bundles are 10% cheaper on annual billing. Higher outreach-only plans are on Instantly's page.",
    source: instantlySources.pricing,
  },
  faq: [
    [
      "How much does Instantly cost?",
      "Instantly's pricing page lists the Outreach Growth plan at $47/mo, and bundles from $94/mo (Starter) to $555/mo (Agency) on monthly billing.",
    ],
    [
      "Does Instantly include leads?",
      "Instantly's credit plans include access to its database of 450M+ B2B leads; the outreach plans cover sending.",
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
