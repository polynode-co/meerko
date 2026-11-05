// Every claim the site makes about another product lives here, with the page it came from.
// Re-check these when you touch them: prices and features change. Anything we can't source stays off the site.

export const CHECKED_ON = "5 Nov 2026";

/** Entry-level paid plans, billed monthly, as listed on each vendor's own pricing page. */
export const stackPrices = [
  { tool: "Clay", logo: "/logos/clay.png", job: "Tables & enrichment", plan: "Launch", price: 185, url: "https://www.clay.com/pricing" },
  { tool: "Instantly", logo: "/logos/instantly.png", job: "Sending", plan: "Growth", price: 47, url: "https://instantly.ai/pricing" },
  { tool: "HubSpot", logo: "/logos/hubspot.svg", job: "CRM", plan: "Sales Hub Starter, 1 seat", price: 20, url: "https://www.hubspot.com/pricing/sales" },
  { tool: "Zapier", logo: "/logos/zapier.svg", job: "Glue", plan: "Professional, 750 tasks", price: 29.99, url: "https://zapier.com/pricing" },
];

/** Each agent's own documentation for adding an MCP server. */
export const agentDocs: Record<string, string> = {
  "Claude Code": "https://code.claude.com/docs/en/mcp",
  Codex: "https://developers.openai.com/codex/mcp",
  Cursor: "https://cursor.com/docs/context/mcp",
  Grok: "https://docs.x.ai/grok/connectors",
};

/** Clay, for /alternatives/clay. Only what Clay's own pages say. */
export const claySources = {
  pricing: { label: "Clay pricing", url: "https://www.clay.com/pricing" },
  globalInbox: { label: "Clay University: Global Inbox", url: "https://university.clay.com/lessons/global-inbox" },
};

/** For /gtm-engineer. Attributed claims ("Clay says…") are what each source states. */
export const gtmSources = {
  clay: { label: "Clay: GTM Engineering: What It Is, How It Works, and How to Hire", url: "https://www.clay.com/blog/gtm-engineering" },
  apollo: { label: "Apollo: Who Is a GTM Engineer and What Skills Do They Need?", url: "https://www.apollo.io/insights/who-is-a-gtm-engineer-and-what-skills-do-they-need" },
  cargo: { label: "Cargo: GTM Engineer Salary (published 20 Jul 2026)", url: "https://www.getcargo.ai/blog/gtm-engineer-salary" },
};

/** Google, for the deliverability guides. */
export const googleSources = {
  gmailLimits: { label: "Gmail Help: Limits for sending & getting mail", url: "https://support.google.com/mail/answer/22839" },
  workspaceLimits: {
    label: "Google Workspace: Gmail sending limits in Google Workspace",
    url: "https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace",
  },
  senderGuidelines: { label: "Gmail Help: Email sender guidelines", url: "https://support.google.com/a/answer/81126" },
};

/** US law on commercial email. */
export const ftcCanSpam = { label: "FTC: CAN-SPAM Act: A Compliance Guide for Business", url: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business" };

/** Apollo and Instantly, for /alternatives. Only what their own pricing pages state. */
export const apolloSources = { pricing: { label: "Apollo pricing", url: "https://www.apollo.io/pricing" } };
export const instantlySources = { pricing: { label: "Instantly pricing", url: "https://instantly.ai/pricing" } };

/** Reply.io, lemlist, Smartlead and Hunter, for /alternatives and /compare. Each vendor's own pricing page, checked 5 Nov 2026. */
export const replySources = { pricing: { label: "Reply.io pricing", url: "https://reply.io/pricing/" } };
export const lemlistSources = { pricing: { label: "lemlist pricing", url: "https://www.lemlist.com/pricing" } };
export const smartleadSources = { pricing: { label: "Smartlead pricing", url: "https://www.smartlead.ai/pricing" } };
export const hunterSources = { pricing: { label: "Hunter pricing", url: "https://hunter.io/pricing" } };

/** For /docs: the setup steps that depend on other products. */
export const docsSources = {
  claudeCodeMcp: { label: "Claude Code docs: Connect Claude Code to tools via MCP", url: "https://code.claude.com/docs/en/mcp" },
  claudeConnectors: { label: "Claude Help: Getting started with custom connectors using remote MCP", url: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp" },
  chatgptMcp: { label: "OpenAI Apps SDK: Connect from ChatGPT", url: "https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" },
  codexMcp: { label: "OpenAI Codex docs: Model Context Protocol", url: "https://developers.openai.com/codex/mcp" },
  cursorMcp: { label: "Cursor docs: Model Context Protocol", url: "https://cursor.com/docs/context/mcp" },
  geminiMcp: { label: "Gemini CLI docs: MCP servers", url: "https://geminicli.com/docs/tools/mcp-server/" },
  enableApis: { label: "Google Workspace: Enable Google Workspace APIs", url: "https://developers.google.com/workspace/guides/enable-apis" },
  refreshExpiry: { label: "Google: Using OAuth 2.0, refresh token expiration", url: "https://developers.google.com/identity/protocols/oauth2#expiration" },
  icypeas: { label: "Icypeas", url: "https://www.icypeas.com" },
  firecrawl: { label: "Firecrawl Alexandria", url: "https://docs.firecrawl.dev/features/alexandria" },
  generect: { label: "Generect API", url: "https://docs.generect.com/api-reference/introduction" },
};

/** For /integrations/gmail and /integrations/outlook: what each mail product's own help pages say about mail merge. */
export const mailMergeSources = {
  gmail: { label: "Gmail Help: Send personalized emails with mail merge", url: "https://support.google.com/mail/answer/12921167" },
  word: { label: "Microsoft Support: Use mail merge to send bulk email messages", url: "https://support.microsoft.com/en-us/office/use-mail-merge-to-send-bulk-email-messages-0f123521-20ce-4aa8-8b62-ac211dedefa4" },
};
