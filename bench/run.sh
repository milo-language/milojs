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
# --json <path> also writes a machine-readable report, the same shape and the same
# provenance rules as the conformance sweeps in docs/conformance: the milojs
# revision it was measured at, whether the tree was dirty, and the peer's exact
# version. Without that file the ratios are a number someone typed into a commit
# message, and every gate in this repo exists because one of those went stale.
#
# Usage: bench/run.sh <path-to-milojs-binary> [--json <path>]

set -eu
ENGINE="${1:?usage: run.sh <path-to-milojs-binary> [--json <path>]}"
shift
JSON=""
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON="${2:?--json needs a path}"; shift 2 ;;
    *) echo "run.sh: unknown argument $1" >&2; exit 2 ;;
  esac
done
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
ROWS=""
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
  ROWS="$ROWS$b $am $an $ratio
"
done

# An `[ ... ] && exit 0` here would be the AND-list footgun under `set -e`: when
# JSON *is* set the test fails, and whether that kills the script is shell-
# dependent. An explicit if is not.
if [ -z "$JSON" ]; then
  exit 0
fi
export ENGINE REPS floor_milo floor_bun

# --- the machine-readable half ---
#
# Provenance follows scripts/quickjs-sweep.ts exactly, including its carve-out:
# docs/conformance is where the reports land, so a tree whose only modification
# is a report already written is not "dirty" for the purpose of the next one.
REV=$(git -C "$DIR/.." rev-parse HEAD 2>/dev/null || echo "")
DIRTY=$(git -C "$DIR/.." status --porcelain 2>/dev/null \
  | grep -v 'docs/conformance' | grep -c . || true)
if [ "$DIRTY" -gt 0 ]; then DIRTY=true; else DIRTY=false; fi
PEER_VERSION=$(bun --version 2>/dev/null || echo unknown)
export REV DIRTY PEER_VERSION

printf '%s' "$ROWS" | perl -e '
  use strict; use warnings;
  my (%b, @ratios);
  while (my $l = <STDIN>) {
    my ($n, $ms, $peer, $r) = split " ", $l;
    next unless defined $r;
    $b{$n} = { milojsMs => $ms + 0, peerMs => $peer + 0, ratio => $r + 0 };
    push @ratios, [$r + 0, $n];
  }
  @ratios = sort { $a->[0] <=> $b->[0] } @ratios;
  my $median = @ratios ? $ratios[int(@ratios / 2)][0] : 0;
  my $worst  = @ratios ? $ratios[-1] : [0, ""];
  my $best   = @ratios ? $ratios[0]  : [0, ""];
  my $rev = $ENV{REV} eq "" ? "null" : "\"$ENV{REV}\"";
  print "{\n";
  print "  \"schemaVersion\": 1,\n  \"suite\": \"bench\",\n";
  print "  \"_comment\": \"Best-of-3 wall time per bench, milojs against the peer on the same work, startup floor subtracted. The RATIO is the measurement; absolute ms move with the machine. Written by bench/run.sh --json; ceilings enforced by tools/check-bench-budget.mjs.\",\n";
  print "  \"milojs\": { \"revision\": $rev, \"dirty\": $ENV{DIRTY} },\n";
  print "  \"engine\": \"$ENV{ENGINE}\",\n";
  print "  \"peer\": { \"name\": \"bun\", \"version\": \"$ENV{PEER_VERSION}\" },\n";
  print "  \"reps\": $ENV{REPS},\n";
  print "  \"floorMs\": { \"milojs\": $ENV{floor_milo}, \"peer\": $ENV{floor_bun} },\n";
  print "  \"benches\": {\n";
  my @k = sort keys %b;
  for my $i (0 .. $#k) {
    my $n = $k[$i];
    printf "    \"%s\": { \"milojsMs\": %s, \"peerMs\": %s, \"ratio\": %s }%s\n",
      $n, $b{$n}{milojsMs}, $b{$n}{peerMs}, $b{$n}{ratio}, ($i == $#k ? "" : ",");
  }
  print "  },\n";
  printf "  \"totals\": { \"benches\": %d, \"medianRatio\": %s, \"worstRatio\": %s, \"worstBench\": \"%s\", \"bestRatio\": %s, \"bestBench\": \"%s\" }\n",
    scalar(@ratios), $median, $worst->[0], $worst->[1], $best->[0], $best->[1];
  print "}\n";
' > "$JSON"
echo "wrote $JSON"
