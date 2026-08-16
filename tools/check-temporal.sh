#!/usr/bin/env bash
# Spec-derived Temporal checks. Separate from tests/ because those are diffed
# against node byte for byte, and node has no Temporal — the differential oracle
# does not reach this API at all. test262's Temporal tree is the real gate; this
# is the fast local one.
set -u
cd "$(dirname "$0")/.." || exit 1
BIN="${MILOJS_RUNTIME_BIN:-.dev/mj-runtime}"
[ -x "$BIN" ] || { echo "check-temporal: no runtime binary at $BIN (run tools/dev.sh first)" >&2; exit 1; }
out="$("$BIN" tools/temporal-checks.js 2>&1)"
echo "$out" | grep -v '^temporal-checks:' || true
echo "$out" | tail -1
echo "$out" | tail -1 | grep -q "all ok"
