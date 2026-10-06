import type { Metadata } from "next";
import { ComparePage, type Comparison } from "@/components/compare/compare-page";
import { claySources } from "@/lib/sources";

export const metadata: Metadata = {
  title: "The open-source Clay alternative — Meerko",
  description:
    "Meerko vs Clay, from each product's own pages: prices, sequencer, reply inbox and agent support. Meerko is open source: self-host it for free or use Meerko Cloud from $49/mo.",
  alternates: { canonical: "/clay-alternative" },
};

// Every Clay cell cites Clay's own pages (lib/sources.ts). Re-check before changing anything.
const clay: Comparison = {
  name: "Clay",
  pitch:
    "Clay and Meerko both find leads, send sequences and handle replies, and both work with your coding agent. Meerko is open source: self-host it for free and keep every lead in your own Postgres, or use Meerko Cloud from $49/mo.",
  rows: [
    { label: "Paid plans from", meerko: "$49/mo (Cloud Pro)", them: "$167/mo (Launch)", source: claySources.pricing },
    { label: "Free plan", meerko: "1,000 credits on Cloud", them: "500 actions/mo", source: claySources.pricing },
    { label: "Data providers", meerko: "Icypeas, or your own key", them: "150+ providers", source: claySources.pricing },
    { label: "Email sequences", meerko: "From your own Gmail", them: "Native sequencer", source: claySources.pricing },
    { label: "Reply inbox", meerko: "Built in, with agent-drafted replies", them: "Global Inbox", source: claySources.globalInbox },
    { label: "Coding agents", meerko: "MCP server (31 tools) and CLI", them: "Clay MCP, CLI and API", source: claySources.pricing },
  ],
  theyWin: [
    { text: "Far more data: 150+ providers in one marketplace.", source: claySources.pricing },
    { text: "Ad audiences synced to LinkedIn, Meta and Google.", source: claySources.pricing },
  ],
};

export default function ClayAlternativePage() {
  return <ComparePage c={clay} />;
}
