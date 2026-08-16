#!/usr/bin/env bash
# Build a real .node addon and compare its JS callback behavior with Node.
set -euo pipefail
cd "$(dirname "$0")/.."

RUNTIME="${MILOJS_RUNTIME_BIN:-/tmp/mj-runtime}"
if [ -z "${CC:-}" ]; then
  for candidate in clang clang-18 cc; do
    if command -v "$candidate" >/dev/null 2>&1; then
      CC="$candidate"
      break
    fi
  done
fi
: "${CC:?no C compiler found; set CC}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

case "$(uname -s)" in
  Darwin) "$CC" -dynamiclib -undefined dynamic_lookup tests/napi/callback.c -o "$TMP/callback.node" ;;
  *)      "$CC" -shared -fPIC tests/napi/callback.c -o "$TMP/callback.node" ;;
esac

MILOJS_NAPI_ADDON="$TMP/callback.node" node --expose-gc tests/napi/callback.js >"$TMP/expected"
MILOJS_NAPI_ADDON="$TMP/callback.node" "$RUNTIME" tests/napi/callback.js >"$TMP/actual"
diff -u "$TMP/expected" "$TMP/actual"
echo "node-api callback ok"

# The entry points that were absent from the binary rather than stubbed. This is
# a LINK test first: a missing symbol makes dlopen fail before a line runs.
case "$(uname -s)" in
  Darwin) "$CC" -dynamiclib -undefined dynamic_lookup tests/napi/surface.c -o "$TMP/surface.node" ;;
  *)      "$CC" -shared -fPIC tests/napi/surface.c -o "$TMP/surface.node" ;;
esac

MILOJS_NAPI_ADDON="$TMP/surface.node" node tests/napi/surface.js >"$TMP/expected2"
MILOJS_NAPI_ADDON="$TMP/surface.node" "$RUNTIME" tests/napi/surface.js >"$TMP/actual2"
diff -u "$TMP/expected2" "$TMP/actual2"
echo "node-api surface ok"

# A NULL out-param: node answers napi_invalid_arg, milojs used to write to
# address 0 and exit 0 with no output.
case "$(uname -s)" in
  Darwin) "$CC" -dynamiclib -undefined dynamic_lookup tests/napi/nullout.c -o "$TMP/nullout.node" ;;
  *)      "$CC" -shared -fPIC tests/napi/nullout.c -o "$TMP/nullout.node" ;;
esac

MILOJS_NAPI_ADDON="$TMP/nullout.node" node tests/napi/nullout.js >"$TMP/expected3"
MILOJS_NAPI_ADDON="$TMP/nullout.node" "$RUNTIME" tests/napi/nullout.js >"$TMP/actual3"
diff -u "$TMP/expected3" "$TMP/actual3"
echo "node-api null out-param ok"
