#!/usr/bin/env bash
# Decides whether a scheduled promote run should ship, and for which night.
#
# GitHub runs scheduled workflows late, sometimes by hours (2026-11-12: the 20:00 Madrid crons
# fired at 01:09 and 02:09 Madrid), and can drop a run. So instead of trusting which cron fired,
# any scheduled run between 20:00 and 08:00 Madrid belongs to the night that started at 20:00,
# and the first one to reach the gate ships it. A `promote-night-YYYY-MM-DD` tag marks the night
# as done, so a second (or late) run of the same night never ships again.
#
# Usage: promote-night.sh [epoch-seconds]  (defaults to now)
# Reads existing marker tags, one per line, from $NIGHT_MARKERS (the workflow fills it from
# `git ls-remote`). Prints "ship <night>" or "skip <reason>".
set -euo pipefail

NOW="${1:-$(date +%s)}"
madrid() { TZ=Europe/Madrid date -d "@$NOW" "$@" 2>/dev/null || TZ=Europe/Madrid date -r "$NOW" "$@"; }

HOUR=$((10#$(madrid +%H)))
if [ "$HOUR" -ge 20 ]; then
  NIGHT=$(madrid +%Y-%m-%d)
elif [ "$HOUR" -lt 8 ]; then
  # Past midnight: the night started yesterday (Madrid). Noon minus 24h is DST-safe.
  NOON=$(( NOW - (HOUR + 12) * 3600 ))
  NIGHT=$(TZ=Europe/Madrid date -d "@$NOON" +%Y-%m-%d 2>/dev/null || TZ=Europe/Madrid date -r "$NOON" +%Y-%m-%d)
else
  echo "skip $(madrid +%H:%M) Madrid is outside the 20:00-08:00 release window"
  exit 0
fi

if printf '%s\n' "${NIGHT_MARKERS:-}" | grep -qx "promote-night-$NIGHT"; then
  echo "skip the $NIGHT night already promoted"
  exit 0
fi
echo "ship $NIGHT"
