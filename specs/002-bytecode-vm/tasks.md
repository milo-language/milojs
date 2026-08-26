# Tasks: Bytecode VM Completion

**Input**: Design documents from `/specs/002-bytecode-vm/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/, quickstart.md. The 001
conformance ratchet (T006–T009 there) lands before the first coverage increment here.

**Tests**: no separate test tasks; every increment is gated by the execution-equivalence
contract, and the two new tools carry teeth cases. Fixtures are added where a construct
lacks one, inside the increment that compiles it.

**Organization**: US1 (equivalence) is not a phase: it is the landing bar every task in
phases 4–6 pays. Phases follow measurement-first order per research.md.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup — measurement before movement

- [ ] T101 Implement `MILOJS_VM_STATS=1` witness in `src/engine/bytecode.milo` (+ entry wiring): stderr summary at exit with chunks compiled / fallen back and per-blocking-construct counts; zero output change when unset, `tools/dev.sh` byte-exact (research R3)
- [ ] T102 [US2] Implement `tools/vm-coverage.mjs` per contracts/coverage-report.md: acorn over the node corpus, admitted-construct table, ranked blockers, writes `docs/conformance/vm-coverage.json`; commit the baseline report
- [ ] T103 [US2] Implement `tools/check-vm-coverage.mjs` (pct ratchet, fails on empty/zero) + teeth: admitted-table entries proven to compile via a MILOJS_VM_STATS probe per construct; wire into `tools/precommit.sh`, `.github/workflows/ci.yml`, `tools/check-gate-teeth.sh`
- [ ] T104 [US2] Publish the coverage number in `docs/status.md` through `tools/gen-facts.mjs` with its denominator; note the ranking as the work order in `docs/milojs-quickjs-plan.md` or backlog

## Phase 2: Foundational — the value representation decision (US4)

- [ ] T105 [US4] Build the unboxed-numeric fast lane prototype behind the existing compile step in `src/engine/bytecode.milo` (arith/compare opcodes + numeric local slots only, boxing at chunk boundaries and semantic-core calls), gated by the full equivalence contract
- [ ] T106 [US4] Measure boxed vs fast-lane on `bench/` (esp. arith, emptyLoop, loopNoDecl, localRead) + a numeric microbench via `bench/ab.sh`; record both numbers
- [ ] T107 [US4] Record the decision in `docs/decisions.md` (entry per research R1: numbers, winner, reopening condition, NaN-boxing as argued non-goal); keep or revert the prototype accordingly, in the same commit as the record

## Phase 3: US3 — recursion uniformity probe

- [ ] T108 [P] [US3] Add a compiled-recursion depth fixture (`tests/` with @expect from node where representable, else a runtime check) asserting the exact `callDepthLimit` cap; verify on darwin-arm64 + linux via CI, and podman for linux-arm64 once; record per-platform results in the commit

## Phase 4: US2 — coverage increments, ranked (repeating shape)

Each increment: pick top blocker from `docs/conformance/vm-coverage.json`, compile it in
`src/engine/bytecode.milo`, extend `tools/vm-differential.sh`'s matrix for its shapes,
add/extend fixtures, pay the full equivalence contract, re-run `bun tools/vm-coverage.mjs`,
re-tighten any bench ceiling that improved. Known-first candidates (report is
authoritative once T102 lands):

- [ ] T109 [US2] Method calls: fix `callValue` dropping thisVal for `JSValue.Native` (roadmap-recorded blocker) in `src/engine/eval.milo`, then compile `o.m(...)` via the per-object-kind dispatch, never `callBuiltinByName` as a general substitute
- [ ] T110 [US2] Closures and captured locals (chunk admission for bodies referencing outer scope)
- [ ] T111 [US2] try/catch/finally and throw inside compiled bodies (unwind through VmFrame)
- [ ] T112 [US2] for-of / for-in over the standard iterables via the shared iteration protocol
- [ ] T113 [US2] Array literals, template literals, remaining expression forms per ranking
- [ ] T114 [US2] Parameter forms (defaults, rest, destructuring) per ranking
- [ ] T115 [US2] Continue down the ranked report until totals.pct ≥ 90% or every remaining blocker has an argued residue entry (FR-010); record the residue list in `docs/milojs-quickjs-plan.md`'s successor section or `docs/backlog.md`

## Phase 5: US1/US3 close-out

- [ ] T116 [US1] Full close-out sweep: dev.sh, vm-differential (raise seed count for one long run), both sweeps + package gate + ratchet, GC_THRESHOLD suite, NO_BYTECODE suite; fix anything found before declaring SC-001
- [ ] T117 [US3] Re-evaluate `interpStackBytes` in `src/engine/driver.milo`: measure whether fallback-path usage still needs the linux 128MB / darwin 16MB split at final coverage; record outcome in `docs/decisions.md` + `docs/backlog.md` (research R6)

## Phase 6: Polish

- [ ] T118 [P] Re-tighten `docs/conformance/bench-budget.json` ceilings to achieved numbers; SC-003 floors (median ≤100x, worst ≤400x) verified by `node tools/check-bench-budget.mjs`
- [ ] T119 [P] Update `docs/milojs-roadmap.md` Stage 4 to landed-history form (per its own convention) and re-verify doc dates same-commit; update `docs/status.md` facts
- [ ] T120 Run `tools/check-gate-teeth.sh` over the final gate set; fix flagged

## Dependencies

- T101 → T102 → T103 → T104 (strict). T105–T107 after T101 (witness helps verify the lane's admission), before T109+ (SC-007: decide before bulk opcodes; plan front-loads it).
- T108 independent, any time. T109–T115 strictly after T107, ordered by the live ranking (listed order is the prior). T116–T120 last.
- 001 ratchet (external) before T109.

## Parallel Execution Examples

- T108 alongside Phase 1/2.
- Coverage increments are sequential by design (each re-ranks the next); inside one, fixture-writing and matrix-extension can be delegated in parallel with the opcode work only if in the same worktree (all touch `bytecode.milo` adjacents — prefer serial).

## Implementation Strategy

Measurement first (Phase 1), decision second (Phase 2), then ranked coverage with the
equivalence contract as the unskippable landing bar. Every increment is a small green
commit to main; the coverage number in status.md is the visible progress metric. MVP =
Phases 1–2 (the number exists, the representation is decided); the campaign then grinds
the ranking until SC-002/SC-003 hold.
