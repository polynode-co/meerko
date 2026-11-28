// The Meerko plugin for Claude Code, as the site tells people to install it. `pnpm claude-plugin` writes the plugin to
// integrations/claude-plugin/ and its marketplace to .claude-plugin/marketplace.json (scripts/claude-plugin.mts);
// claude-plugin.test.ts keeps these commands in step with that marketplace.
import { site } from "./site";

/** The marketplace is this repository; the plugin and the marketplace are both named `meerko`. */
export const CLAUDE_PLUGIN_REPO = "polynode-co/meerko";
export const CLAUDE_PLUGIN_ID = "meerko@meerko";

/** Typed inside Claude Code. */
export const CLAUDE_PLUGIN_SLASH_COMMANDS = [`/plugin marketplace add ${CLAUDE_PLUGIN_REPO}`, `/plugin install ${CLAUDE_PLUGIN_ID}`];

/** The same from a shell. */
export const CLAUDE_PLUGIN_SHELL_COMMAND = `claude plugin marketplace add ${CLAUDE_PLUGIN_REPO} && claude plugin install ${CLAUDE_PLUGIN_ID}`;

/** The plugin's folder in the public repo, which the Claude Directory's plugin path points at. `main` is what's released. */
export const CLAUDE_PLUGIN_GITHUB = `${site.githubUrl}/tree/main/integrations/claude-plugin`;

/** How Claude Code names a plugin's MCP server: plugin:<plugin>:<server>. */
export const CLAUDE_PLUGIN_SERVER = "plugin:meerko:meerko";
