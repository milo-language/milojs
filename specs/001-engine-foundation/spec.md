# Feature Specification: Scalable Engine and Runtime Foundation

**Feature Branch**: `001-engine-foundation`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "set up speckit for milojs and specify that we want a robust foundational design that scales and can get us to a solid js runtime and engine"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real applications run correctly (Priority: P1)

A JavaScript developer takes an existing, non-trivial application written for Node-style
runtimes (modules, filesystem, network, timers, subprocesses) and runs it under milojs.
The program produces the same observable behavior it produces under the reference runtime:
same output, same exit code, same error messages for the same failures.

**Why this priority**: Correctness on real programs is the definition of "solid". Every
other property (speed, memory, conformance percentage) is worthless if a real app silently
computes the wrong answer. The project already holds this bar via the node oracle; the
foundation must preserve it as the system grows.

**Independent Test**: Run the existing fixture corpus plus at least one full real-world
application end to end; every fixture's output is byte-identical to the reference runtime's
output, verified automatically.

**Acceptance Scenarios**:

1. **Given** a fixture corpus whose expected outputs are captured from the reference
   runtime, **When** the full suite runs, **Then** every fixture matches byte-exactly and
   any deliberate divergence is explicitly registered with a written justification.
2. **Given** a real-world application previously validated under milojs, **When** it runs
   after any foundational change, **Then** its observable behavior is unchanged.
3. **Given** a program that throws, **When** it runs under milojs, **Then** the error
   class, message, and exit code match the reference runtime.

---

### User Story 2 - Conformance climbs and never slides back (Priority: P2)

An engine contributor lands a language-semantics change. The standard conformance suite
number is measured before and after; the number can only move up. Contributors can see, per
feature area, what passes, what fails, and what is intentionally out of scope, so work is
chosen by impact rather than guesswork.

**Why this priority**: Conformance is the scalable proxy for correctness on programs
nobody has tried yet. A ratchet turns thousands of individual fixes into a monotone,
measurable march toward a solid engine, and prevents foundational refactors from silently
trading away semantics.

**Independent Test**: Run the conformance sweep on two commits; the tooling reports the
per-area delta and fails automatically on any regression.

**Acceptance Scenarios**:

1. **Given** a baseline conformance number, **When** a change causes any previously
   passing conformance test to fail, **Then** the gate fails before the change lands.
2. **Given** a conformance sweep, **When** it completes, **Then** results are reported per
   feature area with pass/fail/out-of-scope counts, comparable across runs.
3. **Given** a contributor choosing what to work on, **When** they consult the sweep
   report, **Then** failing areas are ranked by how many tests (and which real-program
   patterns) each area blocks.

---

### User Story 3 - Performance and memory scale with the program (Priority: P3)

A developer runs a large or long-running workload: a big source file, a deep call graph, a
server that stays up for hours, a data job that allocates heavily. Cost grows
proportionally with the work: no superlinear cliffs in parsing, execution, or memory
management, and a long-running process's memory footprint stays bounded when its live data
is bounded.

**Why this priority**: "Scales" is half the request. The engine has already hit and fixed
one superlinear collapse (quadratic collection cost); the foundation must make that class
of failure detectable by measurement rather than by user reports.

**Independent Test**: A benchmark suite with size-parameterized workloads runs on every
change; results are compared against recorded baselines and against a reference
engine-class implementation.

**Acceptance Scenarios**:

1. **Given** a workload run at size N and 10N, **When** both complete, **Then** time and
   peak memory grow within the workload's expected complexity bound, and the bound is
   recorded next to the benchmark.
2. **Given** a long-running program whose live data is constant, **When** it runs for an
   extended period, **Then** memory footprint plateaus rather than growing without bound.
3. **Given** a performance-sensitive change, **When** it lands, **Then** its before/after
   benchmark numbers are part of the change record.

---

### User Story 4 - The engine embeds cleanly (Priority: P4)

A tool author embeds the JavaScript engine as a library inside another program: they
create an engine instance, evaluate scripts, exchange values, register host functions, and
tear the instance down, all without pulling in the runtime's host bindings (filesystem,
network, module loader).

**Why this priority**: The engine/runtime split is the architectural seam that lets the
project serve both "like QuickJS" and "like node" audiences. Keeping the engine embeddable
forces the layering discipline that makes the whole codebase scale; losing it collapses
the two products into one unmaintainable blob.

**Independent Test**: Build and run a host program that links only the engine, evaluates
scripts, round-trips values, and shuts down leak-free, with no host-binding code linked in.

**Acceptance Scenarios**:

1. **Given** the engine built as a library, **When** a host embeds it and evaluates a
   script, **Then** no filesystem, network, or module-loading capability is reachable from
   that script unless the host registered it.
2. **Given** the layering rule that engine code may not depend on runtime code, **When**
   any change introduces an unregistered crossing, **Then** an automated check fails.
3. **Given** an embedder creating and destroying engine instances repeatedly, **When**
   the host process is inspected, **Then** no memory is leaked across instance lifetimes.

---

### Edge Cases

- A conformance test passes by accident (wrong reason, right output): the ratchet records
  pass/fail only; deliberate-divergence and exemption lists are the mechanism for honesty,
  and each entry needs a written argument.
- The reference runtime and the specification disagree: the divergence registry records
  which authority was chosen and why, so the decision is auditable rather than implicit.
- A foundational refactor lands with no visible behavior change: the full oracle suite,
  conformance sweep, and benchmark baselines are the evidence it is actually invisible.
- A workload exhausts memory or recurses without bound: the system fails with a clear
  resource error rather than corrupting state or taking down the host machine.
- Gates themselves rot (parser matches nothing, sweep silently runs zero tests): every
  gate must fail loudly when its input set is empty or unparseable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST maintain two separable deliverables: a pure-language engine
  with no host capabilities, and a runtime layered on top of it that provides host
  bindings. The dependency direction MUST be one-way (runtime depends on engine, never the
  reverse) and MUST be enforced by an automated check with an explicit, argued exemption
  list that only shrinks.
- **FR-002**: Every behavioral expectation in the fixture corpus MUST be captured from the
  reference runtime, never hand-written, and an automated gate MUST verify committed
  expectations stay byte-identical to what the reference runtime produces.
- **FR-003**: The standard conformance suite MUST run as a ratchet: per-area results are
  recorded, and any previously passing test that fails blocks the change.
- **FR-004**: The benchmark suite MUST include size-parameterized workloads covering
  parsing, execution, and allocation-heavy patterns, with recorded baselines and expected
  complexity bounds, and MUST run reproducibly on demand and on every candidate change.
- **FR-005**: Long-running programs with bounded live data MUST run with bounded memory;
  the memory manager MUST reclaim unreachable data, including cyclic structures, without
  developer intervention.
- **FR-006**: The engine MUST be usable as an embedded library: instance creation, script
  evaluation, bidirectional value exchange, host-function registration, and leak-free
  teardown, with no host capability reachable unless the embedder grants it.
- **FR-007**: Resource exhaustion (out of memory, stack overflow, runaway execution under
  a configured limit) MUST produce a defined, catchable-or-fatal-by-policy error rather
  than undefined behavior, and MUST NOT be able to destabilize the host machine during
  development (guarded execution stays the default in dev tooling).
- **FR-008**: Every quality gate MUST fail when its input universe is empty or its parser
  stops matching; "0 checked, exit 0" is itself a gate failure.
- **FR-009**: Divergences from the reference runtime and from the specification MUST live
  in explicit registries with a written argument each; unregistered divergence is a test
  failure.
- **FR-010**: The development loop MUST stay one-command: one command to build both
  deliverables, one to run every gate against that build, and a filter to run a single
  fixture or conformance area in isolation.
- **FR-011**: Foundational architectural decisions (value representation, memory
  management strategy, execution strategy, concurrency/event model) MUST each be recorded
  with their rationale and the measurements that would justify revisiting them, so future
  scaling work (e.g., a faster execution strategy) replaces a documented decision instead
  of excavating an implicit one.

### Key Entities

- **Engine**: the pure-language implementation: parsing, evaluation, values, memory
  management, built-in library. No host capabilities.
- **Runtime**: the host layer: module loading, filesystem/network/process bindings, event
  loop, native-addon interface. Consumes the engine.
- **Fixture corpus**: executable programs with reference-runtime-captured expected
  outputs; the correctness oracle for real behavior.
- **Conformance sweep**: the standard suite run, its per-area results, and the ratchet
  state comparing runs.
- **Benchmark baseline**: a workload, its size parameter, its recorded numbers, and its
  expected complexity bound.
- **Divergence registry**: the argued lists of deliberate differences from the reference
  runtime, the specification, and the layering rule.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of fixture-corpus programs produce byte-identical output to the
  reference runtime, continuously, with every divergence registered and argued.
- **SC-002**: At least one real-world application (thousands of lines, multiple host
  capabilities) runs end to end with correct behavior, and stays running (regression-
  gated) as the foundation evolves.
- **SC-003**: Standard conformance suite results are monotonically non-decreasing across
  the mainline history; language-area conformance reaches at least 60% and whole-suite at
  least 45% within this foundation's horizon (from ~42% / ~30% today).
- **SC-004**: Doubling workload size on any baseline benchmark changes cost by its
  recorded complexity bound (within noise tolerance); no benchmark exhibits an unexplained
  superlinear cliff.
- **SC-005**: A long-running workload with constant live data shows a memory plateau (no
  unbounded growth) over a sustained run.
- **SC-006**: An embedder can go from nothing to "evaluated a script and got a value back
  in a host program" using only the engine deliverable and its documentation, with zero
  host capabilities linked, and teardown is leak-free under the project's leak oracle.
- **SC-007**: A contributor can build everything, run every gate, and run one filtered
  test with three distinct commands or fewer, and a from-scratch full-gate run completes
  fast enough to run on every change (tens of minutes at worst, not hours).
- **SC-008**: Zero quality gates can pass on empty input: each one demonstrably fails
  when fed nothing.

## Assumptions

- The reference runtime for observable behavior is node; where node and the ECMAScript
  specification disagree, the choice is recorded per case in the divergence registry.
- Database drivers and ORM-scale ecosystem compatibility (e.g., Prisma) are out of scope
  for this foundation, per prior project decision; the native-addon interface remains in
  scope as an engine/runtime boundary concern.
- The current execution strategy (tree-walking interpretation) is an acceptable foundation;
  this spec requires that faster strategies remain *reachable* (documented decisions,
  layering, benchmarks that would prove the win), not that one be built now.
- Conformance targets in SC-003 are staged goals for this foundation phase, not the
  end-state bar for the project; the ratchet, not the target, is the permanent mechanism.
- "Scales" covers program size, run duration, and codebase growth (contributor
  throughput); multi-machine or multi-tenant scaling is out of scope.
- Existing project gates (oracle verification, layering check, guarded execution) are the
  seed of the gate set this spec formalizes, not parallel systems to be rebuilt.
