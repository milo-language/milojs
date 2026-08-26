# Phase 0 Research: Bytecode VM Completion

Grounded in `docs/milojs-roadmap.md` Stage 4 (measurements recorded there and in commit
history) and the current `src/engine/bytecode.milo` (read 2026-08-26).

## R1. Value representation: decide by measurement, early

**Decision**: Run the comparison on the existing subset BEFORE expanding coverage
(SC-007 requires the decision before the final third; this plan front-loads it to before
the first third). Candidates:

- **(a) Boxed `JSValue` tagged enum end-to-end** (today's model): measured 5x over the
  tree-walker on identical work. Zero conversion cost at the evaluator boundary, zero new
  GC exposure.
- **(b) Unboxed f64 lane for numeric locals/temporaries inside a chunk**, boxing at chunk
  boundaries and at any non-numeric operand: measured 12x where it applies. Cost: a
  second stack lane (or tag-split stack) and box/unbox at every semantic-core call.
- **(c) NaN-boxing (single 64-bit word for every value)**: QuickJS's model. Rejected
  UNLESS (b) measures poorly: it re-encodes the whole value model, touches every
  `JSValue` consumer including the GC and the evaluator, and fights Milo's tagged enums
  (the roadmap's "do NOT port QuickJS line-by-line" rule names exactly this hazard).

**Measurement protocol**: implement (b) as a numeric-op fast lane behind the existing
compile step (bounded change: arith/compare opcodes and local slots only), then run the
bench suite + a numeric microbench at (a) and (b) on identical workloads. The recorded
decision entry gets both numbers and the reopening condition ("a workload class where the
losing candidate would win by ≥2x"). If (b) wins materially (expected from the 12x/5x
prior), it becomes the model for numeric-heavy opcodes; values that are not statically
numeric stay boxed. Full NaN-boxing stays a recorded non-goal with its blast radius named.

**Rationale**: (b) captures most of the 12x where programs actually spend time (loops,
arithmetic, indices) without re-encoding the world. The hybrid is strictly incremental:
every opcode starts boxed and earns the fast lane with a measurement.

## R2. Coverage measurement tool

**Decision**: `tools/vm-coverage.mjs`: parse the corpus (node `test/parallel`, the same
3,979 files the roadmap measured) with acorn, walk each function body and loop body, and
classify it against a table of constructs the compiler admits, emitting
`docs/conformance/vm-coverage.json` (generated; revision-attributed like the sweeps) with
per-construct blocked counts ranked by bodies unlocked. The table of admitted constructs
is DECLARED in the tool and cross-checked by a teeth case: a construct listed as admitted
must actually compile (probe program per construct through the engine with a
compiled-vs-fallback witness), so the static table cannot drift from the compiler.

**Alternatives considered**: instrumenting the engine to report admission decisions at
runtime over the corpus — richer truth, but requires running 3,979 node tests (slow,
host-binding-dependent) versus parsing them (seconds). The teeth cross-check closes the
drift risk that made static classification dangerous. Runtime witness stays in the teeth
probe where it is cheap.

## R3. Compiled-vs-fallback witness

**Decision**: expose an opt-in stat (`MILOJS_VM_STATS=1` → one summary line to stderr at
exit: chunks compiled, chunks fallen back, per-blocking-construct counts). Needed by R2's
teeth case, by the coverage tool's honesty, and by anyone asking "did my function
compile?". Off by default; no output change otherwise (node-oracle byte-exactness).

**Rationale**: today the only way to know why a body fell back is reading the compiler.
The residue list (FR-010) needs the reasons machine-readable.

## R4. Coverage expansion order

**Decision**: strictly by corpus-measured bodies-unlocked (the coverage report's ranking),
re-measured after each batch. Roadmap's last measurement puts calls of a plain identifier
(landed) at +39 points; the known next blockers by corpus frequency: method calls
(`o.m(x)`, needs `callValue` thisVal fix for Natives, recorded in the roadmap), `for-of`,
try/catch, closures/captured locals, `const`/destructuring params, template literals,
array literals, `for-in`. The report, not this list, is authoritative once T-coverage
lands.

**Rationale**: the hybrid priority policy (001 clarification) applied inward: measured
pull, not construct aesthetics.

## R5. Equivalence gates per increment

**Decision**: an increment lands only with: (1) `tools/dev.sh` green;
(2) `tools/vm-differential.sh` extended the same commit with matrix entries for any new
operator/shape it compiles, green; (3) both engine sweeps + package gate + per-case
ratchet at-or-above; (4) `MILOJS_GC_THRESHOLD=1` fixture suite green when the increment
touches allocation or rooting; (5) `MILOJS_NO_BYTECODE=1` suite green (CI job exists).
This is the executable definition of spec US1.

## R6. Recursion / stack interaction

**Decision**: no new work needed for FR-005 core (VmFrame calls already reach the 10k cap
platform-uniformly); the deliverable is the cross-platform probe as a fixture plus, at
feature end, re-measuring whether the per-OS `interpStackBytes` split can shrink for the
runtime (the walker still needs its stack for fallback paths, so the darwin branch likely
stays until the milo makecontext fix; record the outcome either way in docs/decisions.md
and docs/backlog.md).

## R7. Non-goals (recorded)

- Full NaN-boxing (unless R1 measurement forces reconsideration).
- Compiling suspension bodies (generators, async): fallback-executed; the VmFrame
  saved-ip design they need is recorded as follow-on (roadmap already notes it).
- A register allocator, inline caches, or JIT: out of scope; this feature finishes the
  interpreter-bytecode tier.
- Splitting bytecode.milo: deferred until it outgrows comprehension (plan §Structure).
