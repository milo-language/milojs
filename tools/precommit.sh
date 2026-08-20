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

# lib/module.js's builtinModules list is derived from the specifiers
# builtinSource() actually answers, partitioned by node's own builtinModules. It
# drifted twelve modules behind before this gate existed.
if command -v node >/dev/null 2>&1 && ! node tools/gen-builtins.mjs --check; then
    status=1
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
# The per-module compatibility table is derived from an export diff against the
# node on PATH plus the committed sweep, so it moves whenever a lib/ module
# grows an export. Regenerated and staged rather than failed, for the same
# reason gen-facts is: the numbers move on ordinary commits.
if command -v node >/dev/null 2>&1 && [ -x .dev/mj-runtime ]; then
    before=$(shasum docs/node-compat.md 2>/dev/null | shasum)
    MILOJS_RUNTIME=.dev/mj-runtime node tools/gen-node-compat.mjs >/dev/null 2>&1
    after=$(shasum docs/node-compat.md 2>/dev/null | shasum)
    if [ "$before" != "$after" ]; then
        git add docs/node-compat.md
        echo "precommit: node compatibility table was stale; regenerated and staged"
    fi
fi

if command -v node >/dev/null 2>&1 && [ -x .dev/mj-engine ] && ! node tools/check-gaps.mjs; then
    status=1
fi

# A sweep whose engine binary is missing recorded every case as a crash and wrote
# a normal-looking score of 0. That shipped twice: fixed in test262-sweep, left
# in quickjs-sweep. This checks the behaviour in every sweep instead. Needs bun.
if command -v node >/dev/null 2>&1 && command -v bun >/dev/null 2>&1 && ! node tools/check-sweeps.mjs; then
    status=1
fi

# A crash was invisible in all three sweeps for the same reason: they classified
# a dead child by its OUTPUT and only fell back to the signal when the output was
# empty. Twenty crash reports in an afternoon moved no conformance number. This
# drives each sweep against a stub engine that segfaults, over a corpus it
# synthesizes, so it needs no test suite checked out. Needs bun.
if command -v node >/dev/null 2>&1 && command -v bun >/dev/null 2>&1 && ! node tools/check-crash-visibility.mjs; then
    status=1
fi

# ...and this is the other half: a sweep that CAN see a crash, a hang or an
# unparsable file is only useful if those counts are held down. Reads the
# committed report, so it costs nothing.
if command -v node >/dev/null 2>&1 && ! node tools/check-defect-budget.mjs; then
    status=1
fi

# Perf had no gate at all: every stage gate in the roadmap is a correctness gate,
# and product gate 4 was a sentence. A bytecode VM that made every bench 3x slower
# passed everything in this hook. Reads the committed report, so it costs nothing.
if command -v node >/dev/null 2>&1 && ! node tools/check-bench-budget.mjs; then
    status=1
fi

# A string read out of the AST and used after the interpreter re-enters itself.
# Two of that class reached users: a for-of binding name that went empty
# mid-loop, and a SIGSEGV in node's test-global.js. Static, so it costs nothing.
if command -v node >/dev/null 2>&1 && ! node tools/check-ast-refs.mjs; then
    status=1
fi

# The exit status, differential against node. The sweep scores a case by its exit
# code, so a runtime that exits 0 after failing to parse gets credited for files
# it never ran. Needs the runtime binary and node.
if command -v node >/dev/null 2>&1 && [ -x .dev/mj-runtime ] && ! node tools/check-exit-codes.mjs; then
    status=1
fi

# src/engine/unicase.milo is generated from node's ICU and says "do not edit by hand",
# which was a request until this ran. 0.1s.
# The POSIX/OpenSSL constant tables, against the node on THIS machine. Catches
# the darwin half drifting; CI runs the same check on linux for the other half.
if command -v node >/dev/null 2>&1 && ! node tools/gen-os-constants.mjs --check; then
    status=1
fi

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

# The hook is opt-in and CI is not, so a gate that runs only here is a gate a
# fresh clone can push past. This is what keeps that from happening quietly.
if command -v node >/dev/null 2>&1 && ! node tools/check-ci-covers-hook.mjs; then
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
#
# A recompile that merely moves a count exits 0 and is staged silently. A
# recompile that FAILS — an uncomputable fact, a missing report, a report
# measured on a dirty tree — is a different thing, and this step used to hide
# both its message and its exit code behind `>/dev/null 2>&1 || true`. The
# quickjs report was published from a dirty tree for thirteen commits that way:
# CI ran the same check and went red, and nothing local ever said so.
if command -v node >/dev/null 2>&1; then
    before=$(shasum README.md AGENTS.md docs/*.md | shasum)
    facts_out=$(node tools/gen-facts.mjs 2>&1)
    facts_code=$?
    after=$(shasum README.md AGENTS.md docs/*.md | shasum)
    if [ "$before" != "$after" ]; then
        git add README.md AGENTS.md docs/*.md
        echo "precommit: prose facts were stale; recompiled and staged"
    fi
    if [ "$facts_code" -ne 0 ]; then
        echo "$facts_out" >&2
        echo "precommit: gen-facts failed — a published number cannot be compiled" >&2
        status=1
    fi
fi

exit "$status"
