<p align="center"><a href="https://meerko.ai"><img src="docs/readme-banner.jpg" alt="Meerko, the open-source GTM agent: the outbound engine for your AI agent. Works in Claude and ChatGPT, sends from your own inbox, MCP, CLI and API, open source under AGPL-3.0."></a></p>

<h1 align="center">Meerko</h1>
<p align="center"><b>The open-source GTM agent.</b> Always on the lookout for your next customer.</p>
<p align="center"><a href="https://glama.ai/mcp/connectors/ai.meerko/meerko"><img src="https://glama.ai/mcp/connectors/ai.meerko/meerko/badges/score.svg" alt="Meerko MCP connector on Glama"></a> <a href="https://glama.ai/mcp/servers/polynode-co/meerko"><img src="https://glama.ai/mcp/servers/polynode-co/meerko/badges/score.svg" alt="Meerko MCP server on Glama"></a> <a href="https://mcpservers.org/servers/polynode-co/meerko"><img src="https://mcpservers.org/badge.svg" alt="Listed on mcpservers.org"></a></p>

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

On Meerko Cloud the server is `https://api.meerko.ai/mcp`: nothing to build. An agent installing Meerko for you should read [`llms-install.md`](llms-install.md).

ChatGPT, Grok, Codex and Cursor connect the same way, by URL. Without Google or email sign-in configured, send an API key instead: `--header "Authorization: Bearer mk_..."`. The server also runs locally over stdio: `claude mcp add meerko -- npx tsx /absolute/path/to/meerko/packages/mcp/src/index.ts` (it uses the CLI's saved login).

- **Tools:** workspaces, tables and rows, lead search, ICP and enrichment, mailboxes, sequences, replies and drafts, pipeline and CRM sync, credits and routines. Your agent lists them all; the [MCP tools reference](https://meerko.ai/docs/mcp-tools) describes each one and keeps the count.
- **Commands (MCP prompts):** `find-leads`, `write-sequence`, `triage-replies`, `pipeline`. In Claude Code they appear as `/mcp__meerko__find-leads` and so on. Anything that emails someone waits for your OK.
- **Slack:** Meerko posts new replies and your agent's drafts to a channel. With the Meerko Slack app each draft has Approve and Discard buttons (only workspace members can press them) and `/meerko` shows what's waiting; a pasted incoming webhook works too, posts only. See the [docs](https://meerko.ai/docs/slack).
- **Autopilot:** routines your own AI runs, when replies arrive or on a schedule. Meerko starts each run through a Claude Code routine or any webhook (or checks your AI's own scheduler did), hands the AI its brief through `start_routine_run`, and shows every run, including the ones that didn't happen. An agent woken for replies connects to `/mcp/drafter` (or uses a drafts-only API key), which can read replies and save drafts but never send. See the [docs](https://meerko.ai/docs/wake-your-agent).

## Data sources, legal basis and opt-out

Meerko returns named people's work emails, so here is where they come from and how a person opts out. The same facts are on [meerko.ai/privacy](https://meerko.ai/privacy#recipients).

- **Sources.** Lead search and email finding run on [Icypeas](https://www.icypeas.com), a B2B data provider. A data provider a workspace connects with its own API key (on Pro, or self-hosted) also finds emails or phone numbers for that workspace. Users can also import their own leads (a CSV, say). Meerko keeps no database of people of its own: it stores only the leads a user's searches and imports put into their workspace, until they delete them or close their account.
- **Legal basis.** The Meerko user who holds the leads, and sends the emails, is the controller of that data; on Meerko Cloud, Polynode Technologies, S.L. processes it on their instructions. B2B prospecting relies on the sender's legitimate interest (GDPR Art. 6(1)(f)), and a person can object to it at any time (Art. 21). A self-hosted install is run by whoever hosts it.
- **If you're listed.** To be removed at the source, use [Icypeas's opt-out form](https://www.icypeas.com/opt-out). To ask a Meerko user about the data they hold on you, contact them, or write to contact@meerko.ai and we'll pass your request on.
- **If you got an email sent through Meerko.** Every sequence email ends with an unsubscribe link and carries a one-click `List-Unsubscribe` header (`packages/core/src/sending/sender.ts`). Either one puts your address on the sending workspace's do-not-email list: its sequences to you stop at once, and from any of its mailboxes it can't put you in another sequence or send you a reply. Replying stops that workspace's sequences to you, and a short opt-out reply ("unsubscribe", "remove me", in English, Spanish, French or German; `packages/core/src/replies/classify.ts`) also puts you on the list.

## Analytics

A self-hosted install sends no analytics: everything below is off unless you set a PostHog key (`.env.example`).

Meerko Cloud uses [PostHog](https://posthog.com) (EU cloud), with one project per environment created by Terraform (`apps/meerko/app/posthog.tf` in core-infrastructure):

- **Web:** pageviews, clicks, session replays (inputs and dashboard data masked) and errors (`apps/web/src/instrumentation-client.ts`).
- **API:** product events such as `sign_up`, `leads_searched` and `sequence_started` (`apps/api/src/analytics.ts`), and unexpected errors.
- **MCP:** the hosted `/mcp` uses [PostHog MCP Analytics](https://posthog.com/docs/mcp-analytics) (`@posthog/mcp`): every tool call with its arguments, result, duration and client. Its injected `context`, `conversation_id` and `llm_model` arguments are turned off, so every tool's schema is the one in the docs reference. The stdio server does the same only when `POSTHOG_API_KEY` is set.

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
