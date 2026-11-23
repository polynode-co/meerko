#!/usr/bin/env bash
# Checks the promote gate: .github/workflows/promote.yml ships to production only when a
# maintainer runs it by hand and types "promote". Nothing else may start it, so a release never
# goes out on its own (the 20:00 schedule was removed on 2026-11-23).
set -euo pipefail
cd "$(dirname "$0")/.."
WORKFLOW=.github/workflows/promote.yml
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# The workflow's code, without comments and blank lines.
CODE=$(sed -e 's/^[[:space:]]*#.*$//' -e '/^[[:space:]]*$/d' "$WORKFLOW")

# The triggers: the keys nested one level under the top-level `on:`.
TRIGGERS=$(printf '%s\n' "$CODE" | awk '
  /^on:/ { inside = 1; next }
  inside && /^[^[:space:]]/ { inside = 0 }
  inside && /^  [^[:space:]]/ { sub(/:.*/, ""); gsub(/[[:space:]]/, ""); print }
' | sort | tr '\n' ' ')

if [ "$TRIGGERS" = "workflow_dispatch " ]; then
  ok "the only trigger is workflow_dispatch"
else
  bad "triggers are '$TRIGGERS', want only workflow_dispatch"
fi

if printf '%s\n' "$CODE" | grep -qE '^[[:space:]]*(schedule:|-?[[:space:]]*cron:)'; then
  bad "the workflow has a schedule; production ships by hand only"
else
  ok "no schedule or cron"
fi

if printf '%s\n' "$CODE" | grep -qE '^[[:space:]]+confirm:' \
  && printf '%s\n' "$CODE" | grep -qF "if: inputs.confirm != 'promote'"; then
  ok "the run is refused unless confirm is 'promote'"
else
  bad "the confirm input, or the step that refuses a run without it, is missing"
fi

# The confirmation is the first step, before anything is checked out or pushed.
FIRST_STEP=$(printf '%s\n' "$CODE" | awk '/^    steps:/ { getline; print; exit }')
if [[ "$FIRST_STEP" == *"Check the confirmation"* ]]; then
  ok "the confirmation is checked first"
else
  bad "the first step is '$FIRST_STEP', want the confirmation check"
fi

exit $fail
