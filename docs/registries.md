# MCP registry listings

Meerko's hosted MCP server is `https://api.meerko.ai/mcp` (Streamable HTTP, sign-in with OAuth). This page has the
listing copy and the steps to list it on each registry. Nothing here publishes by itself: every step below is done by
hand by a maintainer.

Checked against each registry's own docs on 2026-11-24. They change often, so read the linked page again before
publishing.

| Registry | File in this repo | State | What is left |
|---|---|---|---|
| [Official MCP Registry](#official-mcp-registry) | `server.json` | Not published | Add a DNS record on `meerko.ai`, then `mcp-publisher publish` |
| [Glama](#glama) | `glama.json` | Not listed | Arrives by itself from the official registry; then claim it and add a test account |
| [PulseMCP](#pulsemcp) | none | Not listed | Nothing to do: submissions are paused and it reads the official registry |
| [Smithery](#smithery) | none | Not listed | Nothing to do: it no longer takes submissions |

The official registry goes first. Glama and PulseMCP both read from it, so one publish feeds three listings.

## Listing copy

Taken from the README and the ChatGPT listing (`chatgpt-app-submission.json`). Use it wherever a registry asks for
these fields, so every listing says the same thing.

| Field | Value |
|---|---|
| Name | Meerko |
| Registry name | `ai.meerko/meerko` |
| One-liner (96 characters; the official registry allows 100) | Find leads, verify work emails, send sequences from your own inbox and draft answers to replies. |
| Subtitle (where there is one) | Find leads, send cold email |
| Server URL | `https://api.meerko.ai/mcp` |
| Transport | Streamable HTTP |
| Authentication | OAuth: the client opens a browser and you sign in to Meerko. No API key to paste |
| Website | https://meerko.ai |
| Docs | https://meerko.ai/docs |
| Tool reference | https://meerko.ai/docs/mcp-tools |
| Source | https://github.com/polynode-co/meerko (the server is `packages/mcp`) |
| License | AGPL-3.0; the client packages (`packages/sdk`, `packages/cli`, `packages/mcp`) are MIT |
| Privacy policy | https://meerko.ai/privacy |
| Terms | https://meerko.ai/terms |
| Icon | https://meerko.ai/meerko-icon.svg (SVG), or `docs/design/meerko-icon-512.png` to upload |
| Publisher | Polynode Technologies, S.L. |
| Maintainer (GitHub) | `iker-gonzalez` |

**Description:**

> Meerko is an open-source outbound engine that your AI agent runs for you. Tell the agent who you sell to and it uses
> Meerko to find the right companies and people, find and verify their work emails, and write a short email sequence.
> Meerko sends it from your own Gmail, Google Workspace, Outlook or any IMAP/SMTP mailbox, inside a send window and
> daily limits that keep your domain healthy, and stops writing to anyone who replies.
>
> Replies come back to the agent: Meerko handles bounces, unsubscribe requests and out-of-office replies on its own,
> and the agent sorts the rest (interested, question, not now) and drafts an answer for each one. Each draft waits for
> your approval before it goes.
>
> You need a Meerko account, which you create when you connect, and a mailbox connected in Meerko to send from. The
> code is AGPL-3.0, so you can also run the whole thing yourself.

**Example prompts:**

- "Find 25 heads of growth at Series A fintechs in the US and get their emails."
- "Write a three-step sequence for them and show me the first email for each person."
- "Who replied this week? Draft answers to the interested ones."
- "How is my sequence doing?"

**Categories:** Sales, or Marketing where there is no Sales category. On a registry with one general bucket,
Productivity (the ChatGPT listing uses it).

**Tags:** `sales`, `outbound`, `cold-email`, `lead-generation`, `email-outreach`, `email-sequences`,
`sales-automation`, `ai-agents`, `open-source`, `self-hosted`.

## Official MCP Registry

Docs: [quickstart](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx),
[remote servers](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx),
[authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx),
[versioning](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/versioning.mdx).

`server.json` at the repo root describes the hosted server in the `2025-12-11` schema: one `remotes` entry and no
`packages`, because nothing is installed from npm.

### The namespace: `ai.meerko/meerko`

The name's namespace decides how the publisher proves ownership. We use the domain namespace, `ai.meerko`, which is
proved with a record on `meerko.ai`:

- The registry's docs recommend it when the server's URL is on a domain you control, so the name and the URL visibly
  belong to the same publisher.
- Glama then lets us claim the listing by verifying `meerko.ai`, which also covers anything else we publish under it.
- The GitHub alternative, `io.github.polynode-co/meerko`, is harder than it looks: `mcp-publisher login github` cannot
  publish to an organization namespace today
  ([registry#1468](https://github.com/modelcontextprotocol/registry/issues/1468)). It needs an organization Owner's
  personal access token with `read:org`, or a GitHub Actions workflow publishing over OIDC.

**The proof publishing needs:** a TXT record on the apex of `meerko.ai` (not on a subdomain such as
`_mcp-auth.meerko.ai`) holding the public half of a key pair, and the private half on the machine that runs
`mcp-publisher login dns`. The same key can be served from `https://meerko.ai/.well-known/mcp-registry-auth` instead
(`login http`); that needs a web deploy and must answer `200` with no redirect, so DNS is the simpler one.

### Publish

Who: someone who can edit the DNS of `meerko.ai`.

1. Install the publisher: `brew install mcp-publisher`.
2. Make a key pair **outside this repo** and keep `key.pem` somewhere safe (a password manager or a secret store);
   every later publish needs it. macOS's own `openssl` is LibreSSL and has no Ed25519, so use OpenSSL 3
   (`brew install openssl@3`):

   ```bash
   OPENSSL=/opt/homebrew/opt/openssl@3/bin/openssl
   $OPENSSL genpkey -algorithm Ed25519 -out key.pem
   echo "meerko.ai. IN TXT \"v=MCPv1; k=ed25519; p=$($OPENSSL pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)\""
   ```

3. Add the TXT record it prints to the apex of `meerko.ai`, next to the SPF and Google records that are already there
   (a domain can have several TXT records; don't replace them). Wait until `dig TXT meerko.ai +short` shows it.
4. From the repo root, on the commit that is live in production:

   ```bash
   mcp-publisher validate            # checks server.json, publishes nothing
   MCP_PRIVATE_KEY="$($OPENSSL pkey -in key.pem -noout -text | sed -n '/priv:/,/pub:/p' | sed '1d;$d' | tr -d ' :\n')" \
     mcp-publisher login dns --domain meerko.ai
   mcp-publisher publish
   ```

5. Check it is there:
   `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=ai.meerko/meerko"`.

The registry is in preview and says its data may be reset before general availability; if the listing disappears,
publish again.

### Update the listing later

A published version can't be edited. To change the title, description, icon or URL, raise `version` in `server.json`
(`1.0.1`, `1.1.0`…), merge, and repeat step 4. The version is the listing's own: it doesn't track a package.
`apps/api/src/registries.test.ts` fails if the URL, the name or the length limits drift.

To rotate the key, add the new TXT record next to the old one, log in with the new key, then delete the old record. A
record left in DNS keeps working for whoever holds its private key, so remove a leaked key's record straight away.

## Glama

Docs: [FAQ](https://glama.ai/mcp/faq) (submit a connector, claim a connector, list a connector that requires
authentication), [glama.json schema](https://glama.ai/mcp/schemas/server.json),
[connector schema](https://glama.ai/mcp/schemas/connector.json).

Glama has two directories, and Meerko belongs in both:

- **Connectors**: hosted servers. This is the listing for `https://api.meerko.ai/mcp`. Glama imports every Streamable
  HTTP server from the official registry hourly, with no review, so it needs no submission once we are published there.
- **Servers**: servers people run from a GitHub repository. `glama.json` at the repo root names the GitHub users who
  may maintain that listing (`iker-gonzalez`); Glama asks for it when an organization owns the repository, as
  `polynode-co` does.

### Steps

Who: `iker-gonzalez`, signed in to glama.ai.

1. Publish to the official registry (above) and wait about an hour. Find Meerko under
   [Connectors](https://glama.ai/mcp/connectors). To list it sooner, or without the registry, use **Add Server →
   Hosted endpoint** there with the name, the one-liner and the URL; that route is reviewed by hand.
2. On the connector's page choose **Claim ownership** and verify the domain `meerko.ai`. Glama shows a claim token
   (`glama_claim_…`, tied to the Glama account, not secret). Publish it one of two ways:
   - a TXT record at `_glama-claim.meerko.ai`, or
   - `https://meerko.ai/.well-known/glama.json` containing
     `{"$schema": "https://glama.ai/mcp/schemas/connector.json", "claim": "glama_claim_…"}`. This would be a new file
     under `apps/web/public/.well-known/` and a web deploy.

   Leave it in place: Glama checks daily and removes access seven days after the token goes missing.
3. Open **Admin → Test Profile**, set the authentication type to **OAuth 2.0**, click **Authenticate with OAuth** and
   sign in as a dedicated test account with no real data and no mailbox connected. Without it Glama's hourly health
   check gets a `401` and shows the server as unhealthy. The check only lists tools, prompts and resources; it calls
   no tool.
4. Under **Manage connector**, set the categories and thumbnail (Glama keeps those itself). The name, description and
   URL keep syncing from the official registry unless you turn on "Use Glama listing details as the source of truth".
5. For the Servers directory: on [Servers](https://glama.ai/mcp/servers) click **Add MCP Server** and give the
   repository URL, the name and the one-liner. With `glama.json` on the default branch (`dev`), `iker-gonzalez` can
   then edit the listing under **Admin → Listing**.

## PulseMCP

[pulsemcp.com/submit](https://www.pulsemcp.com/submit) says submissions and changes to listings are paused, with no
date for reopening, and that the way in is the official MCP Registry: "we will pick it up automatically once we are
back". No repo file, no form, no account.

1. Publish to the official registry (above).
2. Once that page says they are back, search pulsemcp.com for Meerko. If it isn't there, use whatever the page offers
   then.

## Smithery

Smithery is now part of Arcade. Its [announcement](https://smithery.ai/future) says the hosted proxy, accounts, API
keys, CLI and SDKs stopped on 2026-10-31, and that smithery.ai stays as a public directory of "a curated set of
verified servers" that shows each server's own URL. There is no sign-up, no submit form and no publishing docs left, so
a `smithery.yaml` would do nothing and this repo has none.

Nothing to do. If a submission route comes back, the copy above is what to use; the only contact the announcement
gives is its author's address, on that page.
