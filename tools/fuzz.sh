#!/bin/sh
# Crash fuzzer for the memory-managed core: random programs that allocate,
# capture, nest and discard, run under MILOJS_GC_THRESHOLD=1 so a collection
# happens at essentially every safepoint.
#
# It compares against node, but only on the SHAPE of the outcome, never on
# output text: a generated program is usually invalid in some way, and the
# interesting signals are the ones no fixture suite covers.
#
#   crash or hang   milojs exits >= 124 (timeout, SIGKILL, SIGSEGV, SIGBUS)
#   over-accepting  milojs exits 0 where node fails
#   over-rejecting  milojs fails where node exits 0
#
# Comparing stdout instead would drown in noise: node's error banner is its last
# line for every failing program, which made an early version report 40 of 60
# "differing" while finding nothing.
#
# Usage: tools/fuzz.sh [first-seed] [last-seed] [engine]
set -u
FIRST="${1:-1}"; LAST="${2:-200}"; ENGINE="${3:-.dev/mj-engine}"
DIR=$(mktemp -d); trap 'rm -rf "$DIR"' EXIT INT TERM
bad=0; n=0
i=$FIRST
while [ "$i" -le "$LAST" ]; do
  f="$DIR/f$i.js"
  python3 "$(dirname "$0")/fuzz-gen.py" "$i" > "$f" 2>/dev/null || { i=$((i+1)); continue; }
  n=$((n+1))
  MILOJS_GC_THRESHOLD=1 timeout -s KILL 10 "$ENGINE" "$f" >/dev/null 2>&1
  mrc=$?
  timeout 10 node "$f" >/dev/null 2>&1
  nrc=$?
  if [ "$mrc" -ge 124 ]; then
    echo "seed $i: CRASH OR HANG (rc=$mrc)"; cp "$f" "/tmp/fuzz-seed-$i.js"; bad=$((bad+1))
  elif [ "$mrc" -eq 0 ] && [ "$nrc" -ne 0 ]; then
    echo "seed $i: milojs ACCEPTS what node rejects"; cp "$f" "/tmp/fuzz-seed-$i.js"; bad=$((bad+1))
  elif [ "$mrc" -ne 0 ] && [ "$nrc" -eq 0 ]; then
    echo "seed $i: milojs REJECTS what node accepts"; cp "$f" "/tmp/fuzz-seed-$i.js"; bad=$((bad+1))
  fi
  i=$((i+1))
done
if [ "$bad" -gt 0 ]; then
  echo "fuzz: $bad of $n seeds flagged; each saved to /tmp/fuzz-seed-<n>.js"
  exit 1
fi
echo "fuzz: $n seeds, none flagged"
