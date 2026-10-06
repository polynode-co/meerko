// Every claim the site makes about another product lives here, with the page it came from.
// Re-check these when you touch them: prices and features change. Anything we can't source stays off the site.

export const CHECKED_ON = "6 Oct 2026";

/** Entry-level paid plans, billed monthly, as listed on each vendor's own pricing page. */
export const stackPrices = [
  { tool: "Clay", logo: "/logos/clay.png", job: "Tables & enrichment", plan: "Launch", price: 167, url: "https://www.clay.com/pricing" },
  { tool: "Instantly", logo: "/logos/instantly.png", job: "Sending", plan: "Outreach Growth", price: 47, url: "https://instantly.ai/pricing" },
  { tool: "HubSpot", logo: "/logos/hubspot.svg", job: "CRM", plan: "Sales Hub Starter, 1 seat", price: 20, url: "https://www.hubspot.com/pricing/sales" },
  { tool: "Zapier", logo: "/logos/zapier.svg", job: "Glue", plan: "Pro, 750 tasks", price: 29.99, url: "https://zapier.com/pricing" },
];

/** Each agent's own documentation for adding an MCP server. */
export const agentDocs: Record<string, string> = {
  "Claude Code": "https://code.claude.com/docs/en/mcp",
  Codex: "https://developers.openai.com/codex/mcp",
  Cursor: "https://cursor.com/docs/context/mcp",
  "Gemini CLI": "https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md",
  Windsurf: "https://docs.windsurf.com/windsurf/cascade/mcp",
};
