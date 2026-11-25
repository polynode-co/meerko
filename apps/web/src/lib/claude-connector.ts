// Claude's add-connector form (claude.ai, any plan). With `connectorName` and `connectorUrl` it opens filled in, so the
// person only clicks Add. Every "Connect Claude to Meerko" link is built here, from the install's own MCP URL
// (lib/meerko.ts `addToClaudeUrl`), so a self-hosted install links its own server.

export const CLAUDE_CONNECTORS_URL = "https://claude.ai/customize/connectors";
export const CONNECTOR_NAME = "Meerko";

/** The add-connector form, prefilled with Meerko's name and this MCP server URL. */
export function claudeAddConnectorUrl(serverUrl: string): string {
  const u = new URL(CLAUDE_CONNECTORS_URL);
  u.searchParams.set("modal", "add-custom-connector");
  u.searchParams.set("connectorName", CONNECTOR_NAME);
  u.searchParams.set("connectorUrl", serverUrl);
  return u.toString();
}
