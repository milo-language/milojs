# Phase 0 Research: Scalable Engine and Runtime Foundation

Each entry resolves a decision the plan depends on. Facts were read from the repo on
2026-08-25 (AGENTS.md, docs/status.md, docs/milojs-roadmap.md, tools/, bench/).

## R1. Conformance ratchet mechanism

**Decision**: Ratchet on committed per-case pass sets, one file per suite
(`docs/conformance/passset-*.txt`, sorted case paths). Gate fails if any case in the
committed set is absent from the current sweep's pass list; improvements rewrite the file
(grow-only) in the same commit as the change that earned them.

**Rationale**: The existing ratchets (defect budget, bench budget, layering exemptions,
docs staleness) all use the same shape: committed state + a check that only lets it move
one way. Pass sets extend that shape to FR-003's actual requirement, "previously passing
test now fails blocks the change", which aggregate percentages cannot express (a +5/-5
swap looks flat). Per-case sets also give contributors the diff-by-FILE comparison
AGENTS.md already mandates for A/B runs.

**Alternatives considered**: (a) Ratchet the aggregate pass count — rejected: masks
swaps, and the sweep report already carries per-case data so aggregation throws away the
signal. (b) Block on any sweep delta in CI by re-running sweeps per commit — rejected:
the node corpus sweep is too slow for per-commit CI; the ratchet check against committed
state is O(diff) and instant, with the sweep itself run when conformance-relevant work
lands (which is when the file changes).

## R2. Sweep reproducibility (corpus pinning)

**Decision**: Keep corpora un-vendored but enforce the pin: sweeps already record corpus
revisions (test262 `b363f29d`, quickjs `ef7a3a74`); the ratchet gate refuses to compare
reports produced from a different corpus revision than the committed pass set's header.

**Rationale**: Vendoring 48k test262 files into this repo costs more than it buys; the
failure mode to prevent is a silent corpus drift making the ratchet compare
incommensurable runs, and a revision check in the gate closes exactly that.

**Alternatives considered**: Vendor test262/QuickJS as submodules — rejected for repo
weight and because the sample is seeded + revision-stamped already; revisit only if
corpus checkout friction shows up in practice.

## R3. Scaling benchmarks (complexity bounds)

**Decision**: `bench/scaling/` workloads, each a single JS file taking its size N from
argv, run at two sizes a decade apart (N, 10N). Each workload declares its expected
exponent in a manifest (linear: cost(10N) ≤ ~12x cost(N); linearithmic gets slack;
nothing is allowed a quadratic bound without a written argument). Gate
`check-scaling-budget.mjs` compares measured ratio to the declared bound with generous
noise tolerance (2x) — it exists to catch cliffs (100x on a 10x input), not 20% drift.
Initial workloads: parse (large flat source, large deep source), execute (loop count,
call depth via trampoline, property-map growth), allocate (object churn with constant
live set, growing live set), string building, array growth.

**Rationale**: SC-004 is about detecting superlinear collapse, the class of failure the
project already hit once (quadratic GC). Absolute time vs bun is covered by the existing
bench budget; the ratio-at-two-sizes design is immune to machine speed and load, which
absolute numbers are not.

**Alternatives considered**: Fit a curve at 4–5 sizes — rejected: slower, and the gate
needs a cliff detector, not a publishable exponent estimate. Reuse existing `bench/`
fixed workloads — rejected: they intentionally measure per-op cost at one size.

## R4. Memory plateau gate

**Decision**: One guarded workload with a constant live set running allocation churn for
a fixed op count, sampling peak footprint at intervals; `check-memory-plateau.mjs`
asserts late-window peak ≤ early-window peak × tolerance. Runs in the same suite slot as
the existing unscored memory benchmark, which it subsumes.

**Rationale**: SC-005 verbatim. Ops-count based (not wall-clock) so it is deterministic
under load; guarded per the constitution's safety section.

**Alternatives considered**: Full leak-oracle run per commit — already covered for
teardown paths by the embed suite + leak oracle; the plateau gate targets steady-state
GC behavior, which leak-at-exit cannot see (garbage reclaimed at exit hides mid-run
growth).

## R5. Embedding contract scope

**Decision**: Formalize the CURRENT contract: single context per process, create /
evaluate / exchange values / register host functions / destroy, leak-free teardown gated
by the leak oracle in `run-embed.sh`. Multi-instance is documented as a recorded
limitation with its revisit-measurement (an embedder use case that needs it), NOT built
now.

**Rationale**: FR-006's acceptance scenarios are satisfiable single-context except
"creating and destroying instances repeatedly", which create→destroy→create-again
satisfies without concurrent instances. Lifting the single-context constraint touches
global state across the engine and has no current consumer; the constitution requires
faster/bigger strategies stay *reachable* (documented), not built speculatively.

**Alternatives considered**: Build multi-context now — rejected: no consumer, large
blast radius, and it would compete with conformance work that has measurable pull.

## R6. Architectural decision records

**Decision**: One `docs/decisions.md` index with doc-meta, one section per standing
decision: value representation (tagged enum `JSValue`; open question: bytecode VM value
model — NaN-boxing vs current enum), memory management (mark-sweep, stable slots,
free-list, no compaction — and why compaction is off the table), execution strategy
(tree-walker + partial bytecode VM, fallback semantics), event model (green tasks,
microtask queue, park/resume), single-context embedding (R5). Each entry: decision,
rationale, the measurement that would justify revisiting. Existing subsystem docs keep
the detail; the index links rather than duplicates, and lists its key-files so the
staleness ratchet watches it.

**Rationale**: FR-011. The bytecode value-representation question is live in the roadmap
("the remaining prize... now the open question") but recorded nowhere as a decision with
criteria; that is exactly the excavation FR-011 exists to prevent.

**Alternatives considered**: Per-decision ADR files — rejected: repo convention is few
substantial docs with doc-meta blocks and a staleness ratchet; ten one-page ADRs would
each need meta + key-files for little gain at this count. Revisit if the index outgrows
one file.

## R7. What is explicitly NOT in this foundation phase

- Bytecode VM completion / value-representation change itself (Stage 4 work): this plan
  records the decision criteria (R6) and provides the benchmarks that would prove a win
  (R3); the VM work proceeds under its own specs.
- Crypto, TLS client serving, child-process edges, and other Stage 5 host surface: the
  node-compat sweep and backlog already rank these; this plan's ratchet protects that
  progress but does not schedule it.
- Multi-context embedding (R5).
- Vendoring conformance corpora (R2).
