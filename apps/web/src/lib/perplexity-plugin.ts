// The Meerko plugin for Perplexity, as meerko.ai serves it. The files come from apps/web/src/generated/perplexity-plugin.json,
// which `pnpm perplexity-plugin` writes from the MCP server's workflows next to the copy in integrations/perplexity-plugin/.
import plugin from "../generated/perplexity-plugin.json";
import { site } from "./site";

/** Where meerko.ai serves the zip (app/downloads/meerko-perplexity-plugin.zip/route.ts). */
export const PERPLEXITY_PLUGIN_ZIP = "/downloads/meerko-perplexity-plugin.zip";

/** The plugin's folder in the public repo, for Perplexity's Import plugin from GitHub. `main` is what's released. */
export const PERPLEXITY_PLUGIN_GITHUB = `${site.githubUrl}/tree/main/integrations/perplexity-plugin`;

/** The plugin's skills folder, which Mistral Vibe's Skills reuse (/mistral). */
export const PLUGIN_SKILLS_GITHUB = `${PERPLEXITY_PLUGIN_GITHUB}/skills`;

/** The plugin's files, with mcp.json pointing at `mcpUrl` (this install's MCP server) instead of Meerko Cloud's. */
export function perplexityPluginFiles(mcpUrl: string): { path: string; content: string }[] {
  return plugin.files.map((f) => (f.path === "mcp.json" ? { ...f, content: f.content.replace(plugin.mcpUrl, mcpUrl) } : f));
}
