<!-- doc-meta
system: decisions
purpose: standing architectural decisions, each with its rationale and the measurement that would justify reopening it
key-files: src/engine/bytecode.milo, bench/ab.sh, src/engine/value.milo, src/engine/runtime.milo, src/engine/eval.milo, src/engine/driver.milo, src/milojs.milo, src/milojs-engine.milo
update-when: a decision is made, revisited, or its reopening measurement fires
last-verified: 2026-08-26 (re-verified after mode B: the execution-strategy entry gains no new rule; declared locals move between slot and scope backing per chunk, decided at compile. Previous note: re-verified for the ops batch: the shared-core rule now also covers in/instanceof/loose-eq, which strengthens the execution-strategy entry rather than changing it. Previous note: re-verified after Op.CallMember: the execution-strategy entry already describes the shared-core rule the opcode follows; lane and rooting entries unchanged)
-->

# Standing decisions

One entry per decision that shapes the engine. Each records what was decided, why, and
the measurement that would justify reopening it — so future work replaces a documented
decision instead of excavating an implicit one. Depth lives in the linked subsystem docs;
this file is the index.

## Value representation: boxed tagged enum, with a raw-f64 lane for proven-numeric chunks

**Decided 2026-08-26.** JS values are the `JSValue` tagged enum everywhere semantics can
observe them. Chunks whose every op is numeric (comparisons only feeding the immediately
following conditional jump — see `numericOnly()` in `src/engine/bytecode.milo`) run on a
raw `f64` stack (`runChunkNumeric`) with an entry guard: any outer seed that is not a
plain Number answers None before any side effect and the boxed path runs instead.

**Measured (bench/ab.sh, best-of-9 interleaved, darwin-arm64):** the lane took arith
151→58ms (−61.6%), emptyLoop 81→37ms, numRead 136→54ms, localRead 72→34ms, loopNoDecl
122→50ms; call-dominated benches unchanged. This matches the archived experiment's
12x-unboxed vs 5x-boxed prior: boxing costs roughly half the dispatch win, and the lane
recovers it exactly where programs spend numeric time.

**Full NaN-boxing is a recorded non-goal:** it re-encodes every value for the whole
engine (GC, evaluator, every consumer) to speed the same code the lane already covers,
and porting QuickJS's model wholesale is what the roadmap's "do not port line-by-line"
rule exists to prevent. **Reopen when:** a measured workload class shows the boxed
general path (not the lane) dominating end-to-end time in a way per-opcode work cannot
close, with a ≥2x projected win from re-encoding.

## Memory management: mark-sweep over stable slots, no compaction

Scopes and objects live in arenas with stable indices and free-list reuse; closures and
parent links hold indices, so moving a slot would need a fixup reaching in-flight values
on the native stack. The VM stack is a root up to `vmSp`, and every opcode that can
allocate publishes its exact live top first. Detail: `docs/milojs-arena-safety.md`,
`docs/milojs-object-footprint.md`. **Reopen when:** fragmentation measurably drives
footprint (arena occupancy vs live bytes) on a real workload.

## Execution strategy: bytecode VM primary, tree-walker as the semantic fallback

Whole-unit admission before execution; a unit outside the subset runs on the walker with
identical observable behavior; mid-unit escapes happen only through the shared semantic
core (`evalBinValues`, `memberOfValue`, `setMemberOfValue`, `callPlainValue`). Compiled
calls stay inside one dispatch invocation (`VmFrame`), so they spend no native stack and
recursion depth is the `callDepthLimit` cap. Coverage is measured, committed, and floored
(`docs/conformance/vm-coverage.json`, `tools/check-vm-coverage.mjs`). **Reopen when:**
the coverage residue is spent and the bench gap to peers is still dominated by dispatch
itself (that is the JIT/IC conversation, a different feature).

## Event model: green tasks, microtask queue, park/resume at await

The interpreter runs on a green task; generators and async bodies are tasks that park.
Detail: `docs/milojs-async-suspension.md`, `docs/milojs-generators.md`. **Reopen when:**
a workload needs OS-thread parallelism inside one engine instance.

## Embedding: single live context per process

The C ABI (`docs/milojs-embedding.md`) supports create → evaluate → exchange → destroy,
leak-free, one context at a time. **Reopen when:** a real embedder needs concurrent
contexts; the cost is un-globaling the interpreter state.

## Interpreter stack: sized per-OS until milo owns the context switch

128 MB on linux (glibc faults lazily; the 10k frame cap binds first, so recursion depth
is exact and platform-uniform), 16 MB on darwin (Apple's `makecontext` writes through
the whole mapping — a do-nothing 128 MB context peaks at 135 MB RSS; C repro 2026-08-26).
See `interpStackBytes` in `src/engine/driver.milo` and the backlog entry. **Reopen
when:** milo's scheduler replaces system ucontext on darwin (delete the darwin branch),
or VM coverage makes walker recursion rare enough that the split stops mattering.

## Priority policy: conformance ranking by default, target-app blockers jump the queue

Per the 2026-08-25 clarification on spec 001: the sweeps' per-area failure counts rank
the default worklist; a failure blocking the target application class (Node/Express
server workloads) outranks its count. For VM coverage the same policy reads: the ranked
blocker list in `vm-coverage.json` orders the work.
