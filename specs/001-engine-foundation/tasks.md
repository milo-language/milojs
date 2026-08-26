# Tasks: Scalable Engine and Runtime Foundation

**Input**: Design documents from `/specs/001-engine-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No separate test tasks: every deliverable here IS a gate, and each gate task
includes its own teeth demonstration (contracts/gates.md). The repo rule "nothing works
until it has been run" applies to every task below.

**Organization**: By user story, per spec.md priorities. Most of the spec is already
enforced by existing gates; these tasks close the six gaps plan.md identifies.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: Baseline evidence before changing gates.

- [ ] T001 Record the pre-change baseline: run `tools/dev.sh` and both fast sweeps (`bun scripts/test262-sweep.ts`, `bun scripts/quickjs-sweep.ts`), confirm green/current numbers match `docs/status.md`, and note the sweep report revisions in the task log (needed by T007's pass-set headers)

## Phase 2: Foundational

**Purpose**: Blocks multiple stories: the decision index is referenced by the embedding
contract (US4), the priority policy (US2 ranking), and FR-011.

- [ ] T002 Create `docs/decisions.md` (doc-meta header with key-files per data-model.md) with entries: value representation incl. the open bytecode-VM value-model question and its decision criteria, memory management (mark-sweep, stable slots, no compaction), execution strategy (tree-walker + bytecode subset + fallback semantics), event model (green tasks, microtask queue), single-context embedding (revisit-when: a real embedder needs concurrency), per-OS interpreter stack (interpStackBytes, revisit-when: milo replaces darwin makecontext), and the hybrid priority policy from the 2026-08-25 clarification; each entry links the owning subsystem doc instead of duplicating it
- [ ] T003 Register `docs/decisions.md` in the staleness machinery: confirm `tools/check-docs.mjs` picks it up, and add a line to `docs/status.md` or AGENTS.md's doc table pointing to it

## Phase 3: User Story 1 — Real applications run correctly (P1)

**Goal**: The node-oracle bar holds and provably covers the target app class.

**Independent test**: `tools/dev.sh` green + `tools/check-apps.sh` runs a Node/Express-class
app end to end with node-identical observable behavior.

- [ ] T004 [US1] Audit `tools/check-apps.sh` against SC-002: confirm it exercises at least one Node/Express-style server workload (thousands of lines, multiple host capabilities) end to end; if the current app corpus lacks one, add such an app under the directory check-apps already scans and wire its expected outcome the way the existing entries are wired
- [ ] T005 [P] [US1] Verify error parity per US1 acceptance scenario 3: extend `tools/check-exit-codes.mjs`'s case list (or add fixtures in `tests/`) so that at least one thrown-error case per category (TypeError, RangeError, user throw, unhandled rejection) checks error class, message, and exit code against node; skip what existing fixtures already cover

## Phase 4: User Story 2 — Conformance climbs and never slides back (P2)

**Goal**: Per-case pass-set ratchet over all three suites, pinned to corpus revisions.

**Independent test**: quickstart.md step 2: delete a passing case from a scratch report and
the gate FAILS naming it; corpus-revision mismatch is an ERROR, not a pass.

- [ ] T006 [US2] Confirm each sweep report in `docs/conformance/*.json` carries per-case results and corpus revision (test262 also seed + sample size); if any report stores only aggregates, extend the sweep script (`scripts/test262-sweep.ts`, `scripts/quickjs-sweep.ts`, `scripts/node-compat-sweep.ts`) to include the per-case pass list in its committed report
- [ ] T007 [US2] Generate initial pass sets `docs/conformance/passset-test262.txt`, `passset-quickjs.txt`, `passset-node.txt` from the current committed reports, with headers per contracts/conformance-ratchet.md (corpus revision; seed/sample for test262), sorted case paths
- [ ] T008 [US2] Implement `tools/check-conformance-ratchet.mjs` per contracts/conformance-ratchet.md: ERROR on header/report revision mismatch, FAIL listing lost cases by path, advisory list of unclaimed wins, failure on empty pass set or empty report (FR-008)
- [ ] T009 [US2] Wire the ratchet into `tools/precommit.sh` and `.github/workflows/ci.yml` (check-ci-covers-hook must count it), and demonstrate its teeth per contracts/gates.md: injected loss fails, empty input fails; record the demonstration the way `tools/check-gate-teeth.sh` expects
- [ ] T010 [US2] Document the update protocol in AGENTS.md's conformance section: a sweep-improving commit rewrites the pass set to claim wins; a deliberate removal is argued in the commit that shrinks the file

## Phase 5: User Story 3 — Performance and memory scale with the program (P3)

**Goal**: Superlinear cliffs and unbounded memory growth are caught by gates, not users.

**Independent test**: quickstart.md step 3: a deliberately quadratic scratch workload
declared `linear` FAILS; the plateau gate fails when fed a growing live set.

- [ ] T011 [P] [US3] Create `bench/scaling/` workloads + `bench/scaling/manifest.json` per data-model.md: parse-flat, parse-deep, exec-loop, exec-calldepth, property-map-growth, alloc-churn-constant-live, string-build, array-growth; each takes N from argv and declares dimension, base n, bound, metric
- [ ] T012 [US3] Implement `tools/bench-scaling.sh`: run each manifest workload at N and 10N under `tools/guard.sh`, emit measured times/peak footprints as JSON to `.dev/scaling.json`
- [ ] T013 [US3] Implement `tools/check-scaling-budget.mjs`: compare `.dev/scaling.json` ratios to manifest bounds (10x linear, ~13x linearithmic, 100x quadratic-with-argument, each ×2 tolerance), FAIL naming workload and ratio, FAIL on empty manifest or missing run data
- [ ] T014 [US3] Implement the plateau gate: `bench/scaling/plateau.js` (constant live set, ops-count driven) + `tools/check-memory-plateau.mjs` (late-window peak ≤ early-window ×1.2, FAIL on short/empty series); subsume the existing unscored memory benchmark if one overlaps
- [ ] T015 [US3] Wire T012–T014 into CI (and precommit if runtime cost allows; otherwise CI-only with the hook-coverage exemption argued), demonstrate teeth per quickstart.md step 3 negative checks

## Phase 6: User Story 4 — The engine embeds cleanly (P4)

**Goal**: The embedding contract is executable, not just documented.

**Independent test**: `tests/run-embed.sh` passes with engine-only linkage, including the
three new probes; leak oracle clean across repeated create/destroy.

- [ ] T016 [P] [US4] Add a capability-isolation probe to `tests/run-embed.sh`'s host program: evaluated JS must have no reachable fs/net/module capability unless the host registered one (contracts/embedding.md guarantee 1)
- [ ] T017 [P] [US4] Add a repeated create→evaluate→destroy cycle to the embed suite, checked under the existing leak oracle (`leaks -atExit` on darwin), per contracts/embedding.md guarantee 3
- [ ] T018 [P] [US4] Add an error-crossing probe: JS throw surfaces to the host as a structured value (message + error class), never a host abort (guarantee 2)
- [ ] T019 [US4] Reconcile `docs/milojs-embedding.md` with `specs/001-engine-foundation/contracts/embedding.md`: same lifecycle, same guarantees, single-context limitation pointing at its docs/decisions.md entry; bump last-verified in the same commit as any code the probes touched

## Phase 7: Polish & Cross-Cutting

- [ ] T020 [P] Update `docs/status.md` via `tools/gen-facts.mjs` if any sweep was rerun during T006–T009, so published numbers stay generated
- [ ] T021 [P] Run `tools/check-gate-teeth.sh` and `bun tools/check-ci-covers-hook.mjs` over the final gate set and fix anything they flag (quickstart.md step 5)
- [ ] T022 Re-run the full acceptance mapping in quickstart.md end to end and check off `specs/001-engine-foundation/checklists/requirements.md` items that gained evidence; note any SC that still lacks a gate

## Dependencies

- Phase 1 (T001) before T006–T009 (pass-set headers need known-good report revisions).
- Phase 2 (T002–T003) before T010 and T019 (both link decision entries).
- Stories are otherwise independent: US1 (T004–T005), US2 (T006–T010), US3 (T011–T015), US4 (T016–T019) can proceed in any order or in parallel worktrees.
- Within US2: T006 → T007 → T008 → T009 → T010 (strict chain).
- Within US3: T011 → T012 → T013; T014 independent of T012–T013; T015 last.
- Within US4: T016/T017/T018 parallel; T019 last.
- Polish (T020–T022) after all stories.

## Parallel Execution Examples

- One agent per story in its own worktree: US2 chain, US3 chain, US4 probes, US1 audit — four independent lanes (repo rule: parallel agents get their own git worktree; collision files are `src/engine/eval.milo` and `lib/engine-prelude.js`, which none of these lanes should touch).
- Inside US3: T011's eight workloads are independent files ([P]); inside US4: T016/T017/T018 are independent probes ([P]).

## Implementation Strategy

MVP = Phase 1 + Phase 2 + US2 (T006–T010): the conformance ratchet is the highest-leverage
gap (it protects everything else while the rest is built). Then US3 (scaling gates), then
US4 (embedding probes), then US1 (audit tasks, cheapest, mostly verification). Ship each
phase as its own green commit to main per repo convention; every gate lands together with
its teeth demonstration and its CI wiring, never as a bare script.
