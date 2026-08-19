#!/usr/bin/env bash
# Pre-commit gate. Wire it up once with:
#   git config core.hooksPath .githooks
#
# Deliberately fast — no LLVM build. The fixture suites are CI's job; this only
# catches what is cheap to catch and expensive to discover later.
set -uo pipefail
cd "$(dirname "$0")/.."
status=0

if ! tools/lint-symbols.sh; then
    status=1
fi

# src/engine/ is the ECMAScript language, src/runtime/ is the host bindings. The
# split is a directory layout until something enforces it; this is the something.
# Holes are registered in src/.layering-exempt with an argument, and a registered
# hole that closed also fails, so the list only shrinks.
if ! tools/check-layering.sh; then
    status=1
fi

# A fixture with no .expected is printed as SKIP by tests/run.sh and exits 0, so
# it passes forever while testing nothing. --structure is the instant half of the
# node-oracle gate; CI runs the half that actually executes node.
if ! tools/verify-expected.sh --structure; then
    status=1
fi

# docs/api is generated; a stale copy is worse than none, since agents grep it
# and trust it. Regenerate and stage if anything moved.
before=$(find docs/api -name '*.md' -exec shasum {} + 2>/dev/null | shasum)
tools/gen-docs.sh >/dev/null 2>&1 || true
after=$(find docs/api -name '*.md' -exec shasum {} + 2>/dev/null | shasum)
if [ "$before" != "$after" ]; then
    git add docs/api
    echo "precommit: docs/api was stale; regenerated and staged"
fi

# 389 built-in `length` values in src/engine/eval.milo sit under a "GENERATED from node"
# comment with no generator behind it. test262 asserts every one.
if command -v node >/dev/null 2>&1 && ! node tools/check-arity.mjs; then
    status=1
fi

# The "known engine limits" list in docs/status.md is a set of claims about what
# the engine cannot do. Six of its ten entries described gaps that had already
# been closed, because closing a gap never touches the file claiming it is open.
# Each bullet now carries a probe; this fails if one is stale. Needs a built
# engine, so it is skipped when there is not one.
if command -v node >/dev/null 2>&1 && [ -x .dev/mj-engine ] && ! node tools/check-gaps.mjs; then
    status=1
fi

# src/engine/unicase.milo is generated from node's ICU and says "do not edit by hand",
# which was a request until this ran. 0.1s.
if command -v node >/dev/null 2>&1 && ! node tools/gen-unicase.mjs --check; then
    status=1
fi

# src/engine/uniprops.txt is the Unicode property tables for RegExp \p{...}, generated
# from the same ICU. Needs TEST262 to harvest the property SPELLINGS, so it is
# checked only where the corpus is present — CI does the same.
if command -v node >/dev/null 2>&1 && [ -n "${TEST262:-}" ] && [ -d "${TEST262:-}/test" ] \
    && ! node tools/gen-uniprops.mjs --check; then
    status=1
fi

# doc-meta present, key-files real, AGENTS tables complete, staleness ratchet.
# All filesystem + git-log reads, so it costs nothing.
if command -v node >/dev/null 2>&1 && ! node tools/check-docs.mjs; then
    status=1
fi

# The README's SHAPE: allowed sections, in order, each within a prose budget.
# Explanations accrete there faster than anywhere else — every measurement wants
# a paragraph justifying itself — and the four things a reader came for get
# buried. Blocks rather than rewrites: only a human can decide what to cut.
if command -v node >/dev/null 2>&1 && ! node tools/check-readme.mjs; then
    status=1
fi

# Numbers quoted in prose are compiled from the tree. Rewritten and staged rather
# than failed: the counts move on ordinary commits, and a hook that blocks on
# "your line count changed" just trains people to use --no-verify. CI runs the
# --check half, which catches a commit made without this hook installed.
if command -v node >/dev/null 2>&1; then
    before=$(shasum README.md AGENTS.md docs/*.md | shasum)
    node tools/gen-facts.mjs >/dev/null 2>&1 || true
    after=$(shasum README.md AGENTS.md docs/*.md | shasum)
    if [ "$before" != "$after" ]; then
        git add README.md AGENTS.md docs/*.md
        echo "precommit: prose facts were stale; recompiled and staged"
    fi
fi

exit "$status"
