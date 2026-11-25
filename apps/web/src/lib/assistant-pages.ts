// The two assistant landing pages, /claude and /chatgpt: "Claude for sales" and "ChatGPT for sales".
//
// Built the way Antwork's /automate/<client>/<platform> leaf pages are: few pages, each titled for the query people
// type, the setup and example prompts on the page, a connect call to action, and at least one fact that is true of
// that assistant and no other (`only`). If an assistant has nothing of its own to say, it doesn't get a page, and
// there is no page per assistant × feature pair: one page per assistant carries its CRM, Gmail and lead queries.
//
// Every number is read from the code: the tool count from the MCP server's reference, prices and credits from
// lib/pricing.ts. Facts about Claude and ChatGPT themselves cite their makers' help pages (`sources`).

import { mcp, needsApproval } from "@/lib/docs";
import { FREE_CREDITS, proPrices } from "@/lib/pricing";
import { docsSources } from "@/lib/sources";

export interface Source {
  label: string;
  url: string;
}

export type AssistantSlug = "claude" | "chatgpt";

/** Claude's add-connector form, opened directly (claude.ai, any plan). */
export const CLAUDE_ADD_CONNECTOR_URL = "https://claude.ai/customize/connectors?modal=add-custom-connector";
/** Meerko's listing in ChatGPT's plugin directory. */
export const CHATGPT_PLUGIN_URL = "https://chatgpt.com/plugins/plugin_asdk_app_6b0463cf58c081919496d0d2f27ecaf0";

const toolCount = mcp.tools.length;
const emailToolCount = mcp.tools.filter(needsApproval).length;

export interface Fact {
  title: string;
  body: string;
  /** A Claude or OpenAI page that backs it. */
  source?: Source;
}

export interface SetupStep {
  title: string;
  body: string;
  /** Show the MCP server URL with a copy button under this step. */
  copyUrl?: boolean;
  link?: { href: string; label: string };
}

export interface AssistantPage {
  slug: AssistantSlug;
  /** The assistant's name, as people write it. */
  name: string;
  /** The integrations registry entry with its logo. */
  integration: string;
  /** What the page targets (DataForSEO, US, monthly). */
  queries: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  cta: { label: string; href: string };
  /** The extractable answer: the question the page's main query asks, answered in a sentence that names its entities. */
  question: string;
  answer: string;
  /** True of this assistant and no other. */
  only: Fact[];
  setup: { title: string; sub: string; steps: SetupStep[]; after?: string };
  /** A second way in, under the main setup (Claude Code, or ChatGPT's custom MCP server). */
  alt: { title: string; body: string; command?: string; link: { href: string; label: string } };
  /** The chat shown in the hero: an illustration, not a recording. */
  chat: { window: string; prompt: string; tools: string[]; reply: string };
  prompts: { group: string; query: string; items: string[] }[];
  faq: [string, string][];
  sources: Source[];
  guide: { href: string; label: string };
  docs: string;
}

// What both assistants get, since it's the same server behind both.
export const approvalFact: Fact = {
  title: "You approve every email",
  body: `By default each sequence email and each reply draft waits for your OK. The ${emailToolCount} tools that send are marked as such, so the assistant asks before running them too.`,
};

const sendingFaq = (name: string): [string, string] => [
  `Does ${name} send emails without asking?`,
  `No. Meerko marks the ${emailToolCount} tools that send email, so ${name} asks before running them, and by default the workspace holds every sequence email and reply draft until you approve it. You can switch either to sending on its own later, in Connections.`,
];

const priceFaq = (name: string): [string, string] => [
  `How much does it cost to use Meerko with ${name}?`,
  `Meerko Cloud starts free with ${FREE_CREDITS} credits; Pro is $${proPrices.month} a month with unlimited mailboxes. Credits pay for lead search and email finding only: sending, reply detection and drafts are free. Self-hosting the open-source version costs nothing. Your ${name} plan is separate.`,
];

const crmFaq = (name: string): [string, string] => [
  `Does Meerko work as a ${name} CRM?`,
  `Meerko keeps a pipeline of every lead (new, contacted, replied, meeting, won, lost) that ${name} can read and move, and it can push contacted leads to HubSpot or Attio as contacts. That sync is one way: it writes contacts and their stage, and never reads or deletes what's in your CRM.`,
];

export const assistantPages: Record<AssistantSlug, AssistantPage> = {
  claude: {
    slug: "claude",
    name: "Claude",
    integration: "claude",
    queries: `"claude for sales" 260/mo, "claude crm" 110 (260 in Oct), "claude gmail" 260, "claude hubspot" 110, "claude lead generation" 20-30 (DataForSEO, US, Nov 2026)`,
    title: "Claude for Sales: Find Leads, Send Sequences and Run Your Pipeline | Meerko",
    description:
      "Connect Meerko to Claude and run outbound from a chat: find and verify leads, send sequences from your own Gmail or Outlook with your approval, and sync contacts to HubSpot or Attio.",
    h1: "Claude for sales: find leads, send sequences and run your pipeline from Claude",
    lede: `Add Meerko as a connector and Claude gets ${toolCount} tools for outbound: it finds the people you sell to, verifies their work emails, sends a sequence from your own Gmail or Outlook and catches every reply. You approve each email before it goes.`,
    cta: { label: "Add Meerko to Claude →", href: CLAUDE_ADD_CONNECTOR_URL },
    question: "Can Claude do your sales outreach?",
    answer: `Yes, with Meerko connected. Claude writes the emails and decides who to target; Meerko gives it ${toolCount} tools to find and verify leads, send sequences from your own Gmail, Google Workspace or Outlook inbox, detect replies and track the pipeline. It works in Claude on the web, the desktop and mobile apps, and Claude Code.`,
    only: [
      {
        title: "Works on Claude's Free plan",
        body: "Free Claude plans can add one custom connector, which is all Meerko needs. Paid plans can add more.",
        source: docsSources.claudeConnectors,
      },
      {
        title: "And in Claude Code",
        body: "The same server in your terminal, with one command. Same account, same leads, same sequences.",
      },
      {
        title: "Replies can wake a Claude routine",
        body: "When replies arrive, Meerko can start your Claude Code routine so the drafts are ready when you look. The routine can draft, never send.",
      },
    ],
    setup: {
      title: "Connect Meerko to Claude in four steps",
      sub: "In Claude on the web or the desktop app. The connection follows you to Claude's mobile apps.",
      steps: [
        {
          title: "Open Connectors",
          body: "In Claude, go to Customize → Connectors, click + Add, then Add custom connector. The button above opens that form.",
          link: { href: CLAUDE_ADD_CONNECTOR_URL, label: "Open in Claude" },
        },
        { title: "Paste the URL", body: "Name it Meerko, paste the server URL and click Continue, then Add. Keep the detected OAuth sign-in.", copyUrl: true },
        { title: "Sign in", body: "Claude sends you to Meerko: continue with Google and click Allow. Your Meerko account is made here if you don't have one." },
        { title: "Ask", body: "In a chat, open + → Connectors and check Meerko is on. Then ask in plain language." },
      ],
      after:
        "On Team and Enterprise plans an owner adds the connector once under Organization settings → Connectors, and each member clicks Connect to sign in with their own Meerko account.",
    },
    alt: {
      title: "Using Claude Code?",
      body: "Add the hosted server once for every project, then run /mcp in Claude Code to sign in with your browser.",
      command: "claude mcp add --transport http --scope user meerko {url}",
      link: { href: "/docs/claude-code", label: "Claude Code setup" },
    },
    chat: {
      window: "CLAUDE — NEW CHAT",
      prompt: "Find 20 heads of growth at Series A fintechs in Spain and verify their emails.",
      tools: ["Find people", "Find and verify emails"],
      reply: "Found 20 and verified 17 work emails. They're in a table called “Fintech growth, Spain”. Want a 3-step sequence for them?",
    },
    prompts: [
      {
        group: "Find leads",
        query: "Lead generation in Claude",
        items: [
          "Read our website and set our ideal customer profile from it.",
          "Find 30 heads of sales at B2B SaaS companies in Germany with 50 to 200 employees, and verify their work emails.",
        ],
      },
      {
        group: "Send from Gmail",
        query: "Claude and your Gmail or Outlook",
        items: [
          "Connect my Gmail to Meerko.",
          "Write a 3-step sequence for that table, a follow-up after 3 days and a last one after 7. Show me a preview and don't start it.",
        ],
      },
      {
        group: "Replies",
        query: "Claude reads the answers",
        items: ["Go through this week's replies, label each one, and draft answers for the people who are interested.", "Show me the drafts waiting for me."],
      },
      {
        group: "Pipeline and CRM",
        query: "Claude as your CRM, or next to HubSpot",
        items: ["Who replied this week, who booked a meeting, and what's waiting on me?", "Move Lucía to meeting and sync the table to HubSpot."],
      },
    ],
    faq: [
      [
        "How do I connect Meerko to Claude?",
        "In Claude, open Customize → Connectors, click + Add and choose Add custom connector. Name it Meerko, paste the server URL from this page, then sign in with Google and click Allow. In Claude Code it's one command: claude mcp add with the same URL.",
      ],
      [
        "Can Claude send emails from my Gmail?",
        "Yes, through Meerko. Connect your Gmail or Google Workspace inbox to Meerko with an app password (Outlook and Microsoft 365 use Sign in with Microsoft), and Claude can start sequences that send from it, within the daily limit you set (50 by default). Every email sits in your own Sent folder.",
      ],
      crmFaq("Claude"),
      [
        "Does it connect Claude to HubSpot?",
        "Meerko writes the leads it has emailed to HubSpot as contacts, matched by email, with the stage as Lead status, within a minute or two of each change. Claude asks Meerko; Meerko writes to HubSpot with a service key you add in Connections. It doesn't read deals or other HubSpot data back into Claude.",
      ],
      sendingFaq("Claude"),
      priceFaq("Claude"),
      [
        "Claude or Claude Code?",
        "Either, with the same account. Claude on the web and desktop is the easiest start and needs no terminal. Claude Code suits you if you already work in a terminal, and it can run a routine that drafts reply answers on a schedule or when replies arrive.",
      ],
    ],
    sources: [docsSources.claudeConnectors],
    guide: { href: "/guides/claude-for-sales", label: "Claude connectors, explained" },
    docs: "/docs/claude",
  },

  chatgpt: {
    slug: "chatgpt",
    name: "ChatGPT",
    integration: "chatgpt",
    queries: `"chatgpt for sales" 140/mo, "can chatgpt send emails" 170 (rising), "chatgpt crm" 50-90, "chatgpt gmail integration" 90, "chatgpt for lead generation" 30 (DataForSEO, US, Nov 2026)`,
    title: "ChatGPT for Sales: Send Emails, Find Leads and Follow Up from ChatGPT | Meerko",
    description:
      "Can ChatGPT send emails? Yes, with the Meerko plugin: from your own Gmail or Outlook, each one approved by you. Find leads, run sequences and answer replies from a ChatGPT chat.",
    h1: "ChatGPT for sales: find leads, send emails and follow up from ChatGPT",
    lede: `Add the Meerko plugin and ChatGPT gets ${toolCount} tools for outbound: it finds the people you sell to, verifies their work emails, sends a sequence from your own Gmail or Outlook and drafts answers to every reply. You approve each email before it goes.`,
    cta: { label: "Get the ChatGPT plugin →", href: CHATGPT_PLUGIN_URL },
    question: "Can ChatGPT send emails?",
    answer:
      "Yes, through Meerko. With the Meerko plugin, ChatGPT sends from your own Gmail, Google Workspace, Outlook or IMAP mailbox, so emails sit in your Sent folder and replies land in your inbox. Each email waits for your approval before it goes, and sending stays inside the daily limit you set for the mailbox (50 by default).",
    only: [
      {
        title: "An official ChatGPT plugin",
        body: "Meerko is listed in ChatGPT's plugin directory: open it, connect, sign in. No URL to paste.",
      },
      {
        title: "Call it with @Meerko",
        body: "Type @ in any ChatGPT conversation and pick Meerko to point the request at it.",
      },
    ],
    setup: {
      title: "Connect Meerko to ChatGPT in three steps",
      sub: "From the plugin's listing in ChatGPT. Your plan and, on a work account, your workspace's policies decide which plugins you can add.",
      steps: [
        { title: "Open the plugin", body: "Open Meerko in ChatGPT's plugin directory and connect it.", link: { href: CHATGPT_PLUGIN_URL, label: "Open in ChatGPT" } },
        { title: "Sign in", body: "ChatGPT sends you to Meerko: continue with Google and click Allow. Your Meerko account is made here if you don't have one." },
        { title: "Ask", body: "In a new conversation, type @, pick Meerko and ask in plain language." },
      ],
    },
    alt: {
      title: "Prefer a custom MCP server?",
      body: "If your workspace only allows custom servers, add Meerko by URL under ChatGPT Plugins → + → Add custom MCP server, with OAuth.",
      link: { href: "/docs/chatgpt", label: "Custom MCP server setup" },
    },
    chat: {
      window: "CHATGPT — NEW CHAT",
      prompt: "@Meerko find 20 heads of growth at Series A fintechs in Spain and verify their emails.",
      tools: ["Find people", "Find and verify emails"],
      reply: "Found 20 and verified 17 work emails. Want me to write a 3-step sequence and show you a preview first?",
    },
    prompts: [
      {
        group: "Find leads",
        query: "Lead generation in ChatGPT",
        items: [
          "@Meerko read our website and set our ideal customer profile from it.",
          "@Meerko find 25 heads of growth at Series A fintechs in the US and get their emails.",
        ],
      },
      {
        group: "Send emails",
        query: "ChatGPT and your Gmail or Outlook",
        items: ["@Meerko connect my Gmail.", "Write a three-step sequence for them and show me the first email for each person. Don't start it yet."],
      },
      {
        group: "Replies",
        query: "ChatGPT reads the answers",
        items: ["Who replied this week? Draft answers to the interested ones.", "Approve the draft for Marta and discard the rest."],
      },
      {
        group: "Pipeline and CRM",
        query: "ChatGPT as your CRM, or next to HubSpot",
        items: ["How is my sequence doing?", "Show my pipeline and sync the contacted leads to HubSpot."],
      },
    ],
    faq: [
      [
        "Can ChatGPT send emails?",
        "Yes, with the Meerko plugin. ChatGPT writes the emails and Meerko sends them from your own Gmail, Google Workspace, Outlook or IMAP mailbox, inside a send window and a daily limit you set (50 by default). By default each email waits for your approval first.",
      ],
      [
        "Is there a ChatGPT Gmail integration for cold email?",
        "Meerko is one. Connect your Gmail or Google Workspace inbox to Meerko with an app password, and ChatGPT can send sequences from it: a first email and follow-ups in the same thread, which stop for anyone who replies. Outlook and Microsoft 365 connect with Sign in with Microsoft.",
      ],
      crmFaq("ChatGPT"),
      [
        "Can ChatGPT do lead generation?",
        "With Meerko it searches people and companies by job title, location, industry, company size and more, then finds and verifies their work emails. Search results and email lookups use credits; a miss costs nothing.",
      ],
      sendingFaq("ChatGPT"),
      priceFaq("ChatGPT"),
      [
        "How do I connect Meerko to ChatGPT?",
        "Open the Meerko plugin in ChatGPT's plugin directory, connect it, then sign in with Google and click Allow. In a conversation, type @ and pick Meerko. You can also add Meerko by URL as a custom MCP server, if your plan and workspace allow custom servers.",
      ],
    ],
    sources: [docsSources.chatgptMcp],
    guide: { href: "/guides/chatgpt-for-sales", label: "ChatGPT connectors, explained" },
    docs: "/docs/chatgpt",
  },
};
