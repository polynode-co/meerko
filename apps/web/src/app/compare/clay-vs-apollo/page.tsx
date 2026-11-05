import type { Metadata } from "next";
import { VersusPage, type Versus } from "@/components/compare/versus-page";
import { apolloSources, claySources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "clay vs apollo" (260/mo) and "apollo vs clay" (170) (DataForSEO, US, Nov 2026).
  title: "Clay vs Apollo: features and pricing compared (2026) | Meerko",
  description:
    "Clay vs Apollo side by side: plans, monthly prices, data, sequences and free plans, from each vendor's own pricing page.",
  alternates: { canonical: "/compare/clay-vs-apollo" },
};

// Same facts as /alternatives/clay and /alternatives/apollo, checked 5 Nov 2026. Change them there and here together.
const clayVsApollo: Versus = {
  slug: "clay-vs-apollo",
  intro:
    "Clay builds lead tables from 150+ data providers and charges by monthly actions and data credits. Apollo is a per-seat sales platform with a free plan, sequences and pipeline tools. Here's how they compare, using only what each says on its own pricing page.",
  rows: [
    { label: "Paid plans from", a: "$185/mo (Launch)", aSource: claySources.pricing, b: "$65/mo per seat (Basic)", bSource: apolloSources.pricing },
    { label: "How you pay", a: "By actions and data credits a month", aSource: claySources.pricing, b: "Per seat; every seat on the same plan", bSource: apolloSources.pricing },
    { label: "Free plan", a: "500 actions and 100 data credits a month", aSource: claySources.pricing, b: "Free with no time limit", bSource: apolloSources.pricing },
    { label: "Data", a: "150+ providers in one marketplace", aSource: claySources.pricing, b: "Credits for emails and phone numbers", bSource: apolloSources.pricing },
    { label: "Email sequences", a: "Native sequencer", aSource: claySources.pricing, b: "Included from Basic", bSource: apolloSources.pricing },
    { label: "After the reply", a: "Global Inbox for replies", aSource: claySources.globalInbox, b: "Pipeline tools to manage deals", bSource: apolloSources.pricing },
  ],
  a: {
    name: "Clay",
    logo: "/logos/clay.png",
    alternative: "/alternatives/clay",
    pickIf: [
      { text: "You want to combine data from 150+ providers in one table.", source: claySources.pricing },
      { text: "You want ad audiences synced to LinkedIn and Meta (Growth).", source: claySources.pricing },
    ],
    pricing: {
      plans: [
        { name: "Free", price: "$0", detail: "500 actions and 100 data credits a month, up to 200 rows per table." },
        { name: "Launch", price: "$185/mo", detail: "From 15,000 actions and 2,500 data credits a month." },
        { name: "Growth", price: "$495/mo", detail: "From 40,000 actions and 6,000 data credits a month." },
        { name: "Enterprise", price: "Custom", detail: "Priced by Clay's sales team." },
      ],
      note: "Monthly billing. Annual billing saves 10% ($167/mo Launch, $446/mo Growth). Data credits start at $0.05 each.",
      source: claySources.pricing,
    },
  },
  b: {
    name: "Apollo",
    logo: "/logos/apollo.png",
    alternative: "/alternatives/apollo",
    pickIf: [
      { text: "You want a free plan that stays free, or a lower per-seat start at $65/mo.", source: apolloSources.pricing },
      { text: "You need phone numbers, call recording and advanced CRM integrations (Professional).", source: apolloSources.pricing },
    ],
    pricing: {
      plans: [
        { name: "Free", price: "$0", detail: "Stays free with no time limit." },
        { name: "Basic", price: "$65/mo", detail: "Per seat: email sequencing and core integrations." },
        { name: "Professional", price: "$99/mo", detail: "Per seat: higher credit limits, AI features, call recording." },
        { name: "Organization", price: "$119/mo", detail: "Per seat, billed annually only, minimum 3 seats." },
      ],
      note: "Per seat, monthly billing. Billed annually, Basic is $49 and Professional $79 a seat a month.",
      source: apolloSources.pricing,
    },
  },
  faq: [
    [
      "Is Clay or Apollo cheaper?",
      "For one seller, Apollo: Basic is $65 a seat a month against $185 a month for Clay's Launch plan, on monthly billing. Clay doesn't price per seat, so the gap narrows as a team grows. Both have a free plan.",
    ],
    [
      "What's the difference between Clay and Apollo?",
      "Clay pulls data from 150+ providers into tables and charges for actions and data credits. Apollo sells per seat and bundles sequences and pipeline tools, with credits for emails and phone numbers. Both can send email sequences.",
    ],
    [
      "Is there an alternative to both?",
      "Meerko runs outbound from the assistant you already use: it finds and verifies emails, sends sequences from your own mailboxes and drafts replies. It's open source; Meerko Cloud starts free and Pro is $49/mo.",
    ],
  ],
};

export default function ClayVsApolloPage() {
  return <VersusPage v={clayVsApollo} />;
}
