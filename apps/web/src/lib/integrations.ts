// The registry of integrations: the /integrations hub, its marketing pages, the footer and the sitemap read from it.
// Only what Meerko connects to today, each linking to the page that documents it.

export type IntegrationGroup = "AI agents" | "Mailboxes" | "Lead data" | "Notifications" | "Developers";

export const INTEGRATION_GROUPS: { group: IntegrationGroup; tagline: string }[] = [
  { group: "AI agents", tagline: "Drive Meerko from the agent you already use, over MCP." },
  { group: "Mailboxes", tagline: "Send from your own inbox, so replies land where you read mail." },
  { group: "Lead data", tagline: "Where people, companies and work emails come from." },
  { group: "Notifications", tagline: "Hear about replies, and let your agent draft the answers." },
  { group: "Developers", tagline: "Script anything the dashboard does." },
];

export interface Integration {
  slug: string;
  name: string;
  group: IntegrationGroup;
  /** One sentence for the hub card. */
  summary: string;
  /** Where the card links: a marketing page under /integrations, or the docs page that covers it. */
  href: string;
  /** A logo in public/logos, when we have one; otherwise the card shows its initial. */
  logo?: string;
  /** Several logos side by side, when one entry covers several providers. */
  logos?: string[];
  /** The logo is a black mark, so it is inverted on the dark background. */
  mono?: boolean;
  /** How it's set up, shown as a tag. */
  setup: "Built in" | "Sign in" | "App password" | "Your own key" | "One command" | "Paste a URL";
  /** True when /integrations/<slug> is its own page (see app/integrations). */
  page?: boolean;
}

export const integrations: Integration[] = [
  { slug: "claude-code", name: "Claude Code", group: "AI agents", logo: "/logos/agents/claude.svg", setup: "One command", href: "/docs/claude-code", summary: "Add the hosted MCP server and run prospecting, sequences and replies from your terminal." },
  { slug: "cursor", name: "Cursor", group: "AI agents", logo: "/logos/agents/cursor.svg", mono: true, setup: "One command", href: "/docs/codex-cursor", summary: "Use Meerko's tools from Cursor's agent, signed in with your browser." },
  { slug: "codex", name: "Codex", group: "AI agents", logo: "/logos/agents/openai.svg", mono: true, setup: "One command", href: "/docs/codex-cursor", summary: "Add Meerko to OpenAI Codex as a remote MCP server." },
  { slug: "gemini-cli", name: "Gemini CLI", group: "AI agents", logo: "/logos/agents/gemini.svg", setup: "One command", href: "/docs/mcp-clients", summary: "Connect Gemini CLI, or any MCP client that supports remote servers." },
  { slug: "claude-routines", name: "Claude Code routines", group: "Notifications", logo: "/logos/agents/claude.svg", setup: "Paste a URL", href: "/docs/wake-your-agent", summary: "Meerko starts your routine when replies arrive, so the drafts are ready when you are. It can't send." },
  { slug: "gmail", name: "Gmail & Google Workspace", group: "Mailboxes", logo: "/logos/integrations/gmail.png", setup: "App password", page: true, href: "/integrations/gmail", summary: "Personalized sequences with follow-ups in the same thread, sent from your own Gmail." },
  { slug: "outlook", name: "Outlook & Microsoft 365", group: "Mailboxes", logo: "/logos/integrations/outlook.png", setup: "Sign in", page: true, href: "/integrations/outlook", summary: "Mail merge with follow-ups from Outlook, connected with Sign in with Microsoft." },
  { slug: "imap", name: "Zoho, Fastmail & IMAP", group: "Mailboxes", logos: ["/logos/integrations/zoho.svg", "/logos/integrations/fastmail.svg"], setup: "App password", href: "/docs/mailboxes#connect", summary: "Any provider with IMAP and SMTP over TLS connects the same way as Gmail." },
  { slug: "icypeas", name: "Icypeas", group: "Lead data", logo: "/logos/integrations/icypeas.png", setup: "Built in", href: "/docs/finding-leads", summary: "People and company search and email finding, included on Meerko Cloud. Bring your own key to skip credits." },
  { slug: "firecrawl", name: "Firecrawl", group: "Lead data", logo: "/logos/integrations/firecrawl.png", setup: "Your own key", href: "/docs/credits#firecrawl", summary: "Add your Firecrawl key and email finding tries FullEnrich's data when Icypeas misses, with no Meerko credits." },
  { slug: "slack", name: "Slack", group: "Notifications", logo: "/logos/integrations/slack.png", setup: "Sign in", href: "/docs/slack", summary: "Replies and drafts in a channel, with Approve and Discard buttons, and /meerko for what's waiting." },
  { slug: "webhooks", name: "Webhooks", group: "Notifications", setup: "Paste a URL", href: "/docs/wake-your-agent", summary: "A signed call to any agent or workflow (Agent SDK, n8n, CI) when new replies wait." },
  { slug: "api", name: "REST API", group: "Developers", setup: "Your own key", href: "/docs/api", summary: "Every dashboard action over HTTP, with an OpenAPI 3.1 document." },
  { slug: "cli", name: "CLI", group: "Developers", setup: "One command", href: "/docs/cli", summary: "The meerko command for your terminal and scripts." },
];

export const integrationBySlug = (slug: string) => integrations.find((i) => i.slug === slug)!;
/** The integrations that have their own marketing page. */
export const integrationPages = integrations.filter((i) => i.page);
