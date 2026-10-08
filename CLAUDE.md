@AGENTS.md

# Meerko

Open-source GTM agent: pnpm + Turborepo monorepo (`apps/api` Hono API, `apps/web` Next.js site and
dashboard, `apps/worker`, `packages/{db,core,sdk,cli,mcp}`), deployed to GCP with Terraform
(`terraform/dev`, `terraform/prd`, shared module `terraform/app`).

## Branches and deploys

Same model as antwork.io:

| Branch | Environment | Deploys |
|---|---|---|
| `dev` | `the dev project` (dev.meerko.ai, api-dev.meerko.ai) | **Manually**: dev takes many merges a day, and few are a request to see something running |
| `main` | `the prd project` (meerko.ai, api.meerko.ai) | **On every push**, path-filtered per service |

Deploy dev when you want to see it:

```
(the dev deploy command is in the maintainers' private runbook)
(the dev deploy command is in the maintainers' private runbook)
```

**Promote by fast-forward only**: run the `promote` workflow (Actions → promote, type `promote`), or
`git push origin origin/dev:refs/heads/main`. **Never open a pull request from `dev` into `main`**: it
puts a merge commit on `main` that `dev` doesn't have, and every later fast-forward is rejected.
`verify.yml` fails such PRs. If `main` has diverged anyway: `git checkout dev && git merge origin/main
&& git push origin dev`, confirm `git rev-parse dev^{tree}` didn't change, then promote.

Migrations don't run on deploy. Run them against the dev or prd database before deploying a commit
that adds one (docs/DEPLOY.md); a migration that drops something goes after the code that stops
using it.

## Making a change

1. `./scripts/new-worktree.sh feat/<thing>`: a new branch from `origin/dev` in
   `.claude/worktrees/`, with `.env` linked and dependencies installed from the pnpm store.
2. Work and commit there. Run `pnpm typecheck` and the tests for the packages you touched.
3. Push, open a PR into `dev` (`gh pr create --base dev`), and merge it once it's green.
4. `git worktree remove .claude/worktrees/<slug>` after the merge.

## This tree is shared

Several sessions share this checkout, one `.git` and one HEAD. If any session runs `git checkout`,
every other session's next commit lands on *that* branch.

- `.githooks/pre-commit` refuses commits on `dev` and `main` (`ALLOW_COMMIT_ON_TRUNK=1` overrides).
  It can't catch a peer switching to *their* feature branch: check `git branch --show-current`
  before each commit.
- Beyond a quick edit, work in a worktree (above), and leave this tree clean.
- `pnpm install` sets `core.hooksPath`, `merge.autoStash` and `rebase.autoStash` (the `prepare`
  script), so a pull re-applies local edits instead of aborting.
