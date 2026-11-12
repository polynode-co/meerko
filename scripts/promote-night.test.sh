#!/usr/bin/env bash
# Checks scripts/promote-night.sh against the times GitHub actually fires the promote crons.
set -euo pipefail
cd "$(dirname "$0")"
fail=0
check() { # <utc time> <markers> <expected>
  local epoch got
  epoch=$(date -u -d "$1" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M" "$1" +%s)
  got=$(NIGHT_MARKERS="$2" ./promote-night.sh "$epoch")
  if [[ "$got" == $3* ]]; then echo "ok   $1 -> $got"; else echo "FAIL $1 -> $got (want $3)"; fail=1; fi
}
# Winter (UTC+1): 18 UTC is 19:00 Madrid, too early; 19 UTC is 20:00.
check 2026-11-11T18:00 ""                         "skip"
check 2026-11-11T19:00 ""                         "ship 2026-11-11"
# The 2026-11-12 incident: both crons hours late. The first ships the 11th, the second doesn't.
check 2026-11-12T00:09 ""                         "ship 2026-11-11"
check 2026-11-12T01:09 "promote-night-2026-11-11" "skip the 2026-11-11 night"
# A late run doesn't block the next night.
check 2026-11-12T19:00 "promote-night-2026-11-11" "ship 2026-11-12"
# Summer (UTC+2): 18 UTC is 20:00 and ships; 19 UTC is the duplicate.
check 2026-07-01T18:00 ""                         "ship 2026-07-01"
check 2026-07-01T19:00 "promote-night-2026-07-01" "skip"
# Summer, the 18 UTC run dropped: the 19 UTC one ships instead.
check 2026-07-01T19:00 ""                         "ship 2026-07-01"
# Very late, still inside the window; then past 08:00 Madrid it's daytime, not a release.
check 2026-11-12T06:30 ""                         "ship 2026-11-11"
check 2026-11-12T07:30 ""                         "skip"
# DST change nights (Madrid 2026-03-29 and 2026-10-25, 02:00/03:00 local).
check 2026-03-29T03:00 ""                         "ship 2026-03-28"
check 2026-10-25T03:00 ""                         "ship 2026-10-24"
exit $fail
