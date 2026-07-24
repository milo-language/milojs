#!/usr/bin/env bash
# Run every tests/milo/*.milo fixture: compile it, run it, and check stdout
# against its `// @expect: <line>` annotations (one per expected output line, in
# order). Same contract as the milo repo's own fixture harness — these tests
# came from there when milojs moved out, because they assert milojs invariants
# (async park/resume, exec-context identity, GC roots under a parked activation)
# rather than compiler behaviour.
#
# MILO points at the compiler: a `milo` on PATH by default, or a checkout's
# src/main.ts (invoked through bun).
set -u
cd "$(dirname "$0")/.." || exit 1

MILO="${MILO:-milo}"
case "$MILO" in
  *.ts) MILO_RUN="bun run $MILO" ;;
  *)    MILO_RUN="$MILO" ;;
esac

PER_TEST_TIMEOUT="${MILOJS_TEST_TIMEOUT:-120}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0
for src in tests/milo/*.milo; do
  name="$(basename "$src" .milo)"
  # A fixture that pulls in std/net's TLS path cannot cross-compile everywhere;
  # honour the same @skip-os marker the milo harness uses.
  if grep -q "^// @skip-os: .*$(uname -s | tr '[:upper:]' '[:lower:]')" "$src"; then
    echo "skip $name"
    continue
  fi
  expected="$(sed -n 's|^// @expect: ||p' "$src")"
  bin="$TMP/$name"
  if ! build_err="$($MILO_RUN build "$src" -o "$bin" 2>&1)"; then
    echo "FAIL $name (build)"
    printf '%s\n' "$build_err" | tail -20
    fail=$((fail + 1))
    continue
  fi
  if ! got="$(MILO_RUN_MEM_MB="${MILO_RUN_MEM_MB:-4096}" timeout "$PER_TEST_TIMEOUT" "$bin" 2>&1)"; then
    echo "FAIL $name (run: exit $? — hang or crash)"
    printf '%s\n' "$got" | tail -20
    fail=$((fail + 1))
    continue
  fi
  if [ "$got" = "$expected" ]; then
    echo "ok   $name"
    pass=$((pass + 1))
  else
    echo "FAIL $name"
    diff <(printf '%s\n' "$expected") <(printf '%s\n' "$got") | head -20
    fail=$((fail + 1))
  fi
done

echo "milo fixtures: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
