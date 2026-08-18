#!/bin/sh
# A/B two engine builds on the same benches.
#
# bench/run.sh answers "how far off bun are we"; this answers "did THIS change
# help", which is the question every perf commit has to. Two rules it exists to
# enforce, both learned the hard way:
#
#   1. Pass BUILT BINARIES at fixed paths, never `.dev/mj-engine`. That path is
#      rebuilt by tools/dev.sh, so a baseline taken from it silently becomes the
#      patched build and the change measures as 0%.
#   2. Runs are INTERLEAVED (A,B,A,B...), not all-A-then-all-B. Machine load
#      drifts over the seconds a bench pair takes; measuring A and B in separate
#      blocks charges that drift entirely to one of them. The same binary pair
#      read -5.8% and +2.7% on localRead in back-to-back non-interleaved runs,
#      and 0% once interleaved.
#
# Best-of-9 per side. Deltas inside a couple of percent on the sub-300ms benches
# are noise; look for a consistent sign across a whole column before believing it.
#
# Usage: bench/ab.sh <base-binary> <new-binary> [bench ...]
set -u
A="${1:?usage: bench/ab.sh <base-binary> <new-binary> [bench ...]}"
B="${2:?usage: bench/ab.sh <base-binary> <new-binary> [bench ...]}"
shift 2
DIR="$(dirname "$0")"
REPS=9
[ $# -gt 0 ] || set -- numRead strRead localRead deepRead propFew propMany propWrite propWriteNew protoDeep callFn callArrow arith objChurn

ms() {
  s=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
  "$@" >/dev/null 2>&1
  e=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
  echo $((e - s))
}

printf '%-14s %9s %9s %9s\n' bench base_ms new_ms delta
printf '%s\n' '----------------------------------------------'
for f in "$@"; do
  ba=''; bb=''; i=0
  while [ "$i" -lt "$REPS" ]; do
    va=$(ms "$A" "$DIR/$f.js")
    vb=$(ms "$B" "$DIR/$f.js")
    { [ -z "$ba" ] || [ "$va" -lt "$ba" ]; } && ba=$va
    { [ -z "$bb" ] || [ "$vb" -lt "$bb" ]; } && bb=$vb
    i=$((i + 1))
  done
  printf '%-14s %9s %9s %8s%%\n' "$f" "$ba" "$bb" "$(perl -e "printf '%.1f', ($bb-$ba)*100/$ba")"
done
