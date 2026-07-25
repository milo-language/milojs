#!/usr/bin/env bash
# Static contract gate: run `milo prove` over every .milo in this repo that carries a
# requires/ensures/invariant, and fail if the verification story gets WORSE.
#
# Two distinct failures are caught, and they are not the same thing:
#
#   refuted  — the prover found a counterexample. A contract is provably false, or a call
#              site provably violates a callee's precondition. Always a gate failure.
#   regressed — a contract that used to be proven no longer is, or a new translator/solver
#              `error` appeared. Nothing is proven false here; the guarantee simply stopped
#              being backed by anything. Without this half, contracts rot silently: the text
#              stays in the source looking like a guarantee while the prover quietly stops
#              discharging it. That is worse than having no contract, because it reads as
#              checked.
#
# `unknown` is RECORDED BUT NOT GATED. It rises for two reasons the tally cannot tell
# apart: a contract that stopped being discharged, and obligations that only just became
# visible to the prover. The first already shows up as a drop in `proven`, so gating on
# unknown would add no detection while going red every time prover coverage improves.
# Float literals and unmodelled callee results dominate the unknowns here.
#
# CALIBRATION: the numbers below come from the RELEASED milo compiler, which is what CI
# installs and what users have. A newer prover changes them — several translator bugs were
# fixed after this release (`.len()` method calls, bool locals havoced as Int, callee
# `ensures` dropped whenever the postcondition mentioned `result`), and every one of those
# turns errors into verdicts and unknowns into proofs. When CI goes red with "improved",
# that is the new compiler landing: re-run with --update and commit the new numbers.
#
# Usage: tools/verify-contracts.sh [--update]
set -uo pipefail
cd "$(dirname "$0")/.."

MILO="${MILO:-milo}"
UPDATE=0
[ "${1:-}" = "--update" ] && UPDATE=1

# file:proven:unknown:errors — proven is a gating FLOOR, errors a gating CEILING, unknown
# is recorded for drift reporting only.
EXPECTED="
builtins.milo:1:2:2
eval.milo:0:2:0
"

fail=0
actual=""
files=$(grep -rlE '^[[:space:]]*(requires|ensures|invariant)' --include='*.milo' . | sed 's|^\./||' | sort)

if [ -z "$files" ]; then
    echo "no contract-bearing .milo files found — the discovery glob is broken"
    exit 1
fi

for f in $files; do
    out=$("$MILO" prove "$f" --solver=z3 2>&1)
    line=$(echo "$out" | grep -oE 'proven: [0-9]+  failed: [0-9]+  unknown: [0-9]+  errors: [0-9]+')
    if [ -z "$line" ]; then
        echo "FAIL $f: prove produced no tally (compile failure?)"
        echo "$out" | tail -20
        fail=1
        continue
    fi
    p=$(echo "$line" | sed -E 's/.*proven: ([0-9]+).*/\1/')
    fl=$(echo "$line" | sed -E 's/.*failed: ([0-9]+).*/\1/')
    u=$(echo "$line" | sed -E 's/.*unknown: ([0-9]+).*/\1/')
    e=$(echo "$line" | sed -E 's/.*errors: ([0-9]+).*/\1/')
    printf '%-24s proven %-4s failed %-4s unknown %-4s errors %s\n' "$f" "$p" "$fl" "$u" "$e"
    actual="$actual$f:$p:$u:$e\n"

    if [ "$fl" -gt 0 ]; then
        echo "  FAIL: $fl refuted contract(s) — the prover found a counterexample:"
        echo "$out" | grep '✗' | sed 's/^/    /'
        fail=1
    fi

    exp=$(echo "$EXPECTED" | grep "^$f:" || true)
    if [ -z "$exp" ]; then
        echo "  note: not in the ratchet yet — add '$f:$p:$u:$e' to EXPECTED"
        continue
    fi
    ep=$(echo "$exp" | cut -d: -f2); eu=$(echo "$exp" | cut -d: -f3); ee=$(echo "$exp" | cut -d: -f4)
    [ "$p" -lt "$ep" ] && { echo "  FAIL: proven $p < $ep — a contract stopped being provable"; fail=1; }
    [ "$e" -gt "$ee" ] && { echo "  FAIL: errors $e > $ee — new translator/solver error"; fail=1; }
    if [ "$p" != "$ep" ] || [ "$u" != "$eu" ] || [ "$e" != "$ee" ]; then
        echo "  drift: $ep/$eu/$ee -> $p/$u/$e (proven/unknown/errors) — run --update to lock it in"
    fi
done

if [ "$UPDATE" = "1" ]; then
    echo
    echo "--- EXPECTED (copy into this script) ---"
    printf "%b" "$actual"
    exit 0
fi

[ "$fail" = "0" ] && echo "contract gate: OK"
exit $fail
