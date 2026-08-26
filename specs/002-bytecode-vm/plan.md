# Implementation Plan: Bytecode VM Completion

**Branch**: `002-bytecode-vm` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-bytecode-vm/spec.md`

## Summary

Complete roadmap Stage 4: grow `src/engine/bytecode.milo`'s compiled subset until ≥90% of
real-corpus function bodies compile, decide the value representation from measurement
early, and hold every conformance number exactly via the fallback-by-design rule plus the
new per-case ratchet. The subset's design rules are settled and proven (whole-unit
admission, one semantic core, VmFrame calls, explicit GC rooting); this plan is coverage
expansion under gates, with one real architectural decision (value representation) and one
new measurement tool (corpus coverage).

## Technical Context

**Language/Version**: Milo (engine source); TypeScript on Bun for tools/sweeps.

**Primary Dependencies**: none new at runtime. Dev-time: acorn (already a transitive npm
dev availability; used standalone for corpus parsing) for the coverage tool.

**Storage**: committed reports under `docs/conformance/` (coverage report joins them).

**Testing**: `tools/dev.sh` (fixtures, byte-exact vs node); `tools/vm-differential.sh`
(VM vs walker on generated programs, exhaustive operator matrix + seeds); both engine
sweeps + package gate + per-case ratchet (001 slice, landing first); `MILOJS_GC_THRESHOLD=1`
suite (collect at every safepoint); `MILOJS_NO_BYTECODE=1` suite (fallback-only, in CI).

**Target Platform**: darwin-arm64, linux-x64, linux-arm64 (same as the repo).

**Project Type**: language engine internals.

**Performance Goals**: SC-003: bench median ≤100x vs bun (from 410x), worst ≤400x (from
1908x on callFn); ceilings re-tightened as achieved. Dispatch win measured at 12x unboxed
/ 5x boxed on identical work: value representation is half the total.

**Constraints**: constitution I–V. Fallback decision before execution, never mid-unit
(FR-001). One semantic core (FR-002): the compiled path calls `evalBinValues` /
`memberOfValue` / `setMemberOfValue` and their kin, never reimplements them. VM stack
rooting: any opcode that can allocate or re-enter the evaluator publishes the live top
first (FR-006). `callDepthLimit` is the recursion bound for compiled calls (FR-005).

**Scale/Scope**: bytecode.milo is 1.4k lines against eval.milo's 17.8k; expect it to grow
severalfold. Corpus: node test/parallel, 3,979 files, 21,617 function bodies, 618 loops.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Node is the oracle | PASS | Fixture corpus byte-exact at every increment; vm-differential adds a second oracle (walker) with zero cross-engine noise. |
| II. Engine/runtime separate | PASS | All work inside `src/engine/`; no new crossings. |
| III. Run it | PASS | Every increment lands with dev.sh + differential + sweeps; coverage number is the visible progress metric. |
| IV. Gates must fail | PASS | Coverage report generated, never hand-edited; ratchet + differential + NO_BYTECODE suite are the teeth; new coverage tool gets a teeth case. |
| V. Scale measured | PASS | SC-003 floors; ceilings tighten behind each win. |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-bytecode-vm/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/
│   ├── coverage-report.md      # corpus coverage measurement format + ratchet
│   └── execution-equivalence.md # the gates that define "identical behavior"
└── tasks.md                    # /speckit-tasks
```

### Source Code (repository root)

```text
src/engine/bytecode.milo        # the VM: compiler + dispatch loop (grows)
src/engine/eval.milo            # semantic core stays here; VM calls into it
tools/
├── vm-coverage.mjs             # NEW: acorn over corpus → per-construct coverage report
├── vm-differential.sh          # existing differential oracle (extend seeds/matrix as ops land)
└── check-vm-coverage.mjs       # NEW: coverage ratchet (number only moves up)
docs/conformance/
└── vm-coverage.json            # NEW: committed coverage report (generated)
docs/decisions.md               # value-representation entry lands here (001 T002 creates the file)
```

**Structure Decision**: all VM work stays in `src/engine/bytecode.milo` until it grows
past comprehension; the seam to split on then is compiler vs dispatch loop, and the split
waits until that day (abstraction-improver rule, measure the seam first).

## Complexity Tracking

No violations to justify.
