#!/bin/sh
# The compiled path against the tree-walking evaluator, on generated programs.
#
# src/engine/bytecode.milo compiles some expression shapes to opcodes and falls
# back to the evaluator for the rest. The compiler exists to be FASTER, not
# different, so for any program the two must produce identical output. An opcode
# that skips a check the evaluator applies is invisible to every conformance
# suite until a fixture happens to cover that exact shape.
#
# That is not hypothetical: Op.Neg's fallback called toNumProg where the
# evaluator's `-` arm calls toNumArg, so `-Symbol()` answered NaN instead of
# throwing. It reached main and was caught days later by a fixture written for an
# unrelated reason. This compares the two paths directly, so no fixture has to
# exist for the shape that breaks.
#
# Unlike tools/fuzz.sh this compares OUTPUT TEXT, and can: both sides are the same
# binary on the same program, so there is no cross-engine noise to filter. Any
# difference at all is a bug.
#
# Usage: tools/vm-differential.sh [first-seed] [last-seed] [engine]
set -u
FIRST="${1:-1}"; LAST="${2:-300}"; ENGINE="${3:-.dev/mj-engine}"
if [ ! -x "$ENGINE" ]; then
    echo "vm-differential: engine not found at $ENGINE — build it first (tools/dev.sh)" >&2
    exit 2
fi
DIR=$(mktemp -d); trap 'rm -rf "$DIR"' EXIT INT TERM
bad=0; n=0

# The enumerable half first: every unary and binary operator applied to every
# awkward operand, inside a function body. Random seeds give breadth, but this
# class is small enough to cover exhaustively, and leaving it to chance means a
# 1-in-24 operand draw has to coincide with a 1-in-5 operator draw -- which did
# not happen in 120 seeds with a known bug reintroduced. The matrix caught it
# immediately.
python3 "$(dirname "$0")/fuzz-gen.py" --matrix > "$DIR/matrix.js"
n=$((n+1))
timeout -s KILL 30 "$ENGINE" "$DIR/matrix.js" >"$DIR/on.txt" 2>&1
onrc=$?
MILOJS_NO_BYTECODE=1 timeout -s KILL 60 "$ENGINE" "$DIR/matrix.js" >"$DIR/off.txt" 2>&1
offrc=$?
if [ "$onrc" -ne "$offrc" ] || ! cmp -s "$DIR/on.txt" "$DIR/off.txt"; then
  bad=$((bad+1))
  cp "$DIR/matrix.js" /tmp/vm-diff-matrix.js
  echo "operator matrix: compiled and evaluated disagree (exit $onrc vs $offrc) — saved /tmp/vm-diff-matrix.js"
  diff "$DIR/on.txt" "$DIR/off.txt" | head -10
fi

i=$FIRST
while [ "$i" -le "$LAST" ]; do
  f="$DIR/f$i.js"
  python3 "$(dirname "$0")/fuzz-gen.py" "$i" > "$f" 2>/dev/null || { i=$((i+1)); continue; }
  n=$((n+1))
  # SIGKILL, not the default TERM: the interpreter loop does not service TERM, and
  # a wedged fuzz program otherwise runs forever (this repo has lost hours to it).
  timeout -s KILL 10 "$ENGINE" "$f" >"$DIR/on.txt" 2>&1
  onrc=$?
  MILOJS_NO_BYTECODE=1 timeout -s KILL 10 "$ENGINE" "$f" >"$DIR/off.txt" 2>&1
  offrc=$?
  if [ "$onrc" -ne "$offrc" ] || ! cmp -s "$DIR/on.txt" "$DIR/off.txt"; then
    bad=$((bad+1))
    cp "$f" "/tmp/vm-diff-seed-$i.js"
    echo "seed $i: compiled and evaluated disagree (exit $onrc vs $offrc) — saved /tmp/vm-diff-seed-$i.js"
    diff "$DIR/on.txt" "$DIR/off.txt" | head -6
  fi
  i=$((i+1))
done
echo "vm-differential: $n seeds, $bad disagreement(s)"
[ "$bad" -eq 0 ]
