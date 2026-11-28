// The assistant landing pages, /claude, /chatgpt, /perplexity and /mistral: "Claude for sales", "ChatGPT for sales",
// the Perplexity plugin and the Mistral Vibe connector.
//
// Built the way Antwork's /automate/<client>/<platform> leaf pages are: few pages, each titled for the query people
// type, the setup and example prompts on the page, a connect call to action, and at least one fact that is true of
// that assistant and no other (`only`). If an assistant has nothing of its own to say, it doesn't get a page, and
// there is no page per assistant × feature pair: one page per assistant carries its CRM, Gmail and lead queries.
//
// Every number is read from the code: the tool count from the MCP server's reference, prices and credits from
// lib/pricing.ts. Facts about Claude, ChatGPT, Perplexity and Mistral Vibe themselves cite their makers' help pages
// (`sources`).

import { mcp, needsApproval } from "@/lib/docs";
import { addToClaudeUrl } from "@/lib/meerko";
import { PERPLEXITY_PLUGIN_GITHUB, PERPLEXITY_PLUGIN_ZIP, PLUGIN_SKILLS_GITHUB } from "@/lib/perplexity-plugin";
import { FREE_CREDITS, proPrices } from "@/lib/pricing";
import { docsSources } from "@/lib/sources";

export interface Source {
  label: string;
  url: string;
}

export type AssistantSlug = "claude" | "chatgpt" | "perplexity" | "mistral";

/** Mistral Vibe, formerly Le Chat. */
const MISTRAL_VIBE_URL = "https://chat.mistral.ai";

/** Meerko's listing in ChatGPT's plugin directory. */
export const CHATGPT_PLUGIN_URL = "https://chatgpt.com/plugins/plugin_asdk_app_6b0463cf58c081919496d0d2f27ecaf0";

const toolCount = mcp.tools.length;
const emailToolCount = mcp.tools.filter(needsApproval).length;
/** The Perplexity plugin's skills: one per MCP prompt (scripts/perplexity-plugin.mts). */
const skillCount = mcp.prompts.length;

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
  setup: { title: string; sub: string; steps: SetupStep[]; after?: string; afterLink?: { href: string; label: string } };
  /** A second way in, under the main setup (Claude Code, or ChatGPT's custom MCP server). */
  alt: { title: string; body: string; command?: string; link: { href: string; label: string } };
  /** The chat shown in the hero: an illustration, not a recording. */
  chat: { window: string; prompt: string; tools: string[]; reply: string };
  prompts: { group: string; query: string; items: string[] }[];
  faq: [string, string][];
  sources: Source[];
  /** Our guide to the assistant's connectors, where there is one. */
  guide?: { href: string; label: string };
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
    cta: { label: "Connect Claude to Meerko →", href: addToClaudeUrl() },
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
          body: "The button above opens Claude's Add custom connector form with Meerko's name and URL already filled in. Or go to Customize → Connectors, click + Add, then Add custom connector.",
          link: { href: addToClaudeUrl(), label: "Open in Claude" },
        },
        {
          title: "Paste the URL",
          body: "The form opened from here comes filled in: click Add and keep the detected OAuth sign-in. Opened it yourself? Name it Meerko and paste the server URL.",
          copyUrl: true,
        },
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
    cta: { label: "Connect ChatGPT to Meerko →", href: CHATGPT_PLUGIN_URL },
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

  perplexity: {
    slug: "perplexity",
    name: "Perplexity",
    integration: "perplexity",
    queries: `"perplexity mcp" 880/mo (KD 19), "perplexity mcp server" 170 (KD 10), "perplexity connectors" 140 (KD 13, rising), "perplexity plugins" 30-70 (rising); "perplexity for sales" and "perplexity crm" show no volume (DataForSEO, US, Nov 2026)`,
    title: "Perplexity MCP Plugin for Sales: Find Leads and Send Sequences | Meerko",
    description: `Upload the Meerko plugin to Perplexity: Meerko's MCP server plus ${skillCount} skills to find and verify leads, send sequences from your own Gmail or Outlook with your approval, and answer replies.`,
    h1: "The Meerko MCP plugin for Perplexity: find leads, send sequences and follow up",
    lede: `Upload the Meerko plugin and Perplexity gets ${toolCount} tools and ${skillCount} skills for outbound: it finds the people you sell to, verifies their work emails, sends a sequence from your own Gmail or Outlook and drafts answers to every reply. You approve each email before it goes.`,
    cta: { label: "Download the Perplexity plugin →", href: PERPLEXITY_PLUGIN_ZIP },
    question: "Can Perplexity find leads and send emails?",
    answer: `Yes, with the Meerko plugin. Perplexity gets Meerko's ${toolCount} tools to find and verify leads, send sequences from your own Gmail, Google Workspace or Outlook inbox, detect replies and track the pipeline, plus ${skillCount} skills that walk it through each job. By default each email waits for your approval before it goes.`,
    only: [
      {
        title: "A plugin you upload",
        body: `One zip brings Meerko's connector and ${skillCount} skills: find leads, first customers, write a sequence, triage replies and pipeline.`,
        source: docsSources.perplexityPlugins,
      },
      {
        title: "Pick it with /",
        body: "Select the Meerko plugin with / in a chat, and Perplexity loads only its skills.",
        source: docsSources.perplexityPlugins,
      },
      {
        title: "Or import it from GitHub",
        body: "The plugin is a public folder in Meerko's open-source repo, so you can read every file, then import it from there.",
      },
    ],
    setup: {
      title: "Add Meerko to Perplexity in four steps",
      sub: "Plugins with skills need a Perplexity plan that includes Computer. On an organization account, uploading also needs the Upload or create personal plugins and skills permission, which an admin turns on in Roles & Permissions.",
      steps: [
        {
          title: "Download the plugin",
          body: "A zip with the plugin's manifest, Meerko's MCP server and its skills. Keep it zipped.",
          link: { href: PERPLEXITY_PLUGIN_ZIP, label: "Download the zip" },
        },
        { title: "Upload it", body: "In Perplexity, open Plugins, click Add custom (top right) and choose Upload plugin or skill. Drop the zip in and click Submit." },
        {
          title: "Connect Meerko",
          body: "Open the Meerko plugin and click Connect. Perplexity sends you to Meerko: continue with Google and click Allow. Your Meerko account is made here if you don't have one.",
        },
        { title: "Ask", body: "In a chat, type / and pick Meerko, then ask in plain language." },
      ],
      after: "Or skip the download: under Add custom, choose Import plugin from GitHub and paste the URL of the plugin's folder in Meerko's repo.",
      afterLink: { href: PERPLEXITY_PLUGIN_GITHUB, label: "The plugin on GitHub" },
    },
    alt: {
      title: "No plugins on your plan?",
      body: "Add Meerko as a custom remote connector with the server URL and OAuth sign-in. You get the same tools, without the skills.",
      link: { href: "/docs/mcp-clients#perplexity", label: "Custom connector setup" },
    },
    chat: {
      window: "PERPLEXITY — NEW THREAD",
      prompt: "Using Meerko, find 20 heads of growth at Series A fintechs in Spain and verify their emails.",
      tools: ["Find people", "Find and verify emails"],
      reply: "Found 20 and verified 17 work emails. They're in a table called “Fintech growth, Spain”. Want a 3-step sequence for them?",
    },
    prompts: [
      {
        group: "Find leads",
        query: "Lead generation in Perplexity",
        items: [
          "Read our website and find our first 10 customers.",
          "Find 30 heads of sales at B2B SaaS companies in Germany with 50 to 200 employees, and verify their work emails.",
        ],
      },
      {
        group: "Send emails",
        query: "Perplexity and your Gmail or Outlook",
        items: ["Connect my Gmail to Meerko.", "Write a 3-step sequence for that table and show me a preview. Don't start it yet."],
      },
      {
        group: "Replies",
        query: "Perplexity reads the answers",
        items: ["Go through my new replies, label each one, and draft answers for the people who are interested.", "Show me the drafts waiting for me."],
      },
      {
        group: "Pipeline and CRM",
        query: "Perplexity as your CRM, or next to HubSpot",
        items: ["Give me my pipeline: who replied, who booked, and the 3 things I should do next.", "Sync the contacted leads to HubSpot."],
      },
    ],
    faq: [
      [
        "How do I add Meerko to Perplexity?",
        "Download the Meerko plugin from this page. In Perplexity, open Plugins, click Add custom, choose Upload plugin or skill, drop the zip in and click Submit. Then open the plugin, click Connect and sign in to Meerko with Google. You can also import the plugin from GitHub instead of uploading it.",
      ],
      [
        "Which Perplexity plan do I need?",
        "Perplexity says plugins with skills need a plan that includes Perplexity Computer. On an organization account, you also need the permission to upload personal plugins. Without a plugin, you can add Meerko as a custom remote connector: the same tools, without the skills.",
      ],
      [
        "What's in the plugin?",
        `A plugin.json with its name and description, an mcp.json that points at Meerko's MCP server, and ${skillCount} skills, one per Meerko workflow, made from the same source as Meerko's MCP prompts. There's no API key or fixed header in it: you sign in with OAuth when you click Connect. All of it is in Meerko's public GitHub repo.`,
      ],
      crmFaq("Perplexity"),
      sendingFaq("Perplexity"),
      priceFaq("Perplexity"),
    ],
    sources: [docsSources.perplexityPlugins, docsSources.perplexityConnectors],
    docs: "/docs/mcp-clients#perplexity",
  },

  mistral: {
    slug: "mistral",
    name: "Mistral Vibe",
    integration: "mistral",
    queries: `"mistral mcp", "mistral mcp server", "mistral connectors", "mistral vibe connectors", "mistral vibe mcp", "le chat mcp" and "le chat connectors" 10/mo each (no KD); the volume is in the brand, "mistral vibe" 1,300 (KD 48) and "le chat mistral" 2,400 (KD 53, falling since March); "mistral for sales" shows none (DataForSEO, US, Nov 2026)`,
    title: "Mistral Vibe MCP Connector (Le Chat) for Sales: Find Leads and Send Sequences | Meerko",
    description:
      "Add Meerko to Mistral Vibe, formerly Le Chat, as a custom MCP connector: find and verify leads, send sequences from your own Gmail or Outlook with your approval, and answer replies.",
    h1: "The Meerko MCP connector for Mistral Vibe: find leads, send sequences and follow up",
    lede: `Add Meerko as a custom connector and Mistral Vibe, formerly Le Chat, gets ${toolCount} tools for outbound: it finds the people you sell to, verifies their work emails, sends a sequence from your own Gmail or Outlook and drafts answers to every reply. You approve each email before it goes.`,
    cta: { label: "Add Meerko to Mistral Vibe →", href: MISTRAL_VIBE_URL },
    question: "Can Mistral Vibe connect to an MCP server?",
    answer: `Yes. Mistral Vibe, which was called Le Chat, adds remote MCP servers as custom connectors. Add Meerko's server URL and Vibe gets ${toolCount} tools to find and verify leads, send sequences from your own Gmail, Google Workspace or Outlook inbox, detect replies and track the pipeline. By default each email waits for your approval before it goes.`,
    only: [
      {
        title: "Auto-detect finds the sign-in",
        body: "Leave Authentication Method on Auto-detect: Vibe finds Meerko's OAuth and sends you to sign in. No API key to paste.",
        source: docsSources.mistralConnectors,
      },
      {
        title: "You're the admin on Free and Pro",
        body: "Mistral lets admins add custom connectors. On Free, Pro and Student plans the account owner is the admin, so you can add Meerko yourself.",
        source: docsSources.mistralConnectors,
      },
      {
        title: "Meerko's skills fit Vibe's Skills",
        body: `Vibe's Skills use SKILL.md files, the format of Meerko's ${skillCount} skills: find leads, first customers, write a sequence, triage replies and pipeline.`,
        source: docsSources.mistralSkills,
      },
    ],
    setup: {
      title: "Connect Meerko to Mistral Vibe in four steps",
      sub: "In Mistral Vibe on the web, at chat.mistral.ai.",
      steps: [
        {
          title: "Open Connectors",
          body: "In the left sidebar, open Context, then Connectors. Click New connector (top right) and choose Add custom connector.",
          link: { href: MISTRAL_VIBE_URL, label: "Open Mistral Vibe" },
        },
        {
          title: "Fill in the details",
          body: "Server: paste the URL below. Title: Meerko. The description is optional, for example: Find leads, verify emails and send sequences from your own mailbox.",
          copyUrl: true,
        },
        {
          title: "Sign in",
          body: "Leave Authentication Method on Auto-detect and click Add connector. Vibe sends you to Meerko: continue with Google and click Allow. Your Meerko account is made here if you don't have one.",
        },
        { title: "Ask", body: "In a new chat, ask in plain language, for example: find 5 CTOs at fintechs in Spain." },
      ],
      after:
        "Under Connectors, the tabs are My connectors, Shared with me and All. A connector that still needs sign-in shows under Needs attention with a warning icon: click it to finish signing in. On first open, Vibe may show a New Connectors, powered by MCP dialog; View Connectors leads to the same page.",
    },
    alt: {
      title: "Add Meerko's skills too",
      body: `Mistral's docs put Skills under Context → Skills: click New Skill, give it a title and description, and paste the SKILL.md. Meerko's ${skillCount} skills are plain SKILL.md files in its public repo, the same ones as in the Perplexity plugin. Once saved, call one with / in a chat.`,
      link: { href: PLUGIN_SKILLS_GITHUB, label: "The skills on GitHub" },
    },
    chat: {
      window: "MISTRAL VIBE — NEW CHAT",
      prompt: "Find 20 heads of growth at Series A fintechs in Spain and verify their emails.",
      tools: ["Find people", "Find and verify emails"],
      reply: "Found 20 and verified 17 work emails. They're in a table called “Fintech growth, Spain”. Want a 3-step sequence for them?",
    },
    prompts: [
      {
        group: "Find leads",
        query: "Lead generation in Mistral Vibe",
        items: [
          "Read our website and set our ideal customer profile from it.",
          "Find 30 heads of sales at B2B SaaS companies in France with 50 to 200 employees, and verify their work emails.",
        ],
      },
      {
        group: "Send emails",
        query: "Mistral Vibe and your Gmail or Outlook",
        items: ["Connect my Gmail to Meerko.", "Write a 3-step sequence for that table and show me a preview. Don't start it yet."],
      },
      {
        group: "Replies",
        query: "Vibe reads the answers",
        items: ["Go through this week's replies, label each one, and draft answers for the people who are interested.", "Show me the drafts waiting for me."],
      },
      {
        group: "Pipeline and CRM",
        query: "Mistral Vibe as your CRM, or next to HubSpot",
        items: ["Who replied this week, who booked a meeting, and what's waiting on me?", "Sync the contacted leads to HubSpot."],
      },
    ],
    faq: [
      [
        "How do I add an MCP server to Mistral Vibe?",
        "In the left sidebar, open Context, then Connectors. Click New connector and choose Add custom connector. Paste Meerko's server URL, title it Meerko, leave Authentication Method on Auto-detect and click Add connector. Then continue with Google on Meerko's page and click Allow.",
      ],
      [
        "Is Mistral Vibe the same as Le Chat?",
        "Yes. Mistral's assistant at chat.mistral.ai was called Le Chat and is now Mistral Vibe. Guides to Le Chat's connectors describe the same feature, though the menus have moved: connectors now sit under Context in the sidebar.",
      ],
      [
        "Who can add a connector in Mistral Vibe?",
        "Mistral says adding custom MCP connectors is for admins. On the Free, Pro and Student plans the account owner is the admin, so you can add Meerko yourself. On a team, ask your workspace admin.",
      ],
      [
        "Can Mistral Vibe use Meerko's skills?",
        `Mistral's docs say Vibe's Skills are SKILL.md files, made under Context → Skills → New Skill. Meerko's ${skillCount} skills are SKILL.md files in its public GitHub repo: paste one in, and with the connector added, Vibe can follow it. You don't need them: the connector alone gives Vibe every tool.`,
      ],
      crmFaq("Mistral Vibe"),
      [
        "Does Mistral Vibe send emails without asking?",
        "No. By default the Meerko workspace holds every sequence email and reply draft until you approve it, whatever the assistant does. Vibe also lets you choose, tool by tool, which ones run without asking (Always allow, in the connector's Functions tab). You can switch Meerko's approvals off later, in Connections.",
      ],
      priceFaq("Mistral Vibe"),
    ],
    sources: [docsSources.mistralConnectors, docsSources.mistralSkills],
    docs: "/docs/mcp-clients#mistral",
  },
};

/** "Connect Claude to Meerko" and "Connect ChatGPT to Meerko": the pages' main buttons, also on the landing page and in the app. */
export const connectCtas = [assistantPages.claude.cta, assistantPages.chatgpt.cta];
