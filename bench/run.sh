#!/bin/sh
# milojs microbenchmark harness.
#
# Reports best-of-3 wall time for each bench under milojs and under bun, plus
# the milojs/bun ratio. The ratio is the signal, not the absolute time: it
# normalizes away workload size, so a bench whose ratio is far above the others
# points at a mechanism milojs handles disproportionately badly.
#
# Bun runs a SCALED copy of each bench. At the shared N it finishes its work in
# 1-2 ms, the same order as process-spawn jitter, so `bun_ms` used to be a
# difference of two ~12 ms numbers clamped at 1 and the ratio swung about 2x
# between runs of an UNCHANGED binary. Each bench declares `const N = <n>` on one
# line; the bun side rewrites that to N*mult, doubling mult until the net time
# clears BUN_MIN_MS, then divides back down. milojs needs no scaling: its net
# times are already hundreds of ms.
#
# Scaling is only sound if bun's cost stays linear in N, i.e. its JIT is not
# folding the loop away. Checked at 8/32/128/512x on propFew, numRead and arith:
# once past the warm-up step, each 4x in N cost 3.9-4.2x the time on all three.
# BUN_MIN_MS is set high enough to land every bench past that warm-up step.
#
# Effect on repeatability, same binary: the clamped harness reported callFn at
# 66.7x and then 352x on two runs, and propMany at 43.2x then 190x. Scaled, three
# consecutive runs held every ratio inside about 2%.
#
# Benches come in PAIRS that differ in exactly one dimension (see the header
# comment in each .js). Compare within a pair to attribute cost to a mechanism;
# `noop` is the startup floor and is subtracted from every other measurement.
#
# Usage: bench/run.sh <path-to-milojs-binary>

set -eu
ENGINE="${1:?usage: run.sh <path-to-milojs-binary>}"
DIR="$(dirname "$0")"
REPS=3
# How much net bun time is enough to be signal rather than spawn jitter.
BUN_MIN_MS=150
# Ceiling on the workload multiplier, so a bench bun happens to be slow at cannot
# scale until it exhausts memory.
BUN_MAX_MULT=1024
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT INT TERM

BENCHES="noop numRead strRead localRead deepRead propFew propMany propWrite propWriteNew protoDeep callFn callArrow arith objChurn"

# Wall milliseconds for one run of "$@".
one_ms() {
  start=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
  "$@" >/dev/null 2>&1
  end=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
  echo $((end - start))
}

# Best-of-N wall milliseconds for "$@".
best_ms() {
  best=""
  i=0
  while [ "$i" -lt "$REPS" ]; do
    start=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
    "$@" >/dev/null 2>&1
    end=$(perl -MTime::HiRes=time -e 'printf "%.0f", time()*1000')
    ms=$((end - start))
    if [ -z "$best" ] || [ "$ms" -lt "$best" ]; then best=$ms; fi
    i=$((i + 1))
  done
  echo "$best"
}

# Net bun milliseconds for one bench, normalised back to the bench's declared N.
# Prints a decimal, because at the real N bun's answer is a fraction of a ms.
bun_net_ms() {
  f="$1"
  base=$(sed -n 's/^const N = \([0-9][0-9]*\);.*/\1/p' "$f" | head -1)
  if [ -z "$base" ]; then
    echo 1
    return
  fi
  tmp="$SCRATCH/$(basename "$f")"
  # Probe with ONE run per step to find a big enough multiplier, then pay the
  # best-of-REPS measurement only at that size. Probing at full REPS made the
  # bun half of the harness about three times slower for no extra accuracy.
  mult=8
  while :; do
    sed "s/^const N = [0-9][0-9]*;/const N = $((base * mult));/" "$f" > "$tmp"
    t=$(one_ms bun "$tmp")
    [ $((t - floor_bun)) -ge "$BUN_MIN_MS" ] && break
    [ "$mult" -ge "$BUN_MAX_MULT" ] && break
    mult=$((mult * 2))
  done
  net=$(( $(best_ms bun "$tmp") - floor_bun ))
  [ "$net" -lt 1 ] && net=1
  perl -e "printf '%.2f', $net/$mult"
}

printf '%-12s %10s %10s %10s\n' bench milojs_ms bun_ms ratio
printf '%s\n' '------------------------------------------------'

floor_milo=0
floor_bun=0
for b in $BENCHES; do
  f="$DIR/$b.js"
  m=$(best_ms "$ENGINE" "$f")

  if [ "$b" = noop ]; then
    floor_milo=$m
    floor_bun=$(best_ms bun "$f")
    printf '%-12s %10s %10s %10s   (startup floor, subtracted below)\n' "$b" "$m" "$floor_bun" -
    continue
  fi

  # Subtract startup so we compare execution, not process spawn. Clamp at 1ms:
  # a bench cannot be faster than the floor except by measurement noise.
  am=$((m - floor_milo)); [ "$am" -lt 1 ] && am=1
  an=$(bun_net_ms "$f")

  ratio=$(perl -e "printf '%.1f', $am/$an")
  printf '%-12s %10s %10s %10s\n' "$b" "$am" "$an" "${ratio}x"
done
