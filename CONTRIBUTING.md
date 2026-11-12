# Contributing

Thanks for helping. Meerko is a pnpm + Turborepo monorepo; the [README](README.md) has the layout and the
[self-hosting guide](https://meerko.ai/docs/self-hosting) gets a local copy running.

- **Branches:** work from `dev`, open pull requests into `dev`. `main` is the released code and only moves forward from `dev`.
- **Checks:** run `pnpm typecheck` and `pnpm test`. Database tests (`*.db.test.ts`) need `DATABASE_URL` pointing at a
  throwaway Postgres; they clear tables.
- **MCP tools and CLI commands:** the docs' reference is generated from them. After changing one, run `pnpm docs:reference`.
- **Docs:** they're pages under `apps/web/src/app/docs`. Claims about the product have to match the code.
- **Commits:** one change per commit, with a message that says what it does and why.

- **Surfaces:** the dashboard, MCP server, CLI and REST API do the same things through `/v1`. A change to one updates
  its row in `apps/api/src/surfaces/capabilities.ts`.

## Sign-off

Meerko uses the [Developer Certificate of Origin](https://developercertificate.org/): sign off every commit with
`git commit -s`, which adds a `Signed-off-by: Your Name <you@example.com>` line. It certifies you wrote the change, or
otherwise have the right to submit it under the project's licence.

## Licence

Contributions are licensed like the code they change: [AGPL-3.0](LICENSE) for the project, and [MIT](packages/sdk/LICENSE)
for the client packages `packages/sdk`, `packages/cli` and `packages/mcp`.

Please follow the [code of conduct](CODE_OF_CONDUCT.md).
