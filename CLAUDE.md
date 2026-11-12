@AGENTS.md

# Meerko

Open-source GTM agent: pnpm + Turborepo monorepo (`apps/api` Hono API, `apps/web` Next.js site and
dashboard, `apps/worker`, `packages/{db,core,sdk,cli,mcp}`). Self-hosting runs from `docker-compose.selfhost.yml`.
Meerko Cloud's infrastructure and deploy runbook are kept privately by the maintainers, outside this repo.

## Branches and releases

| Branch | What it is |
|---|---|
| `dev` | Where work lands: every pull request goes into `dev` |
| `main` | Released code. Meerko Cloud deploys from it |

**Releases are daily**: the `promote` workflow fast-forwards `main` to `dev` on its own at 20:00
Madrid time, shipping whatever merged that day. A hotfix doesn't wait: merge it to `dev`, then run
`promote` by hand (Actions → promote, type `promote`); it ships everything else on `dev` too, so
hold a risky PR unmerged until it's ready. **Promote by fast-forward only**. **Never open a pull request from `dev` into `main`**: it
puts a merge commit on `main` that `dev` doesn't have, and every later fast-forward is rejected.
`verify.yml` fails such PRs. If `main` has diverged anyway: `git checkout dev && git merge origin/main
&& git push origin dev`, confirm `git rev-parse dev^{tree}` didn't change, then promote.

Migrations run on deploy: the API's build applies pending ones after the tests pass and before the new revision
takes traffic, so merging a PR with a migration needs no manual step, and the 20:00 promote migrates production. A
failed migration fails the deploy and the old revision keeps serving. Keep migrations idempotent and
backwards-compatible with the code still running (add columns with defaults, backfill in SQL); one that drops
something goes after the code that stops using it. The web app deploys separately, so it must not need a column the
API hasn't migrated yet.

## Making a change

1. `./scripts/new-worktree.sh feat/<thing>`: a new branch from `origin/dev` in
   `.claude/worktrees/`, with `.env` linked and dependencies installed from the pnpm store.
2. Work and commit there. Run `pnpm typecheck` and the tests for the packages you touched.
3. Push, open a PR into `dev` (`gh pr create --base dev`), and merge it once it's green. Sign off each commit
   (`git commit -s`, CONTRIBUTING.md).
4. `git worktree remove .claude/worktrees/<slug>` after the merge.

## Surface parity

The dashboard, the MCP server, the CLI and the public REST API do the same things. They're all clients of `/v1`:
logic goes in `packages/core` behind a `/v1` route, and each surface calls it through `@meerko/sdk` (the hosted MCP
in-process). No surface talks to the database or core directly, so there's no second engine to keep in sync.

- Every `/v1` route has an entry in `apps/api/src/v1/spec.ts` (request and response schemas, who may call it). The
  route validates with that schema, and `pnpm api:spec` builds `apps/web/public/openapi.json` and `/docs/api` from it.
- `apps/api/src/surfaces/capabilities.ts` says, for each capability, where each surface offers it, or why it doesn't
  (`deliberately_absent`), or that it hasn't caught up yet (`missing`). Adding a route, MCP tool, CLI command or web
  server action means updating its row in the same PR. A `missing` cell is a gap to close, not a place to park
  something.
- The gate: `pnpm typecheck` (includes `docs:reference --check` and `api:spec --check`) and
  `pnpm --filter @meerko/api test` (`spec.test.ts`, `capabilities.test.ts`). The API deploy runs both.

## This tree is shared

Several sessions share this checkout, one `.git` and one HEAD. If any session runs `git checkout`,
every other session's next commit lands on *that* branch.

- `.githooks/pre-commit` refuses commits on `dev` and `main` (`ALLOW_COMMIT_ON_TRUNK=1` overrides).
  It can't catch a peer switching to *their* feature branch: check `git branch --show-current`
  before each commit.
- Beyond a quick edit, work in a worktree (above), and leave this tree clean.
- `pnpm install` sets `core.hooksPath`, `merge.autoStash` and `rebase.autoStash` (the `prepare`
  script), so a pull re-applies local edits instead of aborting.
