import { mcpUrl } from "@/lib/meerko";
import { perplexityPluginFiles } from "@/lib/perplexity-plugin";
import { zip } from "@/lib/zip";

// The plugin zip for Perplexity's "Upload plugin or skill" (/perplexity). Zipped per request from the generated files,
// so nothing binary is committed, and at request time so mcp.json carries this install's MCP URL (a runtime setting).
export const dynamic = "force-dynamic";

export function GET() {
  const body = zip(perplexityPluginFiles(mcpUrl()));
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="meerko-perplexity-plugin.zip"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
