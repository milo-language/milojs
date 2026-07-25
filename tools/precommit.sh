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

# docs/api is generated; a stale copy is worse than none, since agents grep it
# and trust it. Regenerate and stage if anything moved.
before=$(find docs/api -name '*.md' -exec shasum {} + 2>/dev/null | shasum)
tools/gen-docs.sh >/dev/null 2>&1 || true
after=$(find docs/api -name '*.md' -exec shasum {} + 2>/dev/null | shasum)
if [ "$before" != "$after" ]; then
    git add docs/api
    echo "precommit: docs/api was stale; regenerated and staged"
fi

exit "$status"
