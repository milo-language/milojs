#!/usr/bin/env bash
# Run every tests/*.js through milojs and diff against its *.expected (captured
# from bun). Regenerate an expected file with:  bun tests/foo.js > tests/foo.expected
#
# Two passes:
#   tests/*.js          run on the ENGINE  (milojs-engine.milo)
#   tests/runtime/*.js  run on the RUNTIME (milojs.milo)
# The runtime pass exists because R1 async activations only run on the runtime —
# the engine executes the program on the main thread and never spawns one, so a
# fixture for async-call ordering or promise adoption cannot be exercised on the
# engine at all. Anything that depends on activations goes in tests/runtime/.
#
# The binary for each pass is compiled ONCE and reused. `milo run` rebuilds on
# every invocation, so a per-test build cost a full LLVM compile per file. Set
# MILOJS_ENGINE_BIN / MILOJS_RUNTIME_BIN to reuse an existing build.
#
# MILO points at the compiler: a `milo` on PATH by default, or a checkout's
# src/main.ts (invoked through bun).
#
# Usage: tests/run.sh [pattern]
#   With a pattern, only fixtures whose basename contains it run (both passes).
set -u
cd "$(dirname "$0")/.." || exit 1
DIR="tests"
RUNTIME_DIR="$DIR/runtime"
PATTERN="${1:-}"

MILO="${MILO:-milo}"
case "$MILO" in
  *.ts) MILO_RUN="bun run $MILO" ;;
  *)    MILO_RUN="$MILO" ;;
esac

PER_TEST_TIMEOUT="${MILOJS_TEST_TIMEOUT:-120}"
TIMEOUT_CMD=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_CMD="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_CMD="gtimeout"
else
  echo "warning: no timeout(1); a hung fixture will hang this suite"
fi

# Fixtures are independent processes with no shared state, so they parallelize
# trivially. Cap concurrency at MILOJS_JOBS, defaulting to the core count
# (nproc on Linux, sysctl on Darwin — neither exists on the other) so a
# fixture-heavy suite doesn't oversubscribe a small box.
if command -v nproc >/dev/null 2>&1; then
  DEFAULT_JOBS="$(nproc)"
elif command -v sysctl >/dev/null 2>&1; then
  DEFAULT_JOBS="$(sysctl -n hw.ncpu 2>/dev/null)"
fi
JOBS="${MILOJS_JOBS:-${DEFAULT_JOBS:-4}}"

fail=0
passed=0
failed=0
total=0

# run_one <js> <dir> <kind> <runner> <outfile>: run a single fixture and write
# its full ok/FAIL output block to <outfile>. Runs backgrounded, in its own
# subshell, so it cannot set variables in the parent (that's what `fail` used
# to be) — a FAIL instead drops an <outfile>.fail marker that the caller counts
# after `wait`.
run_one() {
  local js="$1" dir="$2" kind="$3" runner="$4" outfile="$5"
  local name exp got status
  name="$(basename "$js" .js)"
  exp="$dir/$name.expected"
  if [ ! -f "$exp" ]; then
    echo "SKIP $name (no .expected)" >"$outfile"
    return 0
  fi
  # A GC-rooting fixture is vacuous at the default collection threshold — it
  # only exercises the root walk if a collection actually happens during the
  # window it sets up. Force one per allocation so `*Gc*` fixtures test R7.
  local gcenv=""
  case "$name" in *Gc*) gcenv="MILOJS_GC_THRESHOLD=1" ;; esac
  got="$(env $gcenv $runner "$js" 2>&1)"
  status=$?
  # A hung fixture is killed with SIGKILL — a wedged green scheduler never
  # reaches a point where it handles SIGTERM, so the default signal leaves it
  # running (one such process ran for hours once, skewing later timings).
  if [ "$status" -eq 137 ] || [ "$status" -eq 124 ]; then
    {
      echo "FAIL $name ($kind, hung, killed after ${PER_TEST_TIMEOUT}s)"
    } >"$outfile"
    : >"$outfile.fail"
  elif [ "$got" = "$(cat "$exp")" ]; then
    echo "ok   $name" >"$outfile"
  else
    {
      echo "FAIL $name ($kind)"
      diff <(printf '%s\n' "$got") "$exp" | head -20
    } >"$outfile"
    : >"$outfile.fail"
  fi
}

# run_pass <binary> <dir> <kind>: diff every dir/*.js (optionally filtered by
# $PATTERN) against its .expected, executing through <binary>, up to $JOBS at
# a time. Results print in the same alphabetical order as a serial run — each
# fixture's output goes to a file named by its position in the (sorted, glob)
# list, and those files are `cat`ed back in order once every job is done — so
# output stays deterministic and diffable even though execution isn't ordered.
run_pass() {
  local bin="$1" dir="$2" kind="$3"
  local runner
  if [ -n "$TIMEOUT_CMD" ]; then
    runner="$TIMEOUT_CMD -s KILL $PER_TEST_TIMEOUT $bin"
  else
    runner="$bin"
  fi
  [ -d "$dir" ] || return 0

  local -a files=()
  local js name
  for js in "$dir"/*.js; do
    [ -e "$js" ] || continue
    if [ -n "$PATTERN" ]; then
      name="$(basename "$js" .js)"
      case "$name" in
        *"$PATTERN"*) ;;
        *) continue ;;
      esac
    fi
    files+=("$js")
  done
  [ ${#files[@]} -eq 0 ] && return 0

  local tmpdir
  tmpdir="$(mktemp -d)"

  # Bounded parallelism: keep at most $JOBS fixtures in flight. bash on macOS
  # ships 3.2 (no `wait -n`), so cap the window by waiting on the oldest
  # still-tracked pid once it's full rather than waiting on "any" job.
  local -a pids=()
  local i seq
  for i in "${!files[@]}"; do
    seq="$(printf '%04d' "$i")"
    run_one "${files[$i]}" "$dir" "$kind" "$runner" "$tmpdir/$seq" &
    pids+=("$!")
    if [ "${#pids[@]}" -ge "$JOBS" ]; then
      wait "${pids[0]}"
      pids=("${pids[@]:1}")
    fi
  done
  wait

  local this_failed=0 this_skipped=0
  for i in "${!files[@]}"; do
    seq="$(printf '%04d' "$i")"
    cat "$tmpdir/$seq"
    if [ -e "$tmpdir/$seq.fail" ]; then
      this_failed=$((this_failed + 1))
    elif head -1 "$tmpdir/$seq" | grep -q '^SKIP '; then
      this_skipped=$((this_skipped + 1))
    fi
  done
  rm -rf "$tmpdir"

  [ "$this_failed" -gt 0 ] && fail=1
  failed=$((failed + this_failed))
  passed=$((passed + ${#files[@]} - this_failed - this_skipped))
  total=$((total + ${#files[@]}))
}

# Resolve (or build) the engine binary.
if [ -n "${MILOJS_ENGINE_BIN:-}" ]; then
  ENGINE_BIN="$MILOJS_ENGINE_BIN"
  # Reject the runtime binary here: these expectations are captured against the
  # engine, and the runtime loads a different prelude, so it would run every
  # fixture and report plausible, wrong failures instead of erroring. The
  # runtime defines process; the engine does not.
  probe="$(printf 'console.log(typeof process)' | "$ENGINE_BIN" /dev/stdin 2>/dev/null)"
  if [ "$probe" = "object" ]; then
    echo "FAIL: MILOJS_ENGINE_BIN=$ENGINE_BIN looks like the runtime (milojs), not the engine."
    echo "      These fixtures expect a build of milojs-engine.milo."
    exit 1
  fi
else
  ENGINE_BIN="$(mktemp -t milojs-engine)"
  trap 'rm -f "$ENGINE_BIN"' EXIT
  if ! $MILO_RUN build src/milojs-engine.milo -o "$ENGINE_BIN" >/dev/null; then
    echo "FAIL: engine did not build"
    exit 1
  fi
fi

run_pass "$ENGINE_BIN" "$DIR" engine

# Runtime pass, only if there are runtime fixtures to run.
if compgen -G "$RUNTIME_DIR/*.js" >/dev/null; then
  if [ -n "${MILOJS_RUNTIME_BIN:-}" ]; then
    RUNTIME_BIN="$MILOJS_RUNTIME_BIN"
    probe="$(printf 'console.log(typeof process)' | "$RUNTIME_BIN" /dev/stdin 2>/dev/null)"
    if [ "$probe" != "object" ]; then
      echo "FAIL: MILOJS_RUNTIME_BIN=$RUNTIME_BIN is not the runtime (milojs)."
      echo "      tests/runtime/ expects a build of milojs.milo."
      exit 1
    fi
  else
    RUNTIME_BIN="$(mktemp -t milojs-runtime)"
    trap 'rm -f "$ENGINE_BIN" "$RUNTIME_BIN"' EXIT
    if ! $MILO_RUN build src/milojs.milo -o "$RUNTIME_BIN" >/dev/null; then
      echo "FAIL: runtime did not build"
      exit 1
    fi
  fi
  run_pass "$RUNTIME_BIN" "$RUNTIME_DIR" runtime
fi

# A typo'd filter must not look like a clean (zero-fixture) pass.
if [ -n "$PATTERN" ] && [ "$total" -eq 0 ]; then
  echo "no fixture matches '$PATTERN'"
  exit 1
fi

echo "$passed passed, $failed failed ($total fixtures)"
exit $fail
