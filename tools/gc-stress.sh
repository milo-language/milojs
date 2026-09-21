#!/usr/bin/env bash
# The fixture suite with the collector running at every allocation. This is the
# only gate that finds the engine's unrooted-local class of bug: a value that
# only a Milo stack frame references is swept mid-operation and its slot handed
# to the next allocation, so a later read sees some other object. Every one so
# far was dormant until an allocation was added to a loop that had not allocated
# before, which is a routine change somewhere else entirely; the normal pass
# never hints at it.
#
#   tools/gc-stress.sh [pattern]          strict: MILOJS_GC_THRESHOLD=1 MILOJS_GC_GROWTH=0
#   tools/gc-stress.sh --quick [pattern]  MILOJS_GC_THRESHOLD=1 only: the trigger is
#                                         max(1, live*2), so it thins out as the
#                                         heap grows; ~1x the normal suite time
#
# Strict is what "every allocation" means, and it is slow because every
# collection marks the whole live set. Both reuse the .dev binaries tools/dev.sh
# built (or MILOJS_ENGINE_BIN/MILOJS_RUNTIME_BIN) and diff exactly as
# tests/run.sh does, so a divergence prints the same FAIL block.
set -u
cd "$(dirname "$0")/.." || exit 1

growth=0
if [ "${1:-}" = "--quick" ]; then
  growth=2
  shift
fi
ENGINE="${MILOJS_ENGINE_BIN:-.dev/mj-engine}"
RUNTIME="${MILOJS_RUNTIME_BIN:-.dev/mj-runtime}"
if [ ! -x "$ENGINE" ] || [ ! -x "$RUNTIME" ]; then
  echo "gc-stress: no binaries at $ENGINE / $RUNTIME; run tools/dev.sh first or set MILOJS_ENGINE_BIN and MILOJS_RUNTIME_BIN" >&2
  exit 2
fi
# Strict mode skips the fixtures argued in tests/.gc-stress-exempt (one per
# line: name, then why). --quick runs everything.
skip=""
if [ "$growth" -eq 0 ] && [ -f tests/.gc-stress-exempt ]; then
  skip="$(grep -v '^#' tests/.gc-stress-exempt | awk 'NF {print $1}' | tr '\n' ' ')"
fi
MILOJS_GC_THRESHOLD=1 MILOJS_GC_GROWTH=$growth MILOJS_TEST_TIMEOUT="${MILOJS_TEST_TIMEOUT:-300}" \
  MILOJS_SKIP_FIXTURES="$skip" \
  MILOJS_ENGINE_BIN="$ENGINE" MILOJS_RUNTIME_BIN="$RUNTIME" tests/run.sh "$@"
