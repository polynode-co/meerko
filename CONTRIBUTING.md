# Contributing

Thanks for helping. Meerko is a pnpm + Turborepo monorepo; the [README](README.md) has the layout and the
[self-hosting guide](https://meerko.ai/docs/self-hosting) gets a local copy running.

- **Branches:** work from `dev`, open pull requests into `dev`. `main` is the released code and only moves forward from `dev`.
- **Checks:** run `pnpm typecheck` and `pnpm test`. Database tests (`*.db.test.ts`) need `DATABASE_URL` pointing at a
  throwaway Postgres; they clear tables.
- **MCP tools and CLI commands:** the docs' reference is generated from them. After changing one, run `pnpm docs:reference`.
- **Docs:** they're pages under `apps/web/src/app/docs`. Claims about the product have to match the code.
- **Commits:** one change per commit, with a message that says what it does and why.

By contributing you agree your work is licensed under [AGPL-3.0](LICENSE), like the rest of the project.
