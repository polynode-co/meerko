// The registry of content pages. Hubs, related links, the footer and the sitemap read from it.
import { Bot, ListChecks, Mail, ShieldCheck, Terminal, type LucideIcon } from "lucide-react";

export type Topic = "Cold email" | "Deliverability" | "GTM engineering" | "AI agents" | "Agent how-tos";

export interface GuideEntry {
  slug: string;
  topic: Topic;
  /** Short title for hubs and link lists. */
  title: string;
  /** One sentence for hub cards. */
  summary: string;
  /** Guides in other topics worth linking to from this one. */
  crossLinks: string[];
}

export const TOPICS: Topic[] = ["AI agents", "Agent how-tos", "Cold email", "Deliverability", "GTM engineering"];

/** Icon and one-line pitch per topic, for hub sections, eyebrows and related cards. */
export const topicMeta: Record<Topic, { icon: LucideIcon; tagline: string }> = {
  "Cold email": { icon: Mail, tagline: "Write emails people answer." },
  Deliverability: { icon: ShieldCheck, tagline: "Land in the inbox, not in spam." },
  "GTM engineering": { icon: Terminal, tagline: "Build the systems around outbound." },
  "AI agents": { icon: Bot, tagline: "Run outbound from the assistant you already use." },
  // A weekly series: one outbound task done end to end from an assistant.
  "Agent how-tos": { icon: ListChecks, tagline: "One outbound task a week, done from your assistant." },
};

/** The guide featured at the top of /guides. */
export const FEATURED_GUIDE = "cold-email-follow-up";

export const guides: GuideEntry[] = [
  {
    slug: "cold-email-follow-up",
    topic: "Cold email",
    title: "How to follow up on a cold email",
    summary: "When to follow up, how many times, and templates that stay in the same thread.",
    crossLinks: ["gmail-sending-limits", "email-deliverability"],
  },
  {
    slug: "cold-email-subject-lines",
    topic: "Cold email",
    title: "Cold email subject lines",
    summary: "What makes a subject line get opened, with examples you can adapt.",
    crossLinks: ["email-deliverability"],
  },
  {
    slug: "cold-email-templates",
    topic: "Cold email",
    title: "Cold email templates",
    summary: "Copy-ready first emails and follow-ups, with personalization variables.",
    crossLinks: ["gmail-sending-limits", "claude-code-for-sales"],
  },
  {
    slug: "gmail-sending-limits",
    topic: "Deliverability",
    title: "Gmail sending limits",
    summary: "Daily limits for Gmail and Google Workspace, from Google's own pages, and how to stay under them.",
    crossLinks: ["cold-email-follow-up"],
  },
  {
    slug: "email-deliverability",
    topic: "Deliverability",
    title: "Email deliverability: SPF, DKIM and DMARC",
    summary: "What Gmail requires from senders, how to set up authentication, and the unsubscribe rules.",
    crossLinks: ["cold-email-follow-up", "cold-email-subject-lines"],
  },
  {
    slug: "gtm-engineer",
    topic: "GTM engineering",
    title: "What is a GTM engineer?",
    summary: "The role, skills, tools and salary, with sources.",
    crossLinks: ["cold-email-follow-up"],
  },
  {
    slug: "claude-code-for-sales",
    topic: "GTM engineering",
    title: "Claude Code for sales and outbound",
    summary: "Use cases for running prospecting, sequences and replies from Claude Code.",
    crossLinks: ["cold-email-templates"],
  },
  {
    slug: "claude-for-sales",
    topic: "AI agents",
    title: "Claude connectors for sales",
    summary: "Find leads, send sequences and answer replies from a Claude chat, with a connector.",
    crossLinks: ["claude-code-for-sales", "cold-email-follow-up"],
  },
  {
    slug: "chatgpt-for-sales",
    topic: "AI agents",
    title: "ChatGPT connectors and MCP for sales",
    summary: "How to connect ChatGPT to your outbound tools with a custom MCP server.",
    crossLinks: ["cold-email-templates"],
  },
  {
    slug: "best-mcp-servers-for-sales",
    topic: "AI agents",
    title: "The best MCP servers for sales",
    summary: "Gmail, HubSpot, Apollo, Clay and Meerko: what each MCP server lets your assistant do.",
    crossLinks: ["gtm-engineer"],
  },
  {
    slug: "claude-crm",
    topic: "AI agents",
    title: "Claude as a CRM for outbound",
    summary: "How Claude works with HubSpot and Attio, and an outbound pipeline in Claude that syncs contacts to them.",
    crossLinks: ["cold-email-follow-up"],
  },
  {
    slug: "apollo-mcp",
    topic: "AI agents",
    title: "Apollo MCP server: what it does",
    summary: "What Apollo's MCP server does in Claude or ChatGPT, what uses credits, and an open-source option that also sends.",
    crossLinks: ["cold-email-follow-up", "gmail-sending-limits"],
  },
  {
    slug: "gmail-mcp",
    topic: "AI agents",
    title: "Gmail MCP: email from your AI assistant",
    summary: "The ways to give Claude or ChatGPT access to Gmail, and what each can and can't do.",
    crossLinks: ["gmail-sending-limits", "email-deliverability"],
  },
  {
    slug: "can-claude-send-emails",
    topic: "AI agents",
    title: "Can Claude send emails?",
    summary: "The direct answer, what Claude's Gmail connector can do, and how to send and follow up from Claude or ChatGPT.",
    crossLinks: ["cold-email-follow-up", "gmail-sending-limits"],
  },
  {
    slug: "grok-connectors",
    topic: "AI agents",
    title: "Grok connectors and custom MCP servers",
    summary: "How Grok's connectors work and how to add a custom MCP server.",
    crossLinks: ["gtm-engineer"],
  },
  {
    slug: "ai-sdr",
    topic: "AI agents",
    title: "AI SDR: what it is and what it costs",
    summary: "What an AI SDR does, the main tools and their prices, and the run-it-in-your-assistant option.",
    crossLinks: ["cold-email-follow-up", "gtm-engineer"],
  },
  {
    slug: "ai-lead-generation",
    topic: "AI agents",
    title: "AI lead generation",
    summary: "How to find, verify and reach B2B leads with an AI assistant, step by step.",
    crossLinks: ["cold-email-templates", "email-deliverability"],
  },
  {
    slug: "find-ctos-with-claude",
    topic: "Agent how-tos",
    title: "Find 30 CTOs from Claude",
    summary: "A list of 30 CTOs with verified work emails, built in one Claude chat.",
    crossLinks: ["claude-for-sales", "ai-lead-generation"],
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug)!;

/** Siblings in the same topic, then the cross-topic links. */
export function relatedGuides(slug: string) {
  const g = guideBySlug(slug);
  const siblings = guides.filter((x) => x.topic === g.topic && x.slug !== slug);
  const cross = g.crossLinks.map(guideBySlug);
  return [...siblings, ...cross];
}

export interface AlternativeEntry {
  slug: string;
  name: string;
  summary: string;
  /** The vendor's own site icon (public/logos). */
  logo: string;
}

export const alternatives: AlternativeEntry[] = [
  { slug: "clay", name: "Clay", logo: "/logos/clay.png", summary: "Clay pricing and features next to Meerko, from Clay's own pages." },
  { slug: "apollo", name: "Apollo", logo: "/logos/apollo.png", summary: "Apollo's plans and features next to Meerko, from Apollo's own pages." },
  { slug: "instantly", name: "Instantly", logo: "/logos/instantly.png", summary: "Instantly pricing and features next to Meerko, from Instantly's own pages." },
  { slug: "reply-io", name: "Reply.io", logo: "/logos/reply-io.png", summary: "Reply.io's plans and features next to Meerko, from Reply's own pricing page." },
  { slug: "lemlist", name: "lemlist", logo: "/logos/lemlist.png", summary: "lemlist pricing and features next to Meerko, from lemlist's own pages." },
  { slug: "smartlead", name: "Smartlead", logo: "/logos/smartlead.png", summary: "Smartlead pricing and features next to Meerko, from Smartlead's own pages." },
  { slug: "hunter", name: "Hunter", logo: "/logos/hunter.png", summary: "Hunter's email finder, verifier and pricing next to Meerko, from Hunter's own pages." },
  { slug: "oxygen", name: "Oxygen", logo: "/logos/oxygen.png", summary: "Oxygen's plans, credit prices and mailbox fees next to Meerko, from Oxygen's own pricing page." },
];

/** Head-to-head pages under /compare: two other tools side by side, Meerko as a third option. */
export interface VersusEntry {
  slug: string;
  title: string;
  summary: string;
}

export const versusPages: VersusEntry[] = [
  { slug: "clay-vs-apollo", title: "Clay vs Apollo", summary: "Enrichment tables or a contact database: prices and features from each vendor's own pages." },
  { slug: "instantly-vs-smartlead", title: "Instantly vs Smartlead", summary: "Two cold-email senders compared on price, volume and lead data." },
];

export const alternativeBySlug = (slug: string) => alternatives.find((a) => a.slug === slug)!;
