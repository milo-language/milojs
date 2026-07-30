#!/usr/bin/env bash
# Exercise the interactive runtime through a real PTY; redirected stdin cannot
# catch raw-terminal regressions such as a zero-byte VTIME read being called EOF.
set -euo pipefail
cd "$(dirname "$0")/.."

RUNTIME="${MILOJS_RUNTIME_BIN:-/tmp/mj-runtime}"
if ! command -v script >/dev/null 2>&1; then
  echo "SKIP repl pty (script not installed)"
  exit 0
fi

transcript="$(mktemp)"
narrow_transcript="$(mktemp)"
trap 'rm -f "$transcript" "$narrow_transcript"' EXIT

if [ "$(uname -s)" = Darwin ]; then
  printf '1 + 1\n\004' | script -q "$transcript" "$RUNTIME" >/dev/null
else
  printf '1 + 1\n\004' | timeout 10 script -qfec "$RUNTIME" "$transcript" >/dev/null
  printf '\004' | timeout 10 script -qfec "stty cols 40 rows 20; exec $RUNTIME" "$narrow_transcript" >/dev/null
fi

if ! tr -d '\r' <"$transcript" | grep -qx '2'; then
  echo "repl pty: expression result missing" >&2
  exit 1
fi
if [ "$(uname -s)" != Darwin ] && grep -q '███' "$narrow_transcript"; then
  echo "repl pty: full banner rendered in a narrow terminal" >&2
  exit 1
fi
echo "repl pty ok"
