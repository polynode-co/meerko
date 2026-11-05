import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { hunterSources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "hunter.io alternatives" (70/mo) (DataForSEO, US, Nov 2026).
  title: "Open-source Hunter.io alternative & Hunter pricing (2026) | Meerko",
  description:
    "Hunter's email finder, verifier, sequences and pricing next to Meerko, the open-source outbound engine for Claude, ChatGPT and coding agents. From Hunter's own pricing page.",
  alternates: { canonical: "/alternatives/hunter" },
};

// Every Hunter cell cites Hunter's pricing page (plan cards, comparison table and FAQ), checked 5 Nov 2026, "Pay monthly".
// Hunter's page showed euro prices from every place we loaded it, so the prices here are in euros.
const hunter: Comparison = {
  slug: "hunter",
  name: "Hunter",
  pitch:
    "Hunter is an email finder and verifier with a B2B database and its own cold email sequences. Meerko finds and verifies emails too, then sends sequences from your own mailboxes and drafts replies you approve, all from Claude, ChatGPT or your coding agent. It's open source: self-host it for free or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro, 4,900 credits)", them: "€49/mo (Starter, 2,000 credits)", source: hunterSources.pricing },
    { label: "Free plan", meerko: "200 credits once, 1 mailbox", them: "50 credits a month, 1 email account", source: hunterSources.pricing },
    { label: "Email found", meerko: "8 credits; misses are free", them: "1 credit; misses are free", source: hunterSources.pricing },
    { label: "Email verified", meerko: "1 credit", them: "0.5 credit", source: hunterSources.pricing },
    { label: "Sequences", meerko: "Unlimited mailboxes on Pro, replies drafted by your assistant", them: "3 email accounts on Starter, 10 on Growth, 20 on Scale", source: hunterSources.pricing },
    { label: "Credits", meerko: "Monthly on Pro; packs at $10 per 1,000", them: "Reset monthly and don't roll over", source: hunterSources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Free", price: "€0", detail: "50 credits a month, 1 connected email account, 500 recipients per sequence." },
      { name: "Starter", price: "€49/mo", detail: "2,000 credits a month, 3 email accounts, 2,500 recipients per sequence." },
      { name: "Growth", price: "€149/mo", detail: "10,000 credits a month, 10 email accounts, 5,000 recipients per sequence." },
      { name: "Scale", price: "€299/mo", detail: "25,000 credits a month, 20 email accounts, 15,000 recipients per sequence." },
    ],
    note: "Monthly billing as listed on Hunter's pricing page, in euros. Paying yearly saves 30% (€34, €104 and €209 a month, with the year's credits upfront). Every plan has unlimited team members sharing one credit pool; Enterprise is custom.",
    source: hunterSources.pricing,
  },
  faq: [
    [
      "How much does Hunter.io cost?",
      "Hunter's pricing page lists a Free plan with 50 credits a month, and Starter at €49, Growth at €149 and Scale at €299 a month on monthly billing. Paying yearly saves 30%.",
    ],
    [
      "How does Hunter count credits?",
      "Hunter charges 1 credit per email found and 0.5 credit per email verified; searches that find nothing cost nothing. Meerko charges 8 credits per found email and 1 per verification, and misses are free too.",
    ],
    [
      "Is there an open-source alternative to Hunter.io?",
      "Meerko is open source under AGPL-3.0. It finds and verifies emails, then sends sequences and handles replies. Self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.",
    ],
  ],
  theyWin: [
    { text: "Cheaper per email found: 1 credit, with 2,000 credits a month on Starter.", source: hunterSources.pricing },
    { text: "Its own B2B database (Discover), a browser extension and a Google Sheets add-on.", source: hunterSources.pricing },
  ],
};

export default function HunterAlternativePage() {
  return <ComparePage c={hunter} />;
}
