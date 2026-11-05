import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { lemlistSources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "lemlist pricing" (260/mo, KD 15) and "lemlist alternative(s)" (70) (DataForSEO, US, Nov 2026).
  title: "Open-source lemlist alternative & lemlist pricing (2026) | Meerko",
  description:
    "lemlist pricing and features next to Meerko, the open-source outbound engine for Claude, ChatGPT and coding agents: self-host it free or use Cloud from $49/mo.",
  alternates: { canonical: "/alternatives/lemlist" },
};

// Every lemlist cell cites lemlist's pricing page, checked 5 Nov 2026 with the toggle on Monthly
// (the page opens on Yearly). The page localises currency; the USD figures are the ones it serves by default.
const lemlist: Comparison = {
  slug: "lemlist",
  name: "lemlist",
  pitch:
    "lemlist is a multichannel outreach platform with its own lead database. Meerko is an open-source outbound engine you run from Claude, ChatGPT or your coding agent: it finds and verifies emails, sends from your own mailboxes and drafts replies you approve. Self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro)", them: "$69/mo (Email, 50,000 emails a month)", source: lemlistSources.pricing },
    { label: "Users and senders", meerko: "Unlimited mailboxes on Pro", them: "Unlimited users and email senders on Email", source: lemlistSources.pricing },
    { label: "Lead data", meerko: "Icypeas, or your own key on Pro", them: "650M+ lead database; data add-on from $20/mo", source: lemlistSources.pricing },
    { label: "Channels", meerko: "Email", them: "LinkedIn, SMS and calling on Multichannel", source: lemlistSources.pricing },
    { label: "From an AI assistant", meerko: "Hosted MCP server, CLI and REST API on every plan", them: "lemlist MCP and CLI, listed on Email", source: lemlistSources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Email", price: "$69/mo", detail: "Unlimited users and senders, 50,000 emails a month, email and phone finder, lemAgent, MCP and CLI." },
      { name: "Multichannel", price: "$109/mo", detail: "Per user: 5 senders per user, unlimited emails and messages, LinkedIn, SMS and a built-in dialer." },
      { name: "Enterprise", price: "Custom", detail: "Custom roles and permissions, SSO/SAML, a dedicated account manager." },
      { name: "Lead data add-on", price: "$20/mo", detail: "2,000 credits a month: 400 emails or 100 phone numbers, from 25+ providers." },
    ],
    note: "Monthly billing as listed on lemlist's pricing page. Quarterly billing saves 10% and yearly 20% ($55/mo Email, $87 per user/mo Multichannel, $16/mo lead data). Buying-intent signals are a separate $29/mo add-on.",
    source: lemlistSources.pricing,
  },
  faq: [
    [
      "How much does lemlist cost?",
      "On monthly billing, lemlist's pricing page lists Email at $69/mo, Multichannel at $109 per user a month and custom Enterprise pricing. Yearly billing saves 20% ($55 and $87). Lead data is a $20/mo add-on.",
    ],
    [
      "Does lemlist include leads?",
      "lemlist lists a 650M+ lead database and an email and phone finder. Finding contact data uses credits: the $20/mo data add-on gives 2,000 credits, which lemlist says is 400 emails or 100 phone numbers.",
    ],
    [
      "Is there an open-source alternative to lemlist?",
      "Meerko is open source under AGPL-3.0. Self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.",
    ],
  ],
  theyWin: [
    { text: "Multichannel sequences: LinkedIn, SMS, WhatsApp and calling alongside email.", source: lemlistSources.pricing },
    { text: "A 650M+ lead database with phone numbers, not only emails.", source: lemlistSources.pricing },
  ],
};

export default function LemlistAlternativePage() {
  return <ComparePage c={lemlist} />;
}
