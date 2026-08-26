# Feature Specification: Bytecode VM Completion

**Feature Branch**: `002-bytecode-vm`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "finish the milojs bytecode VM (roadmap Stage 4): complete coverage of the language so real programs run compiled rather than tree-walked, decide the value representation, and make the VM the primary execution engine with the tree-walker as fallback, without moving any conformance number down"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Programs get faster with identical behavior (Priority: P1)

A JavaScript developer runs the same program they ran yesterday. It produces byte-identical
output, identical errors, and an identical exit code, and it finishes several times sooner.
They did nothing to opt in and nothing in their program's observable behavior moved.

**Why this priority**: behavior-preserving speed is the entire value proposition. The
project's standing bar (node is the oracle, conformance never moves down) is what separates
"finished the VM" from "shipped a second, subtly different engine". Every increment of
coverage must hold this before it counts.

**Independent Test**: land any coverage increment; the full fixture corpus, both engine
sweeps, and the package-suite gate report exactly their prior numbers while the benchmark
suite reports the speedup.

**Acceptance Scenarios**:

1. **Given** any program in the fixture corpus, **When** it runs after a coverage increment
   lands, **Then** its output is byte-identical to the reference runtime, as before.
2. **Given** the engine conformance sweeps and the package-suite gate, **When** a coverage
   increment lands, **Then** every previously passing case still passes (numbers may only
   move up).
3. **Given** a construct the compiled path cannot yet express, **When** a program reaches
   it, **Then** the program runs correctly via the fallback path, with no behavioral
   difference visible to the program.

---

### User Story 2 - Real programs run compiled, and coverage is measured (Priority: P2)

An engine contributor asks "how much of a real program actually runs compiled?" and gets a
published number measured over a real-world corpus, per construct. They pick the next
construct to support by what unlocks the most real code, land it, and watch the coverage
number move up while conformance holds.

**Why this priority**: "complete coverage" is unfalsifiable without a measurement. The
corpus-measured coverage number is what turns the remaining work into a ranked, finishable
list, and it is how "the VM is the primary engine" is demonstrated rather than asserted.

**Independent Test**: the coverage measurement runs as a tool against the corpus and prints
per-construct counts; a coverage increment moves the number; the number is published with
the same generated-facts discipline as the conformance numbers.

**Acceptance Scenarios**:

1. **Given** the coverage tool, **When** it runs over the corpus, **Then** it reports the
   fraction of function bodies (and loop bodies) that compile, broken down by the construct
   that blocked the rest.
2. **Given** a contributor choosing work, **When** they consult the report, **Then**
   blockers are ranked by how much real code each unlocks.
3. **Given** a landed increment, **When** the tool reruns, **Then** the coverage number
   rises and the blocker it removed leaves the ranking.

---

### User Story 3 - Recursion behaves identically on every platform (Priority: P3)

A developer writes a deeply recursive program. It reaches the same recursion depth on
macOS, Linux x64, and Linux arm64, and that depth matches the documented engine limit
exactly, because compiled calls do not consume platform-dependent native stack.

**Why this priority**: the tree-walker's ~7 KB-per-call native stack cost is what produced
the platform-dependent recursion cliff, the per-OS stack workaround, and a CI gate that
compiler noise could flip (all of 2026-08-26's incident). Compiled calls that spend no
native stack retire that entire failure class for covered code.

**Independent Test**: a recursion-depth probe over compiled functions reports exactly the
documented frame limit on all three platforms; the platform-uniform behavior is asserted by
an automated check.

**Acceptance Scenarios**:

1. **Given** a self-recursive compiled function, **When** it recurses to exhaustion,
   **Then** it raises the same catchable range error at the same depth on every supported
   platform.
2. **Given** recursion that passes through a non-compiled callee, **When** it runs,
   **Then** it still terminates with the defined catchable error, never a crash.

---

### User Story 4 - The execution cost question is settled by measurement (Priority: P4)

The engine's value representation (how a JavaScript value is stored while the compiled path
executes) is chosen from measured alternatives, the choice and its numbers are recorded as
a standing decision, and the benchmark suite demonstrates the chosen representation's win
on real workloads.

**Why this priority**: the recorded measurements show the representation is worth roughly
half of the total speedup. Deciding it by measurement, and recording it, is what the
foundation feature (001) deferred here; leaving it implicit would bury the single largest
performance lever in the codebase.

**Independent Test**: the decision entry exists with the comparative measurements that
chose it, and the benchmark suite's numbers reflect the decided representation.

**Acceptance Scenarios**:

1. **Given** the candidate representations, **When** the decision is made, **Then** each
   candidate has a measured number on the same workloads and the record says why the
   winner won.
2. **Given** the recorded decision, **When** a future contributor questions it, **Then**
   the record names the measurement that would justify reopening it.

---

### Edge Cases

- A construct is half-expressible (an operator whose fast path compiles but whose rare
  semantic branch does not): the compiled path must hand exactly that branch to the shared
  semantic implementation, never approximate it. Divergent duplicate semantics are the
  defect class this project's history warns about most.
- The compiled path and fallback interleave (compiled function calls an uncompilable one,
  which calls back into compiled code): behavior, error propagation, and the recursion
  limit must hold across arbitrary interleavings.
- Memory reclamation triggers mid-execution of compiled code: everything live on the
  compiled path's stack must be visible to the collector at every point reclamation can
  occur, verified by the collect-at-every-safepoint stress mode.
- The escape hatch (running with the compiled path disabled) must remain fully functional:
  it is the differential oracle that localizes any compiled-path bug.
- A hot construct is deliberately left uncovered at the end of this feature: it must be
  recorded with its measured cost (how much real code stays on the fallback), not silently
  absent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A program unit the compiled path cannot fully express MUST run via the
  fallback path with observable behavior identical to running it compiled; the decision to
  fall back MUST be made before execution begins, never mid-unit except through the defined
  shared-semantics calls.
- **FR-002**: Language semantics with subtle ordering rules (coercion order, receiver
  rules, equality) MUST have exactly one implementation, shared by the compiled path and
  the fallback; the compiled path may fast-path only cases whose semantics are total and
  proven equivalent.
- **FR-003**: Compiled-path coverage MUST be measured over a real-world corpus and
  published as a generated number, per construct, with blockers ranked by real code
  unlocked; the number MUST NOT be hand-maintained.
- **FR-004**: Every coverage increment MUST land with the full oracle suite, both engine
  conformance sweeps, and the package-suite gate at or above their prior numbers (the
  001-foundation conformance ratchet, once landed, enforces this automatically).
- **FR-005**: Compiled calls MUST NOT consume native stack per JavaScript frame; the
  recursion limit for compiled code MUST be the documented frame count, identical on all
  supported platforms, and exhaustion MUST raise the defined catchable error.
- **FR-006**: Every value live on the compiled path MUST be reachable by the memory
  collector at every point collection can trigger, and this MUST be exercised by the
  collect-at-every-allocation stress mode across the whole fixture corpus.
- **FR-007**: The value representation MUST be decided from comparative measurements on
  shared workloads, recorded as a standing decision (with the reopening measurement) in
  the project's decision index, and reflected in the benchmark numbers.
- **FR-008**: The fallback-only mode MUST remain a supported configuration running the
  entire fixture corpus, exercised in CI, as the differential oracle for compiled-path
  defects.
- **FR-009**: Performance MUST be tracked by the existing benchmark budget (ceilings only
  tighten) plus the scaling benchmarks from the 001 foundation; a coverage increment that
  regresses a benchmark ceiling does not land.
- **FR-010**: When this feature ends, any construct still running on the fallback MUST be
  recorded with its measured share of real code, as the ranked residue list.

### Key Entities

- **Compiled unit**: a function or loop body admitted to the compiled path as a whole,
  ahead of execution.
- **Coverage report**: corpus-measured fraction of units that compile, per blocking
  construct, generated not hand-written.
- **Shared semantic core**: the single implementation of coercion/receiver/equality rules
  both execution paths call.
- **Value representation decision**: the recorded choice, its comparative measurements,
  and its reopening condition.
- **Fallback-only mode**: the configuration that disables the compiled path entirely; the
  differential oracle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero conformance movement downward across the whole feature: fixture corpus
  byte-exact throughout, and every previously passing engine-sweep and package-suite case
  still passes at the end (per-case, not aggregate).
- **SC-002**: At least 90% of function bodies in the measurement corpus compile (from the
  published baseline measured at this feature's start); the residue is a ranked, argued
  list.
- **SC-003**: The benchmark suite's median gap to the peer runtime improves to at most
  100x (from 410x today), and the worst case to at most 400x (from ~1908x, a
  call-dominated benchmark that the compiled call path addresses directly). Ceilings are
  re-tightened to the achieved numbers.
- **SC-004**: A compiled recursion probe reaches exactly the documented frame limit on
  darwin-arm64, linux-x64, and linux-arm64, and the per-OS interpreter stack workaround is
  no longer required for compiled code (its removal or retention for fallback paths is
  recorded).
- **SC-005**: The whole fixture corpus passes under collect-at-every-allocation stress
  with the compiled path enabled.
- **SC-006**: Fallback-only mode passes the whole fixture corpus in CI at feature end.
- **SC-007**: The value-representation decision is recorded with its comparative
  measurements before the final third of coverage work lands (so the bulk of opcode work
  is built on the decided representation, not ported after).

## Assumptions

- The existing subset and its design rules (whole-unit admission, fallback as design,
  single semantic core, frame-stack calls, explicit collector rooting) are the base this
  feature completes; nothing in this spec licenses weakening them.
- The measurement corpus is the same real-world corpus the project already measures
  against (the reference runtime's test corpus parsed per construct); coverage percentages
  are quoted against it with the denominator stated.
- Constructs whose compiled benefit is structurally negligible (code that runs once at
  module load, rare dynamic forms) may land in the residue list rather than being
  compiled; the 90% target is chosen to force the common language in while leaving room
  for argued residue.
- Generators, async bodies, and other suspension points may remain fallback-executed in
  this feature if their share of the corpus permits the coverage target; the compiled
  frame model they would need is recorded as follow-on work if deferred.
- The 001-foundation gates (conformance pass-set ratchet, scaling benchmarks) are assumed
  to land before or alongside this feature's later increments; until they exist, the
  existing sweeps and bench budget carry SC-001/SC-003 enforcement manually.
- SC-003's targets are floors for this feature, not the engine's end state; further gains
  (and any compilation beyond the current execution model) are future features.
