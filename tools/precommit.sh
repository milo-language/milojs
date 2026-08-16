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

# doc-meta present, key-files real, AGENTS tables complete, staleness ratchet.
# All filesystem + git-log reads, so it costs nothing.
if command -v node >/dev/null 2>&1 && ! node tools/check-docs.mjs; then
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
