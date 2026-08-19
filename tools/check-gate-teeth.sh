#!/usr/bin/env bash
# Audit the gates: for each check in the pre-commit hook, introduce the exact
# violation it claims to catch and confirm it FAILS.
#
# A gate that stops matching what it parses reports "0 checked" and exits 0
# forever, and nothing about a green run distinguishes that from a clean tree.
# This repo has shipped three: check-arity printing "0 checked", check-gaps
# silently dropping two of six probes, and quickjs-sweep scoring 0/149 off a
# binary that did not exist. All three were found by hand, months apart.
#
# Each case saves the file it mutates, runs the gate, requires a nonzero exit,
# then restores from the copy and verifies the checksum. It refuses to run on a
# dirty tree so that a failed restore is visible in `git status` rather than
# committed by the next person.
#
# Usage: tools/check-gate-teeth.sh [-v]
set -uo pipefail
cd "$(dirname "$0")/.."

verbose=0
[ "${1:-}" = "-v" ] && verbose=1
status=0
checked=0
skipped=0
toothless=0

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "check-gate-teeth: refusing to run on a dirty tree — a botched restore would be invisible" >&2
    exit 2
fi

sha() { shasum -a 256 "$1" | awk '{print $1}'; }

# The gates that probe a binary need one. tools/dev.sh caches at .dev/; CI builds
# to /tmp. Resolve either, so the engine-dependent cases run in both places
# instead of silently reporting themselves as skipped.
ENGINE=""
for candidate in "${MILOJS_ENGINE:-}" .dev/mj-engine /tmp/milojs-engine; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then ENGINE="$candidate"; break; fi
done

# teeth <label> <file-to-mutate> <mutation-shell> <gate-shell>
teeth() {
    local label="$1" file="$2" mutate="$3" gate="$4"
    local backup before after out code
    backup=$(mktemp)
    cp "$file" "$backup"
    before=$(sha "$file")

    eval "$mutate"
    out=$(eval "$gate" 2>&1)
    code=$?

    cp "$backup" "$file"
    after=$(sha "$file")
    rm -f "$backup"
    if [ "$before" != "$after" ]; then
        echo "check-gate-teeth: FAILED TO RESTORE $file — fix it by hand before committing" >&2
        exit 3
    fi

    checked=$((checked + 1))
    if [ "$code" -eq 0 ]; then
        status=1
        toothless=$((toothless + 1))
        echo "toothless: $label passed with the violation applied"
        [ "$verbose" -eq 1 ] && echo "$out" | head -5
    elif [ "$verbose" -eq 1 ]; then
        echo "ok    $label"
    fi
}

# --- generated files: the generator must notice a hand edit ---
teeth "gen-unicase --check" src/engine/unicase.milo \
    "printf '\n// teeth\n' >> src/engine/unicase.milo" \
    "node tools/gen-unicase.mjs --check"
teeth "gen-uniprops --check" src/engine/uniprops.milo \
    "printf '\n// teeth\n' >> src/engine/uniprops.milo" \
    "node tools/gen-uniprops.mjs --check"

# --- prose facts: a number edited by hand must not survive ---
teeth "gen-facts --check" README.md \
    "perl -0pi -e 's/(<!--fact:qjs-pass-->)\\d+/\${1}999/' README.md" \
    "node tools/gen-facts.mjs --check"

# --- docs: a doc without its meta block ---
teeth "check-docs (no meta)" docs/milojs-roadmap.md \
    "perl -0pi -e 's/<!-- doc-meta.*?-->//s' docs/milojs-roadmap.md" \
    "node tools/check-docs.mjs"

# --- provenance: a hand-edited .expected is the defect verify-expected exists for ---
teeth "verify-expected" tests/moduleNotFound.expected \
    "printf 'hand written line\n' >> tests/moduleNotFound.expected" \
    "tools/verify-expected.sh moduleNotFound"

# --- flat namespace: a second definition of an existing name ---
teeth "lint-symbols (duplicate)" src/engine/regex.milo \
    "printf '\npub fn reLowerByte(c: u8): u8 {\n    return c\n}\n' >> src/engine/regex.milo" \
    "tools/lint-symbols.sh"

# --- layering half 1: an engine file importing the host ---
teeth "check-layering (import edge)" src/engine/regex.milo \
    "printf '\nfrom \"../runtime/host\" import {\n    absolutePathOf\n}\n' >> src/engine/regex.milo" \
    "tools/check-layering.sh --quiet"

# --- layering half 2: a host native installed by the engine bootstrap ---
teeth "check-layering (engine global)" src/engine/bootstrap.milo \
    "perl -0pi -e 's/(scopeDefine\(st, 0, \"__inspect\")/scopeDefine(st, 0, \"__teethNative\", JSValue.Native(Native.Fn(Builtin.Inspect)))\n    \$1/' src/engine/bootstrap.milo" \
    "tools/check-layering.sh --quiet"

# --- sweeps: scoring with no engine binary ---
teeth "check-sweeps" scripts/quickjs-sweep.ts \
    "perl -0pi -e 's/if \(!existsSync\(ENGINE\)\) \{.*?\n\}\n//s' scripts/quickjs-sweep.ts" \
    "node tools/check-sweeps.mjs"

# --- arity: a built-in length that disagrees with node ---
if grep -q 'arity' tools/check-arity.mjs 2>/dev/null; then
    teeth "check-arity" src/engine/eval.milo \
        "perl -0pi -e 's/Object:1,Array:1/Object:9,Array:1/' src/engine/eval.milo" \
        "node tools/check-arity.mjs"
fi

# --- gaps: a documented limit that is no longer real. Needs a built engine. ---
if [ -n "$ENGINE" ]; then
    teeth "check-gaps" docs/status.md \
        "perl -0pi -e 's/<!--gap:float16-->//' docs/status.md" \
        "node tools/check-gaps.mjs --engine $ENGINE"
else
    echo "check-gate-teeth: no engine binary found (.dev/mj-engine, /tmp/milojs-engine) — check-gaps not probed" >&2
    skipped=$((skipped + 1))
fi

echo "check-gate-teeth: $checked gate(s) probed, $toothless toothless, $skipped skipped"
exit "$status"
