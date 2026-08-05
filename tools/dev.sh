#!/usr/bin/env bash
# One incantation for the inner dev loop. AGENTS.md's "Tests" section used to be
# a 5-line build+env recipe a human had to retype (and get the env vars right)
# every time; this is that recipe, plus two things a shell one-liner can't do
# well on its own:
#
#   - build-once-reuse: skip the ~40s compiler invocation when neither binary's
#     inputs (src/*.milo, lib/*.js) changed since it was last built, so editing
#     a single test fixture doesn't cost a full rebuild.
#   - a filter mode (`tools/dev.sh <pattern>`) that builds once and then runs
#     only the matching engine/runtime fixtures through tests/run.sh, skipping
#     the repl/embed/napi suites entirely — for iterating on one fixture.
set -u
cd "$(dirname "$0")/.." || exit 1

MILO="${MILO:-milo}"
case "$MILO" in
  *.ts) MILO_RUN="bun run $MILO" ;;
  *)    MILO_RUN="$MILO" ;;
esac

DEV_DIR=".dev"
ENGINE_BIN="$DEV_DIR/mj-engine"
RUNTIME_BIN="$DEV_DIR/mj-runtime"

usage() {
  cat <<'EOF'
Usage: tools/dev.sh [pattern] [--all] [--rebuild] [-h|--help]

  (no args)   build both binaries, then run every suite (run.sh, run-milo.sh,
              run-repl.sh, run-embed.sh, run-napi.sh); print a pass/fail
              summary with wall-clock time per suite.
  <pattern>   inner-loop mode: build, then run only tests/run.sh fixtures
              whose basename contains <pattern>. Skips run-milo.sh,
              run-repl.sh, run-embed.sh, run-napi.sh.
  --all       same as no args.
  --rebuild   force a rebuild even if the binaries look up to date.
  -h, --help  show this message.

Env:
  MILO        compiler to build with (default: milo on PATH). A path ending
              in .ts is invoked through `bun run`.
  FORCE=1     same as --rebuild.

Binaries are cached at .dev/mj-engine and .dev/mj-runtime and rebuilt only
when a file under src/ or lib/ is newer than the binary.
EOF
}

FORCE="${FORCE:-0}"
MODE="all"
PATTERN=""

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --all) MODE="all" ;;
    --rebuild) FORCE=1 ;;
    *) MODE="filter"; PATTERN="$arg" ;;
  esac
done

mkdir -p "$DEV_DIR"

# A binary is stale if FORCE is set, it doesn't exist yet, or anything under
# src/ or lib/ is newer than it. `find -newer ... -print -quit` stops at the
# first hit instead of walking the whole tree every time.
needs_build() {
  local bin="$1"
  [ "$FORCE" = 1 ] && return 0
  [ -x "$bin" ] || return 0
  [ -n "$(find src lib -newer "$bin" -print -quit 2>/dev/null)" ]
}

# build_one <src file> <output bin> <err file>: builds only if stale. Runs in
# the background (see caller) so engine and runtime compile concurrently —
# each is a full LLVM build and the two don't depend on each other.
build_one() {
  local src="$1" bin="$2" errfile="$3"
  if ! needs_build "$bin"; then
    echo "up to date: $bin"
    return 0
  fi
  echo "building $bin ..."
  if $MILO_RUN build "$src" -o "$bin" >"$errfile" 2>&1; then
    rm -f "$errfile"
    return 0
  fi
  return 1
}

ENGINE_ERR="$DEV_DIR/.engine-build.err"
RUNTIME_ERR="$DEV_DIR/.runtime-build.err"

build_one src/milojs-engine.milo "$ENGINE_BIN" "$ENGINE_ERR" &
engine_pid=$!
build_one src/milojs.milo "$RUNTIME_BIN" "$RUNTIME_ERR" &
runtime_pid=$!

engine_ok=0; runtime_ok=0
wait "$engine_pid" || engine_ok=$?
wait "$runtime_pid" || runtime_ok=$?

# Fail loudly: print the compiler's own stderr rather than swallowing it.
if [ "$engine_ok" != 0 ]; then
  echo "FAIL: engine build failed" >&2
  cat "$ENGINE_ERR" >&2
fi
if [ "$runtime_ok" != 0 ]; then
  echo "FAIL: runtime build failed" >&2
  cat "$RUNTIME_ERR" >&2
fi
if [ "$engine_ok" != 0 ] || [ "$runtime_ok" != 0 ]; then
  exit 1
fi

export MILOJS_ENGINE_BIN="$ENGINE_BIN"
export MILOJS_RUNTIME_BIN="$RUNTIME_BIN"

names=()
statuses=()
times=()

run_suite() {
  local label="$1"; shift
  local start=$SECONDS
  if "$@"; then
    statuses+=("PASS")
  else
    statuses+=("FAIL")
  fi
  names+=("$label")
  times+=($((SECONDS - start)))
}

if [ "$MODE" = filter ]; then
  run_suite "run.sh ($PATTERN)" ./tests/run.sh "$PATTERN"
else
  run_suite "run.sh"       ./tests/run.sh
  run_suite "run-milo.sh"  ./tests/run-milo.sh
  run_suite "run-repl.sh"  ./tests/run-repl.sh
  run_suite "run-embed.sh" ./tests/run-embed.sh
  run_suite "run-napi.sh"  ./tests/run-napi.sh
fi

echo
echo "== summary =="
overall=0
total=0
for i in "${!names[@]}"; do
  printf '%-4s %-16s %ss\n' "${statuses[$i]}" "${names[$i]}" "${times[$i]}"
  [ "${statuses[$i]}" = FAIL ] && overall=1
  total=$((total + times[i]))
done
echo "total ${total}s"

exit $overall
