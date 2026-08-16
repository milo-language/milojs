#!/usr/bin/env bash
# Verify PROVENANCE of every .expected: re-run the fixture under node and assert
# the committed file is byte-exact what node prints today.
#
# Why this exists: AGENTS.md says every .expected is "captured from node, never
# hand-written", and that is the entire basis for calling the suite differential.
# Nothing enforced it. tests/run.sh's own header even claims the files came from
# bun. A hand-written .expected locks in whatever the engine did that day —
# including its bugs — and then passes forever, which is strictly worse than no
# fixture at all because it reads as a verified contract.
#
# This does NOT run milojs. tests/run.sh compares milojs against the file; this
# compares the file against node. Together they close the loop.
#
#   tools/verify-expected.sh            # every fixture
#   tools/verify-expected.sh regexp     # only basenames containing "regexp"
#   tools/verify-expected.sh --update   # RE-CAPTURE from node and rewrite
#   tools/verify-expected.sh --structure  # no node runs; registry checks only
#
# --update is the documented "adding a fixture" workflow in one command. It
# rewrites files, so it is never what CI runs.
#
# Output capture matches run.sh exactly (stdout+stderr combined, status ignored)
# — otherwise this would verify a different string than the one run.sh diffs.
#
# node runs with --no-warnings. Its process-level diagnostics ("(node:1234)
# ExperimentalWarning: ...", the circular-dependency warning) are emitted by the
# node CLI about the program, not by the program, and carry a pid. milojs has no
# equivalent and never will. Suppressing them at the source beats filtering them
# out afterwards, and keeps two fixtures genuinely gated instead of exempt.
set -uo pipefail
cd "$(dirname "$0")/.."

NODE="${NODE:-node}"
UPDATE=0
STRUCTURE=0
PATTERN=""
for a in "$@"; do
  case "$a" in
    --update) UPDATE=1 ;;
    # Executing ~200 node processes is a CI-shaped cost, not a pre-commit one.
    # --structure keeps the instant half — every fixture has an .expected, every
    # exemption still points at a real file — for the hook.
    --structure) STRUCTURE=1 ;;
    -*) echo "unknown flag: $a" >&2; exit 2 ;;
    *)  PATTERN="$a" ;;
  esac
done

if [ "$STRUCTURE" -eq 0 ] && ! command -v "$NODE" >/dev/null 2>&1; then
  echo "verify-expected: no node on PATH; the oracle is unavailable" >&2
  exit 2
fi

# util.inspect layout, error message text and Intl data all move between node
# majors, so a .expected is only meaningful relative to a node version. Recorded
# rather than gated: a mismatch is a reason to read a diff carefully, not to fail
# a machine that happens to run a newer node.
ORACLE_MAJOR=25
if [ "$STRUCTURE" -eq 0 ]; then
  have_major="$("$NODE" -p 'process.versions.node.split(".")[0]')"
  if [ "$have_major" != "$ORACLE_MAJOR" ]; then
    echo "note: fixtures were captured under node $ORACLE_MAJOR.x; this is $($NODE -v)"
  fi
fi

PER_TEST_TIMEOUT="${MILOJS_TEST_TIMEOUT:-60}"
TIMEOUT_CMD=""
command -v timeout  >/dev/null 2>&1 && TIMEOUT_CMD=timeout
[ -z "$TIMEOUT_CMD" ] && command -v gtimeout >/dev/null 2>&1 && TIMEOUT_CMD=gtimeout

# A fixture listed here is deliberately not node-verifiable. Every entry needs a
# reason: the exemption is the hole in the gate, so it has to be argued in the
# file, not discovered later in a diff.
EXEMPT_FILE="tests/.node-oracle-exempt"
is_exempt() {
  [ -f "$EXEMPT_FILE" ] || return 1
  grep -qxF "$1" <(grep -vE '^\s*(#|$)' "$EXEMPT_FILE" | awk '{print $1}')
}

# Which section of the registry an entry sits under. The two kinds are held to
# different rules, so the headings are read rather than decorative.
exempt_kind() {
  awk -v want="$1" '
    /^# --- NOT-RUNNABLE ---/ { kind = "NOT-RUNNABLE"; next }
    /^# --- DIVERGENCE/       { kind = "DIVERGENCE";  next }
    /^[^#[:space:]]/ { if ($1 == want) { print kind; exit } }
  ' "$EXEMPT_FILE"
}

fail=0
checked=0
skipped=0
updated=0

# The registry rots the same way anything hand-maintained does: a fixture gets
# renamed or deleted and its exemption silently keeps a hole open under a name
# nothing matches. Check the entries point at real files.
#
# And a STALE exemption is the quieter rot: the divergence gets fixed, the
# fixture starts matching node, and the hole stays open covering nothing. That is
# how a gate stops gating without anyone deciding it should. Every exemption is
# re-tested here, and one that no longer diverges is a failure telling you to
# delete it. (tests/eventLoop.js was exactly this: setImmediate ordering was
# fixed and the exemption outlived it.)
#
# The file's own rule is "do not add a DIVERGENCE without a backlog entry", which
# nothing enforced. It is checked now, because an exemption nobody has to justify
# in writing is just a way to make a failing fixture pass.
if [ -f "$EXEMPT_FILE" ]; then
  while read -r entry; do
    [ -z "$entry" ] && continue
    if [ ! -f "$entry" ]; then
      echo "ORPHAN   $EXEMPT_FILE exempts $entry, which does not exist"
      fail=1
      continue
    fi
    # only a DIVERGENCE needs a backlog entry. A NOT-RUNNABLE exemption (node
    # cannot execute it, or the output is not a function of the program) is a
    # property of the fixture, not an open bug, and has nothing to track.
    if [ "$(exempt_kind "$entry")" = "DIVERGENCE" ]; then
      base="$(basename "$entry" .js)"
      if ! grep -qF "$base" docs/backlog.md 2>/dev/null; then
        echo "UNARGUED $entry is exempt as a DIVERGENCE but not mentioned in docs/backlog.md"
        fail=1
      fi
    fi
    # a divergence that has stopped diverging is a hole covering nothing
    exp="${entry%.js}.expected"
    if [ "$(exempt_kind "$entry")" = "DIVERGENCE" ] && [ -f "$exp" ] && [ -n "$NODE" ]; then
      if nodeout="$($TIMEOUT_CMD 20 "$NODE" --no-warnings "$entry" 2>&1)"; then :; fi
      if [ "$nodeout" = "$(cat "$exp")" ]; then
        echo "STALE    $entry is exempt, but its .expected already matches node; delete the exemption"
        fail=1
      fi
    fi
  done < <(grep -vE '^\s*(#|$)' "$EXEMPT_FILE" | awk '{print $1}')
fi

check_dir() {
  local dir="$1" js name exp got rel
  [ -d "$dir" ] || return 0
  for js in "$dir"/*.js; do
    [ -e "$js" ] || continue
    name="$(basename "$js" .js)"
    rel="${js#./}"
    if [ -n "$PATTERN" ]; then
      case "$name" in *"$PATTERN"*) ;; *) continue ;; esac
    fi
    if is_exempt "$rel"; then
      skipped=$((skipped + 1))
      continue
    fi
    exp="$dir/$name.expected"
    if [ "$STRUCTURE" -eq 1 ]; then
      [ -f "$dir/$name.expected" ] || {
        echo "MISSING  $rel has no .expected (add one, or list it in $EXEMPT_FILE)"
        fail=1
      }
      continue
    fi
    if [ ! -f "$exp" ]; then
      # run.sh prints SKIP and exits 0 for these, so a fixture with no .expected
      # silently tests nothing. Caught here instead.
      echo "MISSING  $rel has no .expected (add one, or list it in $EXEMPT_FILE)"
      fail=1
      continue
    fi
    if [ -n "$TIMEOUT_CMD" ]; then
      got="$("$TIMEOUT_CMD" -s KILL "$PER_TEST_TIMEOUT" "$NODE" --no-warnings "$js" 2>&1)"
    else
      got="$("$NODE" --no-warnings "$js" 2>&1)"
    fi
    checked=$((checked + 1))
    if [ "$got" = "$(cat "$exp")" ]; then
      continue
    fi
    if [ "$UPDATE" -eq 1 ]; then
      printf '%s\n' "$got" >"$exp"
      echo "updated  $name"
      updated=$((updated + 1))
    else
      echo "STALE    $name — .expected is not what node prints"
      diff <(printf '%s\n' "$got") "$exp" | head -12
      fail=1
    fi
  done
}

check_dir tests
check_dir tests/runtime

echo
if [ "$STRUCTURE" -eq 1 ]; then
  [ "$fail" -eq 0 ] && echo "verify-expected: structure ok ($skipped exempt)" \
                    || echo "FAIL: fixture/exemption registry is inconsistent"
  exit "$fail"
fi
if [ "$UPDATE" -eq 1 ]; then
  echo "verify-expected: $checked checked, $updated re-captured, $skipped exempt"
  exit 0
fi
echo "verify-expected: $checked checked, $skipped exempt"
[ "$fail" -eq 0 ] && echo "every .expected matches node" || echo "FAIL: some .expected did not come from node"
exit "$fail"
