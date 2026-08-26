<!--
Sync Impact Report
Version change: (unfilled template) → 1.0.0
Rationale: initial ratification; all placeholder tokens replaced with concrete project rules
derived from AGENTS.md and established repo practice (node oracle, layering ratchet, gates,
measurement discipline).
Modified principles:
  [PRINCIPLE_1_NAME] → I. Node Is the Oracle (NON-NEGOTIABLE)
  [PRINCIPLE_2_NAME] → II. Engine and Runtime Stay Separate
  [PRINCIPLE_3_NAME] → III. Nothing Works Until It Has Been Run
  [PRINCIPLE_4_NAME] → IV. Gates Must Be Able to Fail
  [PRINCIPLE_5_NAME] → V. Scale Is Measured, Not Assumed
Added sections:
  [SECTION_2_NAME] → Safety and Resource Constraints
  [SECTION_3_NAME] → Development Workflow and Quality Gates
Removed sections: none
Follow-up TODOs: none
-->

# milojs Constitution

## Core Principles

### I. Node Is the Oracle (NON-NEGOTIABLE)

Every behavioral expectation is captured from node, never hand-written. If milojs and node
disagree, milojs is wrong. `tools/verify-expected.sh` MUST keep every committed `.expected`
byte-exact with what node prints, and it MUST run in CI. A deliberate divergence is admitted
only through `tests/.node-oracle-exempt` with a written argument; an unregistered divergence
is a test failure, not an open question. Where node and the ECMAScript specification
disagree, the chosen authority MUST be recorded per case.

Rationale: correctness on real programs is the product. An oracle nobody can hand-edit is
the only correctness definition that scales past what any one contributor can review.

### II. Engine and Runtime Stay Separate

The project ships two deliverables: `milojs-engine`, the ECMAScript language and nothing
else, and `milojs`, the host runtime layered on top. Dependency direction is one-way:
nothing under `src/engine/` may import from `src/runtime/`. `tools/check-layering.sh`
enforces this, and `src/.layering-exempt` is a ratchet: every crossing carries a written
argument, an unregistered crossing fails, and so does a registered one that no longer
exists. The exemption list only shrinks. No host capability may be reachable from engine
code unless a host explicitly registered it.

Rationale: the seam is what lets one codebase serve both the QuickJS-shaped and the
node-shaped audience, and what keeps a faster execution strategy reachable later.

### III. Nothing Works Until It Has Been Run

This is a JS engine: running it means building both binaries and executing real `.js`
through them. No change is claimed to work until it has been run and seen to work; failures
are reported with their output, and skipped steps are named. `tools/dev.sh` is the whole
loop in one command and `tools/dev.sh <pattern>` is the inner loop; the one-command dev loop
MUST be preserved by every change to the build or the gates. Every conformance change
reports its before/after sweep number. "Should improve things" is not a result.

Rationale: an interpreter's failure modes are behavioral, not structural; only execution
against the oracle observes them.

### IV. Gates Must Be Able to Fail

Every quality gate MUST fail loudly when its input universe is empty or its parser stops
matching: "0 checked, exit 0" is itself a gate failure. Ratchets (conformance sweep,
layering exemptions, oracle exemptions) only tighten: a previously passing conformance test
that fails blocks the change. Counts and facts embedded in docs (`<!--fact:...-->`) are
generated, never hand-edited. Gate audits, confirming each gate still fails when it should,
are periodic maintenance, not incident response.

Rationale: a gate that cannot fail is worse than no gate; it converts rot into false
confidence exactly where the project believes it is protected.

### V. Scale Is Measured, Not Assumed

Cost MUST grow proportionally with the work: parsing, execution, and memory management
carry benchmarks with recorded baselines and expected complexity bounds, and a superlinear
cliff outside a recorded bound is a bug. Long-running programs with bounded live data run
in bounded memory; the GC reclaims unreachable data, including cycles, without developer
intervention, and leak-freedom is verified with the project's leak oracle. Performance
claims ship with their before/after numbers.

Rationale: the engine has already met and fixed one quadratic collapse; measurement is the
only mechanism that finds the next one before users do.

## Safety and Resource Constraints

- Development tooling MUST run untrusted or unbounded workloads guarded: the host enforces
  no usable rlimits on macOS, so a runaway allocation can take down the machine. Guarded
  execution stays the default; guards are weakened only with an argued, reviewed change.
- Resource exhaustion (out of memory, stack overflow, configured execution limits) MUST
  surface as a defined error by policy, never as undefined behavior or host instability.
- milojs is written in Milo: move semantics, second-class references, no GC in the host
  language. Contributors consult `milo skill` and `milo api <term>` before writing Milo
  rather than assuming Rust or TypeScript semantics.

## Development Workflow and Quality Gates

- The loop is research → plan → implement → run → review → wrap-up. Small green commits,
  merged to `main` as each feature cluster goes green, then pushed.
- Parallel agents work in their own git worktrees; `src/engine/eval.milo` and
  `lib/engine-prelude.js` are known collision points.
- The gate set for any change includes, as applicable: the fixture corpus against node,
  `tools/verify-expected.sh`, `tools/check-layering.sh`, the conformance sweep with its
  ratchet, and benchmark baselines for performance-sensitive work.
- Foundational architectural decisions (value representation, memory management, execution
  strategy, event model) are recorded with rationale and the measurements that would
  justify revisiting them.

## Governance

This constitution supersedes other practice documents where they conflict; AGENTS.md
remains the operational router and MUST stay consistent with it. Amendments are made by
editing this file with a Sync Impact Report, a semantic version bump (MAJOR: principle
removal or redefinition; MINOR: new principle or materially expanded guidance; PATCH:
clarification), and the same commit discipline as code. Reviews of specs, plans, and
implementations MUST check compliance with the principles above; a violation either blocks
the change or amends the constitution, never silently stands.

**Version**: 1.0.0 | **Ratified**: 2026-08-25 | **Last Amended**: 2026-08-25
