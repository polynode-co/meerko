<h1 align="center">Meerko</h1>
<p align="center"><b>The open-source GTM agent.</b> Always on the lookout for your next customer.</p>

Meerko is an agent-native outbound engine for GTM engineers. You drive it from your terminal or from your coding agent (Claude Code, Cursor, Codex) over MCP:

> *"Create a table of Series A fintech CTOs in Spain, enrich their emails, write a 3-step sequence and start it."*

**Status:** early. Tables and AI columns, lead search and email finding, sequences from Gmail, the reply inbox, the `meerko` CLI and the MCP server work today. See [docs/PLAN.md](docs/PLAN.md).

**Docs:** setup, self-hosting, concepts and the full MCP and CLI reference live on the site under `/docs` (source: `apps/web/src/app/docs`).

## Quick start (self-hosted)

Requires Node 20+, pnpm and Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up          # Postgres on localhost:54329
pnpm db:migrate
pnpm db:seed        # prints an API key (mk_...)
pnpm --filter @meerko/api dev   # API on http://localhost:8787
```

### CLI

```bash
pnpm meerko login                                  # opens your browser to sign in (or: --key mk_... without Google sign-in)
pnpm meerko tables create "Fintech CTOs Spain"
pnpm meerko tables import <tableId> leads.csv      # unknown headers become columns
pnpm meerko tables rows <tableId> --filter '{"country":"Spain"}'
pnpm meerko --json tables ls                       # machine-readable output for agents
```

### Use from Claude Code (MCP)

The API serves the MCP server at `/mcp`, and agents sign in with OAuth (your browser opens; no API key):

```bash
claude mcp add --transport http --scope user meerko http://localhost:8787/mcp
# then run /mcp in Claude Code and authenticate
```

Codex, Cursor and Gemini CLI connect the same way, by URL. Without Google sign-in configured, send an API key instead: `--header "Authorization: Bearer mk_..."`. The server also runs locally over stdio: `claude mcp add meerko -- npx tsx /absolute/path/to/meerko/packages/mcp/src/index.ts` (it uses the CLI's saved login).

- **Tools:** tables and rows, lead search and enrichment, mailboxes, sequences, replies and drafts, pipeline and credits (32 in all; your agent lists them).
- **Commands (MCP prompts):** `find-leads`, `write-sequence`, `triage-replies`, `pipeline`. In Claude Code they appear as `/mcp__meerko__find-leads` and so on. Anything that emails someone waits for your OK.

## Repository layout

| Path | What it is |
|---|---|
| `apps/api` | Hono REST API (`/v1`, bearer API-key auth) |
| `apps/worker` | Background worker: sends due emails and scans for replies |
| `apps/web` | Site, docs and dashboard (Next.js + Tailwind v4) — `pnpm --filter @meerko/web dev`, then open http://localhost:3000 |
| `packages/db` | Drizzle schema and migrations (Postgres) |
| `packages/core` | Domain logic: tables, column inference, API keys |
| `packages/sdk` | Typed HTTP client shared by the CLI and MCP server |
| `packages/cli` | The `meerko` CLI (alias `mk`) |
| `packages/mcp` | MCP server for coding agents |
| `ee/` | Future enterprise features (commercial license) |

Run checks with `pnpm typecheck` and `pnpm test`. The docs' MCP and CLI reference is generated from `packages/mcp` and `packages/cli`: after changing a tool or command, run `pnpm docs:reference` (the web typecheck fails while it's stale).

## License

Everything outside `ee/` is [AGPL-3.0](LICENSE). The `ee/` directory is under a separate commercial license ([ee/LICENSE](ee/LICENSE)).
