#!/usr/bin/env bash
# Run real npm packages' OWN test suites under milojs and under node, and report
# how much of each suite milojs gets through.
#
# The fixtures in tests/ are written by whoever is fixing something, so they
# encode what was already suspected. A package's own suite does not: it was
# written to pin that package's behaviour, and it reaches engine surface nobody
# here would have thought to probe. Three defects found this way in one sitting
# (built-in arguments skipped ToString, `new` rejected a computed callee,
# primitive wrappers did not exist) were each invisible to every fixture.
#
# The corpus is deliberately the ljharb/es-shim dependency tree: those packages
# feature-detect the engine aggressively and test with tape, so a single engine
# defect shows up as a whole suite that cannot start. That amplification is the
# point — a corpus that fails as a BLOCK is pointing at one cause.
#
# Counted per TAP assertion, not per suite: a suite that dies on its first line
# and a suite that fails one edge case are very different results, and pass/fail
# per file cannot tell them apart.
set -u
cd "$(dirname "$0")/.." || exit 1

CACHE="${MILOJS_PKG_CACHE:-.dev/pkgcorpus}"
BIN="${MILOJS_RUNTIME_BIN:-.dev/mj-runtime}"
BASELINE="tools/packages-baseline.txt"

# Seeds, not the corpus: npm pulls in ~130 packages transitively and roughly 50
# of those ship a runnable test entry. Pinning the seeds keeps the number
# comparable across runs; an npm update can move it, which is why the baseline
# records what it was measured against.
SEEDS="tape@5.9.0 deep-equal@2.2.3 object-keys@1.1.1 is-arguments@1.2.0 safe-buffer@5.2.1 mime-types@3.0.1 qs@6.14.0 semver@7.7.2"

if [ ! -x "$BIN" ]; then
  echo "check-packages: no runtime binary at $BIN (run tools/dev.sh first)" >&2
  exit 1
fi
BIN="$(cd "$(dirname "$BIN")" && pwd)/$(basename "$BIN")"

if [ ! -d "$CACHE/node_modules" ]; then
  echo "check-packages: installing corpus into $CACHE (first run, needs network)"
  mkdir -p "$CACHE" || exit 1
  ( cd "$CACHE" && [ -f package.json ] || npm init -y >/dev/null 2>&1 )
  if ! ( cd "$CACHE" && npm i --no-audit --no-fund --silent $SEEDS >/dev/null 2>&1 ); then
    echo "check-packages: skipped — corpus not installed and npm install failed (offline?)"
    exit 0
  fi
fi

suites=0; ran=0; nodeok=0; milook=0; full=0
skipped_node=0; faildetail=""
detail="${MILOJS_PKG_DETAIL:-0}"

for dir in "$CACHE"/node_modules/*/; do
  pkg="$(basename "$dir")"
  # relative to the corpus root, not absolute: the entry path is also the key
  # the module preloader walks the graph with, and an absolute one makes every
  # require miss (see docs/backlog.md).
  entry=""
  for cand in "node_modules/$pkg/test/index.js" "node_modules/$pkg/test.js"; do
    [ -f "$CACHE/$cand" ] && { entry="$cand"; break; }
  done
  [ -z "$entry" ] && continue
  suites=$((suites + 1))

  # node is the oracle: a suite node itself cannot run (a missing devDependency,
  # a flag this node does not have) says nothing about milojs.
  nout="$(cd "$CACHE" && timeout 60 node "$entry" 2>&1)" || { skipped_node=$((skipped_node + 1)); continue; }
  ran=$((ran + 1))
  mout="$(cd "$CACHE" && timeout 60 "$BIN" "$entry" 2>&1)"

  n=$(printf '%s\n' "$nout" | grep -c '^ok ')
  m=$(printf '%s\n' "$mout" | grep -c '^ok ')
  bad=$(printf '%s\n' "$mout" | grep -c '^not ok ')
  nodeok=$((nodeok + n)); milook=$((milook + m))
  if [ "$n" = "$m" ] && [ "$bad" = 0 ]; then
    full=$((full + 1))
  else
    line="$(printf '  %-34s %s/%s ok, %s failed' "$pkg" "$m" "$n" "$bad")"
    faildetail="${faildetail}${line}
"
    [ "$detail" = 1 ] && printf '%s\n' "$line"
  fi
done

pct=0
[ "$nodeok" -gt 0 ] && pct=$((milook * 100 / nodeok))
echo "check-packages: $ran suites run ($skipped_node not runnable under node), $milook/$nodeok assertions = ${pct}%, $full suites complete"

# A baseline rather than a target: this number moves with the corpus as well as
# with the engine, so the gate is "did it go DOWN", never "is it high enough".
#
# It must be the FLOOR ACROSS PLATFORMS, not whatever the last machine to run it
# saw. The platforms agree today (1460 on darwin and on the linux runner,
# 2026-08-26): the old ~15-assertion linux deficit was es-get-iterator dying on
# a byte-measured stack cliff, and sizing the interpreter stack per-OS moved
# linux onto the exact 10k frame cap (interpStackBytes in src/engine/driver.milo).
# If the platforms split again, record the LOWER number and why, not a laptop
# figure — recording darwin's is how this gate once spent its whole life red
# without anyone reading it.
if [ -f "$BASELINE" ]; then
  read -r b_assert b_full < "$BASELINE"
  if [ "$milook" -lt "$b_assert" ] || [ "$full" -lt "$b_full" ]; then
    echo "FAIL: regressed against $BASELINE ($b_assert assertions, $b_full complete suites)" >&2
    # A regression seen only in CI was undiagnosable from the summary scalar
    # (2026-08-26: linux dropped 1445->1433 with an identical corpus and no code
    # change); name the suites so the log carries the worklist.
    echo "per-suite incompleteness at time of failure:" >&2
    printf '%s' "$faildetail" >&2
    exit 1
  fi
fi
exit 0
