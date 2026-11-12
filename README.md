<h1 align="center">Meerko</h1>
<p align="center"><b>The open-source GTM agent.</b> Always on the lookout for your next customer.</p>

Meerko is an agent-native outbound engine for GTM engineers. You drive it from your terminal or from your coding agent (Claude Code, Cursor, Codex) over MCP:

> *"Create a table of Series A fintech CTOs in Spain, enrich their emails, write a 3-step sequence and start it."*

**Status:** early. Tables and AI columns, lead search and email finding, sequences from Gmail, Outlook and IMAP mailboxes, the reply inbox, Slack and agent notifications, the `meerko` CLI and the MCP server work today.

**Docs:** setup, self-hosting, concepts and the full MCP and CLI reference live on the site under `/docs` (source: `apps/web/src/app/docs`).

## Quick start (self-hosted)

**With Docker only:**

```bash
git clone --branch main https://github.com/polynode-co/meerko meerko && cd meerko
cp .env.example .env    # set MEERKO_ENCRYPTION_KEY (openssl rand -base64 32) to send email
docker compose -f docker-compose.selfhost.yml up -d --build
docker compose -f docker-compose.selfhost.yml run --rm tools packages/core/src/seed.ts   # prints an API key (mk_...)
```

The dashboard is on http://localhost:3000 (sign in with the API key) and the API on http://localhost:8787.

**From source** (Node 20+, pnpm and Docker for Postgres):

```bash
git clone --branch main https://github.com/polynode-co/meerko meerko && cd meerko
pnpm install
cp .env.example .env
pnpm db:up          # Postgres on localhost:54329
pnpm db:migrate
pnpm db:seed        # prints an API key (mk_...)
pnpm dev            # API on :8787, the worker, and the dashboard on http://localhost:3000
```

Log in to the dashboard with the API key. To send email, set `MEERKO_ENCRYPTION_KEY` in `.env` (`openssl rand -base64 32`) and connect a mailbox from Connections: Gmail, Zoho, Fastmail or any IMAP/SMTP server with an app password, or Outlook with your own Microsoft Entra app. Google OAuth is only needed for "Sign in with Google"; to let people sign in with an emailed link instead, set `MEERKO_SMTP_URL` and `MEERKO_MAIL_FROM` (any SMTP server). The [self-hosting guide](https://meerko.ai/docs/self-hosting) walks through each, and through running everything in Docker instead (`docker-compose.selfhost.yml`).

### CLI

```bash
pnpm meerko login                                  # opens your browser to sign in (or: --key mk_... without browser sign-in)
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

ChatGPT, Grok, Codex and Cursor connect the same way, by URL. Without Google or email sign-in configured, send an API key instead: `--header "Authorization: Bearer mk_..."`. The server also runs locally over stdio: `claude mcp add meerko -- npx tsx /absolute/path/to/meerko/packages/mcp/src/index.ts` (it uses the CLI's saved login).

- **Tools:** tables and rows, lead search and enrichment, mailboxes, sequences, replies and drafts, pipeline and credits (32 in all; your agent lists them).
- **Commands (MCP prompts):** `find-leads`, `write-sequence`, `triage-replies`, `pipeline`. In Claude Code they appear as `/mcp__meerko__find-leads` and so on. Anything that emails someone waits for your OK.
- **Slack:** Meerko posts new replies and your agent's drafts to a channel. With the Meerko Slack app each draft has Approve and Discard buttons (only workspace members can press them) and `/meerko` shows what's waiting; a pasted incoming webhook works too, posts only. See the [docs](https://meerko.ai/docs/slack).
- **Autopilot:** routines your own AI runs, when replies arrive or on a schedule. Meerko starts each run through a Claude Code routine or any webhook (or checks your AI's own scheduler did), hands the AI its brief through `start_routine_run`, and shows every run, including the ones that didn't happen. An agent woken for replies connects to `/mcp/drafter` (or uses a drafts-only API key), which can read replies and save drafts but never send. See the [docs](https://meerko.ai/docs/wake-your-agent).

## Analytics

A self-hosted install sends no analytics: everything below is off unless you set a PostHog key (`.env.example`).

Meerko Cloud uses [PostHog](https://posthog.com) (EU cloud), with one project per environment created by Terraform (`apps/meerko/app/posthog.tf` in core-infrastructure):

- **Web:** pageviews, clicks, session replays (inputs and dashboard data masked) and errors (`apps/web/src/instrumentation-client.ts`).
- **API:** product events such as `sign_up`, `leads_searched` and `sequence_started` (`apps/api/src/analytics.ts`), and unexpected errors.
- **MCP:** the hosted `/mcp` uses [PostHog MCP Analytics](https://posthog.com/docs/mcp-analytics) (`@posthog/mcp`): every tool call with its arguments, result, duration, client and the intent the agent states. It adds `context`, `conversation_id` and `llm_model` arguments to each tool, which the docs reference leaves out. The stdio server does the same only when `POSTHOG_API_KEY` is set.

## Repository layout

| Path | What it is |
|---|---|
| `apps/api` | Hono REST API (`/v1`, bearer API-key auth) |
| `apps/worker` | Background worker: sends due emails and scans for replies |
| `apps/web` | Site, docs and dashboard (Next.js + Tailwind v4) — `pnpm --filter @meerko/web dev`, then open http://localhost:3000 |
| `packages/db` | Drizzle schema and migrations (Postgres) |
| `packages/core` | Domain logic: tables and enrichment, sending and replies, sign-in and OAuth, billing |
| `packages/sdk` | Typed HTTP client shared by the CLI and MCP server |
| `packages/cli` | The `meerko` CLI (alias `mk`) |
| `packages/mcp` | MCP server for coding agents |

Run checks with `pnpm typecheck` and `pnpm test`. The docs' MCP and CLI reference is generated from `packages/mcp` and `packages/cli`: after changing a tool or command, run `pnpm docs:reference` (the web typecheck fails while it's stale).

## License

[AGPL-3.0](LICENSE). The client packages (`packages/sdk`, `packages/cli`, `packages/mcp`) are [MIT](packages/sdk/LICENSE), so
they can be embedded anywhere. Contributions are signed off under the DCO ([CONTRIBUTING.md](CONTRIBUTING.md)).
