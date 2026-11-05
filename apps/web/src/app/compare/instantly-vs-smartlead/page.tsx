import type { Metadata } from "next";
import { VersusPage, type Versus } from "@/components/compare/versus-page";
import { instantlySources, smartleadSources } from "@/lib/sources";

export const metadata: Metadata = {
  // Targets "instantly vs smartlead" (140/mo) (DataForSEO, US, Nov 2026).
  title: "Instantly vs Smartlead: features and pricing compared (2026) | Meerko",
  description:
    "Instantly vs Smartlead side by side: monthly prices, sending volume, email accounts and lead data, from each vendor's own pricing page.",
  alternates: { canonical: "/compare/instantly-vs-smartlead" },
};

// Instantly facts as on /alternatives/instantly; Smartlead as on /alternatives/smartlead. Both checked 5 Nov 2026, monthly billing.
const instantlyVsSmartlead: Versus = {
  slug: "instantly-vs-smartlead",
  intro:
    "Instantly and Smartlead are both cold email platforms built for sending at volume, and both include unlimited email accounts. They differ on entry price, how lead data is sold and what agencies get. Every fact below comes from each vendor's own pricing page.",
  rows: [
    { label: "Paid plans from", a: "$47/mo (Growth)", aSource: instantlySources.pricing, b: "$39/mo (Base)", bSource: smartleadSources.pricing },
    { label: "Entry plan volume", a: "5,000 emails and 1,000 uploaded contacts a month", aSource: instantlySources.pricing, b: "6,000 sends and 2,000 contacts a month", bSource: smartleadSources.pricing },
    { label: "Top self-serve plan", a: "$358/mo: 500,000 emails a month", aSource: instantlySources.pricing, b: "$379/mo: 500,000 sends a month", bSource: smartleadSources.pricing },
    { label: "Email accounts", a: "Unlimited, with warmup", aSource: instantlySources.pricing, b: "Unlimited on every plan, with a warmup pool", bSource: smartleadSources.pricing },
    { label: "Lead data", a: "450M+ lead database, via Instantly Credits from $47/mo", aSource: instantlySources.pricing, b: "Verified prospect emails: $59/mo add-on on Base and Pro, included above", bSource: smartleadSources.pricing },
    { label: "Reply inbox", a: "CRM with Unibox, from Hypergrowth", aSource: instantlySources.pricing, b: "Unified Master Inbox", bSource: smartleadSources.pricing },
  ],
  a: {
    name: "Instantly",
    logo: "/logos/instantly.png",
    alternative: "/alternatives/instantly",
    pickIf: [
      { text: "You want a 450M+ B2B lead database next to your sender.", source: instantlySources.pricing },
      { text: "You want unlimited email accounts and warmup from $47/mo.", source: instantlySources.pricing },
    ],
    pricing: {
      plans: [
        { name: "Growth", price: "$47/mo", detail: "Unlimited email accounts and warmup, 5,000 emails and 1,000 uploaded contacts a month." },
        { name: "Hypergrowth", price: "$107/mo", detail: "125,000 emails and 25,000 uploaded contacts a month, CRM with Unibox." },
        { name: "Light Speed", price: "$358/mo", detail: "500,000 emails and 100,000 uploaded contacts a month." },
        { name: "Enterprise", price: "Custom", detail: "More volume and a private deliverability network." },
      ],
      note: "Outreach plans, monthly billing. Leads are a separate subscription: Instantly Credits from $47/mo (1,500–2,000 credits and the 450M+ lead database).",
      source: instantlySources.pricing,
    },
  },
  b: {
    name: "Smartlead",
    logo: "/logos/smartlead.png",
    alternative: "/alternatives/smartlead",
    pickIf: [
      { text: "You want the lower entry price ($39/mo) with verified prospect emails in the plan's allowance.", source: smartleadSources.pricing },
      { text: "You run an agency: white-label client workspaces ($29/mo each) and dedicated sending servers ($39/mo each).", source: smartleadSources.pricing },
    ],
    pricing: {
      plans: [
        { name: "Base", price: "$39/mo", detail: "2,000 contacts, 6,000 sends and 2,000 verified prospect emails a month." },
        { name: "Pro", price: "$94/mo", detail: "30,000 contacts, 90,000 sends; CRM access, API and webhooks." },
        { name: "Unlimited Smart", price: "$174/mo", detail: "Unlimited contacts, 150,000 sends, 50,000 verified emails a month." },
        { name: "Unlimited Prime", price: "$379/mo", detail: "500,000 sends, 170,000 verified emails, 3 SmartServers." },
      ],
      note: "Monthly billing. Annual billing saves 17% ($32, $78, $144 and $315 a month).",
      source: smartleadSources.pricing,
    },
  },
  faq: [
    [
      "Is Instantly or Smartlead cheaper?",
      "At entry level, Smartlead: Base is $39 a month against $47 for Instantly's Growth plan, on monthly billing. At 500,000 emails a month, Instantly's Light Speed ($358) is cheaper than Smartlead's Unlimited Prime ($379).",
    ],
    [
      "Do Instantly and Smartlead charge per mailbox?",
      "No. Instantly lists unlimited email accounts and warmup from its Growth plan, and Smartlead says every plan includes unlimited email accounts.",
    ],
    [
      "Is there an alternative to both?",
      "Meerko runs outbound from the assistant you already use: it finds and verifies emails, sends sequences from your own Gmail, Outlook or IMAP mailboxes and drafts replies. It's open source; Meerko Cloud starts free and Pro is $49/mo.",
    ],
  ],
};

export default function InstantlyVsSmartleadPage() {
  return <VersusPage v={instantlyVsSmartlead} />;
}
