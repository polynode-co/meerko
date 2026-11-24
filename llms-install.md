# Installing Meerko's MCP server (for AI agents)

You are an agent setting up Meerko for a user. **Connect to the hosted server. Do not clone this
repository, install dependencies or start Docker**: that is only for people who want to self-host,
and the user will say so if they do.

| | |
|---|---|
| Server URL | `https://api.meerko.ai/mcp` |
| Transport | Streamable HTTP (`streamableHttp`; some clients call it `http`) |
| Sign-in | OAuth 2.0 in the user's browser. The client discovers it from the server and registers itself; there is no API key to paste |
| Account | Anyone can sign up at <https://meerko.ai>. There is a free plan |

## Steps

1. Add a remote MCP server named `meerko` with the URL and transport above. Nothing to install or build.
2. Start the client's OAuth sign-in for that server. The user's browser opens; they sign in to Meerko
   (or create an account) and approve the connection.
3. Check it works: call the `whoami` tool. It answers with the user's account and workspace.

## Cline

**Cline CLI:**

```bash
cline mcp add meerko https://api.meerko.ai/mcp --transport http --yes
cline mcp   # choose "Authorize OAuth" for meerko; the browser opens
```

**Cline in an IDE:** MCP Servers → Remote Servers → Server Name `meerko`, Server URL
`https://api.meerko.ai/mcp`, Transport Type **Streamable HTTP** → Add Server. Or add it to
`cline_mcp_settings.json` (MCP Servers → Configure → Configure MCP Servers):

```json
{
  "mcpServers": {
    "meerko": {
      "type": "streamableHttp",
      "url": "https://api.meerko.ai/mcp"
    }
  }
}
```

Set `"type": "streamableHttp"` explicitly: without it Cline falls back to the legacy SSE transport.

## If the client can't sign in with OAuth

The server answers `401` until the client is signed in. If the client has no OAuth flow for remote
servers, use an API key instead. Ask the user to create one in the Meerko dashboard
(Connections → API keys; it starts with `mk_` and is shown once) and send it as a header. Never invent
a key, and don't write it anywhere but the client's MCP settings.

```json
{
  "mcpServers": {
    "meerko": {
      "type": "streamableHttp",
      "url": "https://api.meerko.ai/mcp",
      "headers": { "Authorization": "Bearer mk_..." }
    }
  }
}
```

Details: <https://meerko.ai/docs/api-keys>.

## Other clients

Claude Code: `claude mcp add --transport http --scope user meerko https://api.meerko.ai/mcp`, then
`/mcp` to sign in. Claude, ChatGPT, Cursor and Codex: <https://meerko.ai/docs/mcp-clients>.

## Good to know

- Anything that emails someone waits for the user's approval. Don't try to work around it.
- Finding and verifying leads spends credits; the `get_credits` tool shows the balance.
- Every tool is described in the [MCP tools reference](https://meerko.ai/docs/mcp-tools).
- Self-hosting (only if the user asks): <https://meerko.ai/docs/self-hosting>. The server is then at
  `http://localhost:8787/mcp`.
