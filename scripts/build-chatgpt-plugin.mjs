#!/usr/bin/env node
/**
 * Build the ChatGPT plugin package: the ZIP that OpenAI's dashboard takes
 * (platform.openai.com → Plugins → "Upload new or existing plugin").
 *
 * The package is `plugin.json` (identity, listing, review test cases, publication), `mcp.json` (the one MCP server
 * and how it authenticates) and `assets/`. Tools are not in it: OpenAI scans them from the live server, so their
 * titles and hints live in packages/mcp/src/annotations.ts.
 *
 * The source is `chatgpt-app-submission.json`: `app_info` and the test cases are the listing and the review script,
 * `tools` records each tool's hints with the reason for each (apps/api/src/chatgpt-plugin.test.ts keeps it in step
 * with the server), and `plugin` holds the fields only the package has.
 *
 * Usage:
 *   node scripts/build-chatgpt-plugin.mjs                  # writes .tmp/meerko-chatgpt-plugin-<version>.zip
 *   node scripts/build-chatgpt-plugin.mjs --check          # validates only, exit 1 on a problem
 *   node scripts/build-chatgpt-plugin.mjs --check --ready  # also fails on what review needs and is still missing
 *   node scripts/build-chatgpt-plugin.mjs --version=1.0.1  # overrides plugin.version for one build
 *
 * The limits are the ones the submission guide states (https://developers.openai.com/plugins/deploy/submission).
 * The dashboard runs its own checks on upload as well; these catch the cheap mistakes first, like a Terms link
 * that 404s. A package can be uploaded as a draft before review has everything it needs (the demo recording), so
 * what is only needed to submit is a warning unless --ready is passed.
 *
 * Zero dependencies. Zipping uses the system `zip`.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(readFileSync(join(repoRoot, "chatgpt-app-submission.json"), "utf8"));
const checkOnly = process.argv.includes("--check");
const ready = process.argv.includes("--ready");
const versionArg = process.argv.find((a) => a.startsWith("--version="));

const { app_info: app, test_cases: positive, negative_test_cases: negative, plugin } = source;

const manifest = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  name: plugin.name,
  version: versionArg ? versionArg.slice("--version=".length) : plugin.version,
  description: app.description,
  author: { name: plugin.developerName, url: plugin.websiteURL },
  homepage: plugin.websiteURL,
  extensions: {
    "com.openai": {
      interface: {
        displayName: app.display_name,
        shortDescription: app.subtitle,
        longDescription: app.description,
        developerName: plugin.developerName,
        category: app.category,
        capabilities: [],
        websiteURL: plugin.websiteURL,
        supportURL: plugin.supportURL,
        privacyPolicyURL: plugin.privacyPolicyURL,
        termsOfServiceURL: plugin.termsOfServiceURL,
        defaultPrompt: plugin.defaultPrompt,
        brandColor: plugin.brandColor,
        brandColorDark: plugin.brandColorDark,
        // One logo for both themes: the meerkat's head has its own colours and reads on white and on #212121.
        logo: "./assets/logo.png",
        composerIcon: "./assets/logo.png",
      },
      review: {
        test_cases: {
          positive: positive.map((t) => ({
            description: t.description,
            prompt: t.user_prompt,
            tools_triggered: t.tools_triggered,
            expected_behavior: t.expected_output,
          })),
          // The description says why the plugin stays out and what happens instead: the package has no other field for it.
          negative: negative.map((t) => ({ description: `${t.description} Expected: ${t.expected_output}`, prompt: t.user_prompt })),
        },
        ...(plugin.demoRecordingURL ? { demo_recording_url: plugin.demoRecordingURL } : {}),
        // Nothing is sold in ChatGPT: no tool returns a price, a plan or a link to buy (see get_workspace).
        commerce: false,
      },
      publication: {
        countries: plugin.countries,
        release_notes: plugin.releaseNotes,
        translations: plugin.translations,
      },
    },
  },
};

// Meerko is its own OAuth authorization server, and clients register themselves (dynamic client registration), so
// there is no client id or secret to enter. The endpoints come from discovery on the server's 401.
const mcp = {
  $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  mcpServers: {
    [plugin.mcpServerName]: {
      type: "streamable-http",
      url: plugin.mcpServerURL,
      extensions: { "com.openai": { auth: { type: "oauth", client: { mode: "dcr" } } } },
    },
  },
};

// ── Checks ──────────────────────────────────────────────────────────────────
const problems = [];
const notReady = [];
const iface = manifest.extensions["com.openai"].interface;
const maxLen = (label, value, max) => {
  if (typeof value !== "string" || !value.trim()) problems.push(`${label} is empty`);
  else if (value.length > max) problems.push(`${label} is ${value.length} chars, max ${max}`);
};

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.name) || manifest.name.length > 64) {
  problems.push(`name "${manifest.name}" must be lowercase letters, numbers and single hyphens, max 64`);
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) problems.push(`version "${manifest.version}" is not semver`);
maxLen("description", manifest.description, 4000);
maxLen("displayName", iface.displayName, 30);
maxLen("shortDescription", iface.shortDescription, 30);
if (/\n/.test(iface.shortDescription ?? "")) problems.push("shortDescription must be one line");
maxLen("longDescription", iface.longDescription, 4000);
maxLen("developerName", iface.developerName, 80);
maxLen("category", iface.category, 80);

// The guide bars prices, free trials and discounts from listing text, and anything that sells from inside ChatGPT.
const SELLING = /\$\s?\d|€\s?\d|\d\s?(USD|EUR)\b|\bfree (trial|to start|tier|plan)\b|\bdiscount|\bper month\b|\ba month\b|\bupgrade\b|\bpricing\b/i;
const listingText = { shortDescription: iface.shortDescription, longDescription: iface.longDescription, release_notes: plugin.releaseNotes };
iface.defaultPrompt.forEach((p, i) => (listingText[`defaultPrompt[${i}]`] = p));
for (const [label, text] of Object.entries(listingText)) {
  const hit = SELLING.exec(text ?? "");
  if (hit) problems.push(`${label} mentions pricing ("${hit[0]}"), which listing text can't`);
}

// A meerko.ai URL must be a page the web app serves, and must not be one that sells.
const WEB_PAGES = join(repoRoot, "apps", "web", "src", "app");
for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
  const url = iface[key] || "";
  if (!/^https:\/\//.test(url) || url.length > 1024) {
    problems.push(`${key} must be an https URL of at most 1024 chars`);
    continue;
  }
  const { hostname, pathname, username } = new URL(url);
  if (username) problems.push(`${key} must not carry credentials`);
  if (hostname === "meerko.ai" && !existsSync(join(WEB_PAGES, pathname, "page.tsx"))) {
    problems.push(`${key} ${url} is not a page in apps/web/src/app`);
  }
  if (hostname === "meerko.ai" && /^\/pricing/.test(pathname)) problems.push(`${key} must not point at the pricing page`);
}

if (new Set(iface.defaultPrompt).size !== iface.defaultPrompt.length) problems.push("defaultPrompt entries must be unique");
if (iface.defaultPrompt.length > 3) problems.push("defaultPrompt has more than 3 entries");
iface.defaultPrompt.forEach((p, i) => {
  maxLen(`defaultPrompt[${i}]`, p, 128);
  if (/@\w/.test(p)) problems.push(`defaultPrompt[${i}] must not @mention an app`);
});

// Brand colours need 2:1 contrast: the light one against white, the dark one against #212121.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
for (const [key, against] of [["brandColor", "#FFFFFF"], ["brandColorDark", "#212121"]]) {
  const color = iface[key];
  if (!/^#[0-9A-Fa-f]{6}$/.test(color ?? "")) problems.push(`${key} must be #RRGGBB`);
  else if (contrast(color, against) < 2) problems.push(`${key} ${color} has ${contrast(color, against).toFixed(2)}:1 contrast against ${against}, needs 2:1`);
}

const review = manifest.extensions["com.openai"].review;
// The dashboard reads the cases from the package and takes exactly these counts, no more.
for (const [kind, want] of [["positive", 5], ["negative", 3]]) {
  const have = review.test_cases[kind].length;
  if (have !== want) problems.push(`review needs exactly ${want} ${kind} test cases, the package has ${have}`);
}
const toolNames = Object.keys(source.tools);
review.test_cases.positive.forEach((t, i) => {
  maxLen(`positive[${i}].description`, t.description, 4000);
  for (const key of ["prompt", "tools_triggered", "expected_behavior"]) {
    if (!t[key]) problems.push(`positive[${i}].${key} is required`);
  }
  for (const name of (t.tools_triggered ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!toolNames.includes(name)) problems.push(`positive[${i}] triggers "${name}", which is not a tool`);
  }
});
review.test_cases.negative.forEach((t, i) => {
  if (!t.description || !t.prompt) problems.push(`negative[${i}] needs a description and a prompt`);
});
if (plugin.demoRecordingURL == null) notReady.push("plugin.demoRecordingURL: review needs a video walkthrough of the test cases, at an https URL");
else if (!/^https:\/\//.test(plugin.demoRecordingURL)) problems.push("demoRecordingURL must be an https URL");

if (!Array.isArray(plugin.countries) || plugin.countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
  problems.push("countries must be uppercase ISO country codes ([] for no restriction)");
}
maxLen("releaseNotes", plugin.releaseNotes, 4000);
for (const [locale, t] of Object.entries(plugin.translations)) {
  if (t.subtitle != null) maxLen(`translations.${locale}.subtitle`, t.subtitle, 30);
  if (t.description != null) maxLen(`translations.${locale}.description`, t.description, 4000);
}

if (!/^https:\/\//.test(plugin.mcpServerURL ?? "")) problems.push("mcpServerURL must be an https URL");

const logoPath = join(repoRoot, plugin.logo);
if (!existsSync(logoPath)) problems.push(`logo ${plugin.logo} does not exist`);
else {
  const png = readFileSync(logoPath);
  if (png.subarray(1, 4).toString() !== "PNG") problems.push(`logo ${plugin.logo} is not a PNG`);
  else {
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    if (w !== h || w < 48 || w > 4096) problems.push(`logo must be square, 48-4096px; ${plugin.logo} is ${w}x${h}`);
  }
  if (png.length > 5 * 1024 * 1024) problems.push("logo is over 5 MiB");
}

if (ready) problems.push(...notReady.map((n) => `not ready to submit: ${n}`));
if (problems.length) {
  console.error(`ChatGPT plugin package has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
const pending = notReady.length ? `\nStill needed before it can be submitted for review:\n  - ${notReady.join("\n  - ")}` : "";
if (checkOnly) {
  console.log(`ChatGPT plugin package ${manifest.version}: OK${pending}`);
  process.exit(0);
}

// ── Build ───────────────────────────────────────────────────────────────────
const outDir = join(repoRoot, ".tmp", "chatgpt-plugin");
const zipPath = join(repoRoot, ".tmp", `meerko-chatgpt-plugin-${manifest.version}.zip`);
rmSync(outDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(join(outDir, "assets"), { recursive: true });
writeFileSync(join(outDir, "plugin.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(outDir, "mcp.json"), `${JSON.stringify(mcp, null, 2)}\n`);
copyFileSync(logoPath, join(outDir, "assets", "logo.png"));
execFileSync("zip", ["-r", "-X", "-q", zipPath, "plugin.json", "mcp.json", "assets"], { cwd: outDir });
console.log(`Wrote ${zipPath}${pending}`);
