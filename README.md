<h1 align="center">Meerko</h1>
<p align="center"><b>The open-source GTM agent.</b> Always on the lookout for your next customer.</p>

Meerko is an agent-native outbound engine for GTM engineers. You drive it from your terminal or from your coding agent (Claude Code, Cursor, Codex) over MCP:

> *"Create a table of Series A fintech CTOs in Spain, enrich their emails, write a 3-step sequence and start it."*

**Status:** early. Tables, CSV import, filtering, the `meerko` CLI and the MCP server work today. Enrichment, the email sequencer and the reply inbox come next. See [docs/PLAN.md](docs/PLAN.md).

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
pnpm meerko login --key mk_...
pnpm meerko tables create "Fintech CTOs Spain"
pnpm meerko tables import <tableId> leads.csv      # unknown headers become columns
pnpm meerko tables rows <tableId> --filter '{"country":"Spain"}'
pnpm meerko --json tables ls                       # machine-readable output for agents
```

### Use from Claude Code (MCP)

```bash
claude mcp add meerko -e MEERKO_API_KEY=mk_... -e MEERKO_API_URL=http://localhost:8787 \
  -- npx tsx /absolute/path/to/meerko/packages/mcp/src/index.ts
```

Tools: `list_tables`, `create_table`, `add_column`, `import_rows`, `query_rows`.

## Repository layout

| Path | What it is |
|---|---|
| `apps/api` | Hono REST API (`/v1`, bearer API-key auth) |
| `packages/db` | Drizzle schema and migrations (Postgres) |
| `packages/core` | Domain logic: tables, column inference, API keys |
| `packages/sdk` | Typed HTTP client shared by the CLI and MCP server |
| `packages/cli` | The `meerko` CLI (alias `mk`) |
| `packages/mcp` | MCP server for coding agents |
| `ee/` | Future enterprise features (commercial license) |

Run checks with `pnpm typecheck` and `pnpm test`.

## License

Everything outside `ee/` is [AGPL-3.0](LICENSE). The `ee/` directory is under a separate commercial license ([ee/LICENSE](ee/LICENSE)).
