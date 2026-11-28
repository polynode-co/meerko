// Writes the Meerko plugin for Claude (Claude Code, and the Claude Directory's "Plugin bundle") from the MCP server's
// own workflows (packages/mcp/src/workflows.ts), the same source as the MCP prompts and the Perplexity plugin
// (scripts/perplexity-plugin.mts), so the three can't drift.
//   pnpm claude-plugin          regenerate integrations/claude-plugin/ and .claude-plugin/marketplace.json
//   pnpm claude-plugin --check  fail if either is out of date (apps/web's typecheck runs it)
//
// The layout is from Claude Code's plugin docs (https://code.claude.com/docs/en/plugins-reference and
// https://code.claude.com/docs/en/plugin-marketplaces) and the Claude Directory's checklist
// (https://claude.com/docs/plugins/pre-submission-checklist), checked 28 Nov 2026:
// - The plugin folder holds `.claude-plugin/plugin.json` (only `name` is required), `.mcp.json` and `skills/<name>/SKILL.md`.
//   It may be a subfolder of a repository: the Directory's form takes the repository and a plugin path.
// - The Directory blocks a plugin with no README of at least 40 words (outside code blocks) or no license, and a
//   remote MCP server without a `type` or an https:// URL. Secrets go in `userConfig`, never fixed headers: Meerko has
//   none, it signs in with OAuth.
// - No `version`: Claude Code then tracks commits (the source's SHA) instead of keeping users on a pinned string that
//   has to be raised with every release.
// - `/plugin marketplace add polynode-co/meerko` reads `.claude-plugin/marketplace.json` at the repository root, on the
//   default branch (`dev`). Its entry fetches the plugin from `main` with a `git-subdir` source, so what installs is
//   what's released, the same as meerko.ai.
// - `claude plugin validate --profile directory` also wants an icon (a square PNG of 512 to 2,048 px, which becomes
//   the listing's icon on the first submission only) and a privacy policy URL.
import { copyOf, DESCRIPTION, failOn, MCP_URL, type PluginFile, skillFile, WORKFLOWS, writeOrCheck } from "./plugin-files.mts";

const REPO = "polynode-co/meerko";
const FOLDER = "integrations/claude-plugin";
const author = { name: "Polynode Technologies, S.L.", url: "https://meerko.ai" };

const skill = (w: (typeof WORKFLOWS)[number]) =>
  skillFile(w, {
    // Claude Code namespaces plugin skills by the plugin, so this runs as /meerko:find-leads.
    name: w.name,
    descriptionSuffix: "Uses the Meerko MCP server.",
    toolsLine:
      "Use the tools of the Meerko MCP server. If they aren't available, ask me to sign in to Meerko first: in Claude Code, run /mcp, pick plugin:meerko:meerko and authenticate; in Claude, connect Meerko under Customize → Connectors.",
  });

const plugin = {
  name: "meerko",
  displayName: "Meerko",
  description: DESCRIPTION,
  author,
  homepage: "https://meerko.ai",
  repository: `https://github.com/${REPO}`,
  // MIT, like the clients (packages/mcp, sdk, cli) and unlike the AGPL server: the plugin is client config and skill
  // text, and its LICENSE is packages/mcp's.
  license: "MIT",
  // The Directory's listing shows these; each returned 200 on 28 Nov 2026. meerko.ai has no /contact page, so support
  // is the contact address the site already gives.
  privacyPolicyUrl: "https://meerko.ai/privacy",
  termsOfServiceUrl: "https://meerko.ai/terms",
  supportUrl: "mailto:contact@meerko.ai",
  documentationUrl: "https://meerko.ai/docs/claude-code",
  keywords: ["sales", "outbound", "lead-generation", "cold-email", "email-sequences", "crm", "mcp"],
};

const marketplace = {
  name: "meerko",
  owner: author,
  description: "Meerko's plugin for Claude Code: the Meerko MCP server and its sales workflows as skills.",
  plugins: [
    {
      name: plugin.name,
      // The full HTTPS URL: Claude Code clones an `owner/repo` shorthand over SSH, which fails without a GitHub SSH key.
      source: { source: "git-subdir", url: `https://github.com/${REPO}.git`, path: FOLDER, ref: "main" },
      description: DESCRIPTION,
      category: "sales",
      homepage: plugin.homepage,
    },
  ],
};

const readme = [
  "# Meerko plugin for Claude",
  "",
  "Meerko is the open-source outbound engine. This plugin gives Claude Code (and Claude, through the Claude Directory) the",
  "Meerko MCP server and five skills built on it, so you can find B2B leads, verify their work emails, send email sequences",
  "from your own Gmail or Outlook, and sort and answer the replies from a chat. By default every email waits for your approval.",
  "",
  "## Install in Claude Code",
  "",
  "```",
  `/plugin marketplace add ${REPO}`,
  "/plugin install meerko@meerko",
  "```",
  "",
  "Then run `/mcp`, pick `plugin:meerko:meerko` and authenticate: your browser opens Meerko's sign-in (continue with",
  "Google and click Allow). No API key is needed. If you already added the server with `claude mcp add`, Claude Code",
  "keeps that one, signed in already, and doesn't connect it twice.",
  "",
  "## What's in it",
  "",
  `- \`.mcp.json\`: Meerko's MCP server (${MCP_URL}), over HTTP, signed in with OAuth.`,
  ...WORKFLOWS.map((w) => `- \`/meerko:${w.name}\`: ${w.description}`),
  "",
  "The skills are the same workflows as the MCP server's prompts. They're generated by `pnpm claude-plugin` from",
  "`packages/mcp/src/workflows.ts`: edit that, not these files.",
  "",
  "Setup guide: https://meerko.ai/docs/claude-code. Privacy: https://meerko.ai/privacy. This plugin is MIT-licensed",
  "(`LICENSE`), like Meerko's MCP server package; the rest of the repository is AGPL-3.0.",
  "",
].join("\n");

const files: PluginFile[] = [
  { path: ".claude-plugin/plugin.json", content: `${JSON.stringify(plugin, null, 2)}\n` },
  // The icon the ChatGPT listing uses too (chatgpt-app-submission.json).
  { path: ".claude-plugin/icon.png", content: copyOf("docs/design/meerko-icon-512.png") },
  { path: ".mcp.json", content: `${JSON.stringify({ mcpServers: { meerko: { type: "http", url: MCP_URL } } }, null, 2)}\n` },
  { path: "LICENSE", content: copyOf("packages/mcp/LICENSE") },
  ...WORKFLOWS.map((w) => ({ path: `skills/${w.name}/SKILL.md`, content: skill(w) })),
  { path: "README.md", content: readme },
];

// ── What Claude Code and the Directory refuse ─────────────────────────────────
const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const readmeWords = readme.replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length;
failOn("Claude plugin", [
  ...[plugin.name, ...WORKFLOWS.map((w) => w.name)].filter((n) => !kebab.test(n)).map((n) => `"${n}" isn't kebab-case`),
  ...(marketplace.plugins[0].name !== plugin.name ? ["the marketplace entry's name differs from plugin.json's"] : []),
  ...(readmeWords < 40 ? [`README.md has ${readmeWords} words outside code blocks, min 40`] : []),
  ...(!MCP_URL.startsWith("https://") ? [`the MCP server URL ${MCP_URL} isn't https://`] : []),
  ...(!String(files.find((f) => f.path === "LICENSE")?.content).startsWith(`${plugin.license} License`)
    ? [`LICENSE isn't the ${plugin.license} license plugin.json names`]
    : []),
]);

writeOrCheck("Claude plugin", "pnpm claude-plugin", FOLDER, files, [
  { path: ".claude-plugin/marketplace.json", content: `${JSON.stringify(marketplace, null, 2)}\n` },
]);
