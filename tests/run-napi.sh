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
