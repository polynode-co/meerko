#!/usr/bin/env bash
#
# Create an isolated worktree for one session's work, on a new branch from dev.
#
#   ./scripts/new-worktree.sh feat/my-thing
#   ./scripts/new-worktree.sh fix/my-thing --from origin/main
#
# Why: several Claude Code sessions share this checkout, and it has one HEAD. When any session runs
# `git checkout`, every other session's next commit lands on that branch instead of its own. A
# worktree has its own HEAD, so a checkout elsewhere can't reach it.
#
# Dependencies: `pnpm install --offline` links packages from the pnpm store, so a fresh worktree is
# ready in seconds without downloading anything. Re-run it after dependencies change.
#
# .env is gitignored, so it's symlinked from the main checkout.

set -euo pipefail

branch=${1:-}
base=origin/dev
if [ "${2:-}" = "--from" ] && [ -n "${3:-}" ]; then base=$3; fi

if [ -z "$branch" ]; then
  echo "usage: $0 <branch-name> [--from <base-ref>]" >&2
  echo "example: $0 feat/mailbox-rotation" >&2
  exit 1
fi

root=$(git rev-parse --show-toplevel)
cd "$root"

slug=$(printf '%s' "$branch" | tr '/' '-')
wt=".claude/worktrees/$slug"

if [ -e "$wt" ]; then
  echo "error: $wt already exists. Remove it first: git worktree remove $wt" >&2
  exit 1
fi

echo "fetching ..."
git fetch origin --quiet

echo "creating worktree $wt on $branch (from $base) ..."
git worktree add -b "$branch" "$wt" "$base"

if [ -f .env ]; then
  ln -s ../../../.env "$wt/.env"
  echo "linked .env"
fi

echo "installing dependencies from the pnpm store ..."
(cd "$wt" && pnpm install --offline --frozen-lockfile --silent) || echo "offline install failed; run 'pnpm install' inside the worktree" >&2

# Each worktree needs its own ports, or a second dev server dies with EADDRINUSE. Offset by how many
# worktrees exist. The API reads PORT from the environment before .env, so PORT=... wins.
n=$(git worktree list | wc -l | tr -d ' ')
web=$(( 3000 + n ))
api=$(( 8787 + n ))

cat <<MSG

  ready: $wt

    cd $wt
    PORT=$api MEERKO_PUBLIC_URL=http://localhost:$api pnpm --filter @meerko/api dev
    MEERKO_API_URL=http://localhost:$api pnpm --filter @meerko/web exec next dev -p $web

  when your PR has merged into dev:

    git worktree remove $wt

MSG
