import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { smartleadSources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "smartlead pricing" (210/mo, KD 7) and "smartlead alternative(s)" (30) (DataForSEO, US, Nov 2026).
  title: "Open-source Smartlead alternative & Smartlead pricing (2026) | Meerko",
  description:
    "Smartlead pricing and features next to Meerko, the open-source outbound engine for Claude, ChatGPT and coding agents: self-host it free or use Cloud from $49/mo.",
  alternates: { canonical: "/alternatives/smartlead" },
};

// Every Smartlead cell cites Smartlead's pricing page (its plan cards, comparison table and FAQ), checked 5 Nov 2026, Monthly tab.
const smartlead: Comparison = {
  slug: "smartlead",
  name: "Smartlead",
  pitch:
    "Smartlead is a cold email platform built for sending at volume, with unlimited email accounts on every plan. Meerko is an open-source outbound engine you run from Claude, ChatGPT or your coding agent: it finds and verifies emails, sends from your own mailboxes and drafts replies you approve. Self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro)", them: "$39/mo (Base: 2,000 contacts, 6,000 sends)", source: smartleadSources.pricing },
    { label: "Free to start", meerko: "Free plan: 200 credits once, 1 mailbox", them: "Free trial, no credit card", source: smartleadSources.pricing },
    { label: "Mailboxes", meerko: "Your own Gmail, Outlook or IMAP; unlimited on Pro", them: "Unlimited email accounts on every plan", source: smartleadSources.pricing },
    { label: "Lead data", meerko: "Found and verified emails, pay per result", them: "Verified prospect emails: $59/mo add-on on Base and Pro, included above", source: smartleadSources.pricing },
    { label: "API", meerko: "Every plan: MCP server, CLI and REST API", them: "API and webhooks from Pro", source: smartleadSources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Base", price: "$39/mo", detail: "2,000 contacts, 6,000 email sends and 2,000 verified prospect emails a month." },
      { name: "Pro", price: "$94/mo", detail: "30,000 contacts, 90,000 sends; adds CRM access, API and webhooks." },
      { name: "Unlimited Smart", price: "$174/mo", detail: "Unlimited contacts, 150,000 sends and 50,000 verified emails a month, call access." },
      { name: "Unlimited Prime", price: "$379/mo", detail: "500,000 sends, 170,000 verified emails, 3 SmartServers and a dedicated manager." },
    ],
    note: "Monthly billing as listed on Smartlead's pricing page. Annual billing saves 17% ($32, $78, $144 and $315 a month). Dedicated servers are $39/mo each and client workspaces $29/mo each, from Pro.",
    source: smartleadSources.pricing,
  },
  faq: [
    [
      "How much does Smartlead cost?",
      "Smartlead's pricing page lists Base at $39, Pro at $94, Unlimited Smart at $174 and Unlimited Prime at $379 a month on monthly billing. Annual billing saves 17%.",
    ],
    [
      "Does Smartlead charge per mailbox?",
      "No. Smartlead says every plan includes unlimited email accounts, with no per-mailbox or per-seat charge. Meerko's Pro plan also includes unlimited mailboxes.",
    ],
    [
      "Is there an open-source alternative to Smartlead?",
      "Meerko is open source under AGPL-3.0. Self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.",
    ],
  ],
  theyWin: [
    { text: "Built for volume: up to 500,000 sends a month, with sending rotated across every connected mailbox.", source: smartleadSources.pricing },
    { text: "Agency tooling: white-label client workspaces and dedicated sending servers.", source: smartleadSources.pricing },
  ],
};

export default function SmartleadAlternativePage() {
  return <ComparePage c={smartlead} />;
}
