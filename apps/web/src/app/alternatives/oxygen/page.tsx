import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { oxygenSources } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Open-source Oxygen alternative & Oxygen pricing (2026) | Meerko",
  description:
    "Oxygen pricing and features next to Meerko, the open-source outbound engine for Claude, ChatGPT and coding agents: same $49 entry price, no per-mailbox fees, your own keys on Pro, or self-host it free.",
  alternates: { canonical: "/alternatives/oxygen" },
};

// Every Oxygen cell cites Oxygen's pricing page (plan cards, the credit table and the FAQ), checked 10 Nov 2026.
const oxygen: Comparison = {
  slug: "oxygen",
  name: "Oxygen",
  pitch:
    "Oxygen is a credit-based GTM platform with tables, workflows, agents and sending across email, LinkedIn and WhatsApp. Meerko is an open-source outbound engine you run from Claude, ChatGPT or your coding agent: it finds and verifies emails, sends from your own mailboxes with no per-mailbox fee and drafts replies you approve. Self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro, 4,900 credits)", them: "$49/mo (4,900 credits)", source: oxygenSources.pricing },
    { label: "Email found", meerko: "5 credits; misses are free", them: "8.5 credits on average; charged only when found", source: oxygenSources.pricing },
    { label: "Your own mailbox", meerko: "No fee; unlimited on Pro", them: "$1 (100 credits) per mailbox a month", source: oxygenSources.pricing },
    { label: "Your own provider keys", meerko: "On Pro ($49), no credits charged", them: "On the $99 plan and above", source: oxygenSources.pricing },
    { label: "Extra credits", meerko: "$10 per 1,000", them: "$1.30 per 100 on demand", source: oxygenSources.pricing },
    { label: "Channels", meerko: "Email", them: "Email, plus LinkedIn and WhatsApp at $34/mo each", source: oxygenSources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Free", price: "$0", detail: "250 credits to get started. Connecting a mailbox or other sending account needs a paid plan." },
      { name: "Oxygen $49", price: "$49/mo", detail: "4,900 credits a month." },
      { name: "Oxygen $99", price: "$99/mo", detail: "9,900 credits a month; bring your own provider keys from this plan." },
      { name: "Oxygen $199+", price: "$199–$1,999/mo", detail: "19,900 to 229,885 credits a month, with bonus credits from $499." },
    ],
    note: "Monthly prices as listed on Oxygen's pricing page. Annual prices are $490, $990 and $1,990 for the first three paid plans, before tax. Sending accounts are paid in credits on top: $1/mo for your own mailbox, $4/mo for a managed inbox, $34/mo per LinkedIn account.",
    source: oxygenSources.pricing,
  },
  faq: [
    [
      "How much does Oxygen cost?",
      "Oxygen's pricing page lists a Free tier with 250 credits and paid plans at $49, $99, $199, $499, $999 and $1,999 a month, each buying credits at $1 per 100 (with bonus credits from $499). On-demand credits are $1.30 per 100.",
    ],
    [
      "Does Oxygen charge for mailboxes?",
      "Yes. Oxygen lists your own Google or Microsoft mailbox at $1 (100 credits) a month and a managed inbox at $4 a month. Meerko charges nothing per mailbox; Free has one and Pro has as many as you connect.",
    ],
    [
      "Can I use my own API keys?",
      "Oxygen says yes, on the $99 plan and above. On Meerko Cloud your own Icypeas key works on Pro ($49), with no credits charged; self-hosted, your own keys always work.",
    ],
    [
      "Is there an open-source alternative to Oxygen?",
      "Meerko is open source under AGPL-3.0. Self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.",
    ],
  ],
  theyWin: [
    { text: "More channels: LinkedIn, WhatsApp, X and phone, alongside email.", source: oxygenSources.pricing },
    { text: "Tables, workflows and web research agents in one product, with volume tiers up to $1,999/mo.", source: oxygenSources.pricing },
  ],
};

export default function OxygenAlternativePage() {
  return <ComparePage c={oxygen} />;
}
