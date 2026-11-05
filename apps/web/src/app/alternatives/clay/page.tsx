import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { claySources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "clay alternative(s)" (480/mo, +88% YoY) and "clay pricing" (1.9k/mo, KD 7) (DataForSEO, Oct 2026).
  title: "Open-source Clay alternative & Clay pricing (2026) | Meerko",
  description:
    "A cheaper, open-source Clay alternative: self-host Meerko free or use Cloud from $49/mo. Clay pricing and features, from Clay's own pages.",
  alternates: { canonical: "/alternatives/clay" },
};

// Every Clay cell cites Clay's own pages (lib/sources.ts). Re-check before changing anything.
const clay: Comparison = {
  slug: "clay",
  name: "Clay",
  pitch:
    "Clay and Meerko both find leads, send sequences and handle replies. Meerko runs inside Claude, ChatGPT or your coding agent, and it's open source: self-host it for free and keep every lead in your own Postgres, or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Pro)", them: "$185/mo (Launch)", source: claySources.pricing },
    { label: "Free plan", meerko: "200 credits once, 1 mailbox", them: "500 actions/mo", source: claySources.pricing },
    { label: "Data providers", meerko: "Icypeas, or your own key on Pro", them: "150+ providers", source: claySources.pricing },
    { label: "Email sequences", meerko: "From your own Gmail or Outlook", them: "Native sequencer", source: claySources.pricing },
    { label: "Reply inbox", meerko: "Built in, with agent-drafted replies", them: "Global Inbox", source: claySources.globalInbox },
    { label: "API", meerko: "Every plan: MCP server, CLI and REST API", them: "HTTP API on Growth and Enterprise", source: claySources.pricing },
  ],
  pricing: {
    plans: [
      { name: "Free", price: "$0", detail: "500 actions and 100 data credits a month, up to 200 rows per table." },
      { name: "Launch", price: "$185/mo", detail: "Starts at 15,000 actions and 2,500 data credits a month; the price depends on the volume you pick." },
      { name: "Growth", price: "$495/mo", detail: "Starts at 40,000 actions and 6,000 data credits a month." },
      { name: "Enterprise", price: "Custom", detail: "Priced by Clay's sales team." },
    ],
    note: "Monthly billing as listed on Clay's pricing page. Annual billing saves 10% ($167/mo Launch, $446/mo Growth). Data credits start at $0.05 each.",
    source: claySources.pricing,
  },
  faq: [
    [
      "Is there an open-source alternative to Clay?",
      "Yes. Meerko is open source under AGPL-3.0: you can self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.",
    ],
    [
      "How much does Clay cost?",
      "Clay's pricing page lists a Free plan, Launch from $185/mo and Growth from $495/mo on monthly billing ($167 and $446 a month billed annually), plus custom Enterprise pricing.",
    ],
    [
      "Can Clay send emails?",
      "Yes. Clay's pricing page lists a native email sequencer, and Clay University documents a Global Inbox for replies. Meerko also sends sequences, from your own Gmail or Outlook.",
    ],
  ],
  theyWin: [
    { text: "Far more data: 150+ providers in one marketplace.", source: claySources.pricing },
    { text: "Ad audiences synced to LinkedIn and Meta, on Growth.", source: claySources.pricing },
  ],
};

export default function ClayAlternativePage() {
  return <ComparePage c={clay} />;
}
