# Implementation Plan: Scalable Engine and Runtime Foundation

**Branch**: `001-engine-foundation` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-engine-foundation/spec.md`

## Summary

The spec asks for a foundation that scales to a solid JS engine and runtime. Most of the
required machinery already exists and is enforced (node oracle, layering ratchet, defect
budgets, gate-teeth checks, guarded execution, one-command dev loop). The plan is therefore
a gap-closure plan, not a greenfield build. The gaps, from research:

1. **Conformance pass-set ratchet** (FR-003): today's ratchets cover crashes/hangs/parse
   failures and bench ceilings, not "a previously passing test now fails". Add a per-case
   pass-set ratchet over the committed conformance reports (test262 deterministic sample,
   QuickJS suite, node corpus).
2. **Size-parameterized benchmarks with complexity bounds** (FR-004, SC-004): `bench/` has
   fixed workloads with absolute ceilings vs bun; nothing measures cost at N vs 10N or
   records an expected complexity bound. Add a scaling-benchmark harness.
3. **Memory plateau gate** (FR-005, SC-005): one unscored memory benchmark exists; no gate
   asserts a plateau for constant live data over a sustained run.
4. **Embedding contract** (FR-006, SC-006): C ABI exists (`docs/milojs-embedding.md`,
   `run-embed.sh`) with a single-context constraint. Formalize the contract, decide whether
   multi-instance is in this foundation's scope, gate leak-free teardown.
5. **Architectural decision records** (FR-011): decisions live inside subsystem docs; the
   open one (bytecode VM value representation) has no recorded decision. Consolidate a
   decision index and record the open decisions with their revisit-measurements.
6. **Vendored conformance corpora**: both sweeps depend on local checkouts (roadmap Stage 6
   residue), so the ratchet in (1) is only reproducible if the corpus pin is enforced.

## Technical Context

**Language/Version**: Milo (self-hosted systems language, this org); tooling scripts in
TypeScript on Bun; a small amount of sh.

**Primary Dependencies**: none at runtime (no V8/JSC/C engine; own GC, regex, bigint).
Dev-time: node (oracle), bun (peer + script runner), test262 + QuickJS checkouts (corpora).

**Storage**: N/A (committed JSON reports under `docs/conformance/` are the persistent state).

**Testing**: `tools/dev.sh` (fixture corpus, repl/embed/napi suites, byte-exact vs node);
`scripts/{test262,quickjs,node-compat}-sweep.ts`; `bench/` with `tools/check-bench-budget.mjs`;
21 pre-commit gates mirrored in CI (`tools/check-ci-covers-hook.mjs`).

**Target Platform**: darwin-arm64 and linux-x64/arm64 (release binaries for both).

**Project Type**: language engine + runtime, two binaries plus an embeddable library.

**Performance Goals**: no superlinear cost outside a recorded complexity bound; bench
ceilings vs bun only tighten (today: median 410x, worst 1907x — tree-walker; Stage 4
bytecode VM is the recorded path down).

**Constraints**: guarded execution mandatory in dev (macOS enforces no rlimits); engine may
not depend on runtime (4 registered exempt edges, shrink-only); node is the behavioral
authority; single program-wide Milo namespace (lint-symbols).

**Scale/Scope**: ~48k lines of Milo today; test262 80.4% on a seeded 1500-case sample,
QuickJS 69.8%, node corpus 17.2% (peer bun 40.8%); scope is this foundation phase, targets
SC-003's staged numbers, not end-state parity.

## Constitution Check

*Constitution v1.0.0 (`.specify/memory/constitution.md`).*

| Principle | Status | Notes |
|---|---|---|
| I. Node is the oracle | PASS | Plan adds no hand-written expectations; ratchet reads sweep output that is itself node-derived. |
| II. Engine/runtime separate | PASS | New gates live in `tools/` + `scripts/`; no engine→runtime edges. Embedding contract work strengthens the seam. |
| III. Run it | PASS | Every deliverable below is a gate or a measured artifact; each lands with its run output and, for conformance-touching work, before/after sweep numbers. |
| IV. Gates must be able to fail | PASS (by design) | Each new gate ships with an injected-failure demonstration (`check-gate-teeth.sh` pattern) and fails on empty input. |
| V. Scale is measured | PASS | Items 2–3 exist precisely to satisfy this. |

No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-engine-foundation/
├── plan.md              # This file
├── research.md          # Phase 0: decisions on the six gaps
├── data-model.md        # Phase 1: ratchet state, baselines, registries
├── quickstart.md        # Phase 1: validation scenarios
├── contracts/
│   ├── embedding.md     # engine-as-library contract
│   ├── gates.md         # gate contracts (inputs, failure modes, teeth)
│   └── conformance-ratchet.md  # ratchet file format + update protocol
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/engine/          # unchanged by this feature except where a decision record points
src/runtime/         # unchanged
tools/
├── check-conformance-ratchet.mjs   # NEW: per-case pass-set ratchet
├── bench-scaling.sh                # NEW: N vs 10N harness
├── check-scaling-budget.mjs        # NEW: complexity-bound gate
├── check-memory-plateau.mjs        # NEW: bounded-live-data plateau gate
└── (existing gates unchanged)
bench/
└── scaling/                        # NEW: size-parameterized workloads
docs/
├── conformance/
│   ├── passset-{test262,quickjs,node}.txt   # NEW: committed ratchet state
│   └── (existing reports)
├── decisions.md                    # NEW: architectural decision index
└── milojs-embedding.md             # updated to match contracts/embedding.md
```

**Structure Decision**: all new machinery is gates + committed state, following the
existing `tools/check-*.mjs` + `docs/conformance/*.json` pattern. Engine source is touched
only if the memory-plateau gate exposes a real leak (then it is a bug fix with its own
oracle evidence, not part of this plan's scope).

## Complexity Tracking

No constitution violations to justify.
