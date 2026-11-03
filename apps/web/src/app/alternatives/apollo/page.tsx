import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { apolloSources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "apollo pricing" (1.9k/mo, KD 13) and "apollo alternative(s)" (390, +85% YoY) (DataForSEO, US, Oct 2026).
  title: "Open-source Apollo alternative & Apollo pricing (2026) | Meerko",
  description: "Apollo's plans and features next to Meerko, the open-source AI sales agent: self-host it free or use Cloud from $49/mo. From Apollo's own pricing page.",
  alternates: { canonical: "/alternatives/apollo" },
};

// Every Apollo cell cites Apollo's pricing page (its plan data and FAQ), checked 6 Oct 2026.
const apollo: Comparison = {
  slug: "apollo",
  name: "Apollo",
  pitch:
    "Apollo is a sales platform with a contact database, sequences and pipeline tools. Meerko is an open-source AI sales agent you run from Claude Code: self-host it for free and keep every lead in your own Postgres, or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Cloud Pro)", them: "$49/mo (Basic), as listed", source: apolloSources.pricing },
    { label: "Free plan", meerko: "200 credits on Cloud", them: "Free plan with no time limit", source: apolloSources.pricing },
    { label: "Email sequences", meerko: "From your own Gmail or Outlook", them: "Included from Basic", source: apolloSources.pricing },
    { label: "What credits pay for", meerko: "Found and verified emails, lead search", them: "Emails, phone numbers, warmup, mailboxes and more", source: apolloSources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Free", price: "$0", detail: "For exploring Apollo or light use; stays free with no time limit." },
      { name: "Basic", price: "$49/mo", detail: "For individual sellers: email sequencing and core integrations." },
      { name: "Professional", price: "$99/mo", detail: "Higher credit limits, AI features, call recording and advanced CRM integrations." },
      { name: "Custom", price: "Custom", detail: "Custom volumes, SSO, advanced security and dedicated support." },
    ],
    note: "Prices as listed in the plan data on Apollo's pricing page, which doesn't say whether they reflect monthly or annual billing: check with Apollo before you buy. All seats on an account are on the same plan.",
    source: apolloSources.pricing,
  },
  faq: [
    [
      "How much does Apollo cost?",
      "Apollo's pricing page lists a Free plan, Basic at $49/mo and Professional at $99/mo, plus a Custom plan priced by its sales team. Check the billing period with Apollo.",
    ],
    ["Is there a free version of Apollo?", "Yes. Apollo says its free plan stays free with no time limit."],
    [
      "Is there an open-source alternative to Apollo?",
      "Meerko is open source under AGPL-3.0: self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.",
    ],
  ],
  theyWin: [
    { text: "Phone numbers, call recording and advanced CRM integrations on Professional.", source: apolloSources.pricing },
    { text: "Pipeline tools to manage deals and track engagement, built in.", source: apolloSources.pricing },
  ],
};

export default function ApolloAlternativePage() {
  return <ComparePage c={apollo} />;
}
