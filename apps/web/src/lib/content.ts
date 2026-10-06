// The registry of content pages (docs/CONTENT.md). Hubs, related links, the footer and the sitemap read from it.
import { Mail, ShieldCheck, Terminal, type LucideIcon } from "lucide-react";

export type Topic = "Cold email" | "Deliverability" | "GTM engineering";

export interface GuideEntry {
  slug: string;
  topic: Topic;
  /** Short title for hubs and link lists. */
  title: string;
  /** One sentence for hub cards. */
  summary: string;
  /** Guides in other topics worth linking to from this one (docs/CONTENT.md). */
  crossLinks: string[];
}

export const TOPICS: Topic[] = ["Cold email", "Deliverability", "GTM engineering"];

/** Icon and one-line pitch per topic, for hub sections, eyebrows and related cards. */
export const topicMeta: Record<Topic, { icon: LucideIcon; tagline: string }> = {
  "Cold email": { icon: Mail, tagline: "Write emails people answer." },
  Deliverability: { icon: ShieldCheck, tagline: "Land in the inbox, not in spam." },
  "GTM engineering": { icon: Terminal, tagline: "Build the systems around outbound." },
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
];

export const alternativeBySlug = (slug: string) => alternatives.find((a) => a.slug === slug)!;
