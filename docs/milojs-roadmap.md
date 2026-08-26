<!-- doc-meta
system: roadmap
purpose: staged plan to grow milojs into a JavaScript engine AND runtime that stands on its own
key-files: src/milojs.milo, src/milojs-engine.milo, src/libmilojs.milo, src/engine/bytecode.milo, src/engine/eval.milo, src/engine/builtins.milo, src/engine/regex.milo, scripts/test262-sweep.ts
update-when: a stage lands (check the box, note the commit) or the acceptance target changes
last-verified: 2026-08-26 (stage 4 snapshot updated: value representation decided with its measurement, coverage baseline cited from the new committed report. Previous note: re-verified for the sweeps emitting per-case pass lists; stage narratives unaffected. Previous note: interpreter task stack is now sized per-OS in driver.milo; the 10k cap-bound recursion claim in Stage 4 now holds on linux too, which is what the change was for)
-->

# milojs roadmap — a JavaScript engine written in Milo

> Current status, evidence, and product gates live in `docs/status.md`. This
> document preserves the staged architecture and implementation history; nothing
> below is a worklist.

## Current snapshot (2026-08-19)

The stage notes below are implementation HISTORY: what landed, with its commit. Read them for
how the engine got its shape, never as a worklist — `docs/backlog.md` is the worklist and
`docs/status.md` is the current state. The "still open" paragraph inside Stage 3 said ten things
were missing that have all shipped; it now says so, and this file should not accumulate another.
Since Stage 3, MiloJS has landed CommonJS/ESM module loading, strict equality and additional
syntax, promises and a microtask/event loop, green-task suspension at `await`, Node
compatibility shims, Node-API addon loading, and an end-to-end Prisma query-engine proof.

The engine differential suite currently covers 74 expected-output JavaScript
files (plus one unscored memory benchmark) and is also run with collection at
every GC safepoint. The remaining roadmap is:

- **Stage 4:** supplement the tree walker with bytecode. Partly landed: a numeric,
  property-access, object-literal and CALL subset compiles and falls back for the rest.
  Calls landed once the VM got its own frame stack. The value representation is DECIDED
  (2026-08-26, docs/decisions.md): boxed tagged enum with a raw-f64 lane for
  proven-numeric chunks, measured at 2.2-2.6x on the loop benches. The remaining work is
  coverage, ranked by docs/conformance/vm-coverage.json (baseline: 13.9% of corpus
  function bodies compile; method calls block 60% of the residue).
- **Stage 5:** complete host compatibility. Server HTTP and async fetch work;
  client `http.request`/`http.get`, TLS serving, child processes, generators,
  class fields/getters, computed `require`, and other package-facing edges do not.
- **Stage 6:** largely landed, and the box below is behind the tree. `scripts/test262-sweep.ts`
  runs, the score is published per area in `docs/status.md`, and both sweeps write committed,
  revision-attributed reports into `docs/conformance/`. What is NOT done is the corpus: neither
  suite is vendored, so both depend on a local checkout, and test262 is scored from a
  deterministic 1,500-case sample rather than the whole corpus.

The source and locked fixtures are authoritative when an older stage narrative
below conflicts with this snapshot.

### Safety architecture

The original raw-index arenas are not the end state. Migrate append-only AST
indices to distinct ID newtypes, recyclable scopes and objects to Milo's existing
generational `std/arena.Handle<T>`, parsed programs through a
`BuildingProg -> FrozenProg` phase boundary, and GC safepoints toward an
allocation capability that cannot coexist with unrooted transient values. The
migration order, acceptance evidence, and performance constraints live in
`docs/milojs-arena-safety.md`. The upstream live-handle enumeration prerequisite
landed in Milo `9a0bfa4e`; engine migration remains MiloJS work.

**Scope decision (2026-07-22):** milojs is **our own engine and our own runtime** — a destination,
not a means to an end. It is *not* a JavaScriptCore replacement for minibun. `minibun` and the
node fork at `~/git/node` are frozen: kept for reference, not developed further. Do not justify
milojs work by what it unblocks in either.

**Acceptance target:** `milojs` runs real Node/Express workloads directly — module loader, event
loop, and Node-compatible builtins all its own. No system framework, no V8, no JSC. One binary.

**Why this stands alone:** the *engine* (`milojs-engine`) runs raw JavaScript with no host
bindings, which is what an embedder wants. The *runtime* (`milojs`) adds the module loader, event
loop, and Node surface. Both ship from
[milo-language/milojs](https://github.com/milo-language/milojs) with cross-platform release
binaries. The measure is what real applications it runs and what its conformance number is — not
whether some other host can swap it in.

**The thesis this proves:** Milo already self-hosts its own compiler (lexer → parser → checker →
codegen → LLVM), so Milo can carry a language implementation of this size and shape. The only
piece its ownership model does not hand us for free is a garbage collector, because JS object
graphs are cyclic (`a.b = a`) and single-owner move semantics cannot express a cycle. That GC is
the one genuinely new *mechanism* built here (Stage 2).

An earlier version of this paragraph said a JS interpreter is "strictly less" than the compiler
— no monomorphization, no LLVM backend — and that "everything else is parsing + dispatch Milo is
already good at." That is wrong, and it contradicted §Critical path & honesty six paragraphs
down, which correctly says full ES2020 is a decade. A compiler is a batch transformation whose
input language we define; an engine implements a spec we do not control, with observable
evaluation order, live object identity, and thirty years of accreted edge cases. The evidence is
in this tree: <!--fact:loc-milo-->48.6k<!--/fact--> lines of Milo, one 17.7k-line evaluator, and
a test262 score in the seventies on a sample. "Parsing + dispatch" is the sentence that produced
a 3,100-line `callBuiltin`. Size the work off `docs/status.md`, not off this heading.

## Do NOT port QuickJS line-by-line

QuickJS is ~50k LOC of dense C: NaN-boxing, ref-counting-with-cycle-collector, hand-rolled
allocators. Porting C→Milo fights the ownership model on every line. Use QuickJS as an
*architecture reference* (value model, opcode set, builtin coverage) and write idiomatic Milo:
tagged-enum values, a managed heap of `u32` handles, a mark-sweep collector.

## Stages (critical-path order)

### Stage 1 — tree-walking interpreter: primitives + closures ✅ (f08b267)
Lexer, parser → AST (Milo enums), `JSValue` tagged enum (Undefined/Null/Bool/Number(f64)/
Str/Function), tree-walking evaluator with a lexical scope chain, `console.log`. Statements:
let/var/const, function decl, if/else, while, return, block, expression. Expressions: literals,
identifiers, binary/unary/logical ops (`+` concatenates when either side is a string), calls,
closures capturing their defining scope. **Out of scope:** objects, arrays, `this`, GC, regex,
for-loops, ternary, exceptions, bytecode.
**Proves:** the value model and eval loop on the subset that needs no heap.
**Gate:** a `.js` demo (arithmetic, string concat, if/while, a closure counter) compiles and
prints correct output under `milo run`.
**Landed:** `src/milojs.milo` (~1480 LOC). Value model
`enum JSValue { Undefined, Null, Bool, Number(f64), Str, Func(fnIdx, scopeIdx) }` — `Func`'s
scope index *is* the closure. AST is index-based enums into flat `Vec` arenas (std/json cursor
pattern), scopes an append-only parent-linked `Vec<Scope>` (chosen so Stage 2 marking is an
index walk). `tests/{basics,closures}.js` output verified **byte-identical to `bun`** (fib(20),
two independent counters, closure-over-loop-var, compose). Friction found: no `1e15` float
literals; f64 `!=` is an *ordered* compare so `n != n` is false for NaN (must write `!(n == n)`)
— candidate for a checker lint / `std/math` `isNan`.

### Stage 2 — mark-sweep GC over the scope arena ✅ (this session)
Scopes leaked (one per block/call — a while loop grew the arena unbounded). Added a mark-sweep
collector: **stable slots + free-list reuse, no compaction** (closures + parent links reference
scopes by index — moving a slot would need a fixup reaching in-flight values on the native
stack, which is unreachable). Roots = global scope 0 + an explicit `active` dynamic-call-stack
`Vec` (a fib frame's `parent` is global/lexical, not its caller/dynamic, so the parent chain
alone under-roots the live call stack). Mark walks parent + any `Func(fn, envIdx)` closure envs
in bindings; sweep adds unmarked non-free slots to the free-list and clears their vars.
**Safepoint discipline — the key idea:** GC runs *only* at `execBlock` statement boundaries
(one `maybeGc` call), the sole point where every live value is stored in a scope binding and no
closure is in-flight mid-expression. This makes transient closure refs safe with no temp-root
plumbing — keeps the collector ~130 lines of plain loops, no `unsafe`, no lifetimes.
**What actually happened to that claim (recorded here, not quietly dropped):** the "no
temp-root plumbing" half did not survive the next two stages. Stage 3 added
`Interp.tempRoots` for in-flight receivers and part-built literals; Stage 4 added
`vmStack`/`vmSp`, where every allocating opcode must publish its exact live top by hand and the
failure mode is a wrong answer rather than a crash. The restriction is still in force and is
now a constraint on the VM (`maybeGc` at exactly one opcode), so it is worth knowing it was
paid for twice. The ~130-line collector is the part that held.
**Proof:** GC stress (`tests/gc.js`, ~800k scope allocations) stays byte-identical to `bun`
*and* `MILOJS_GC_STATS=1` shows the **arena capped at 1028 slots** (vs ~800k without GC), 586
collections, live working set 2–4, free-list fully reused. Extend `markScope` with object/array
variants when Stage 3's heap lands — same index-walk shape.
- **Note:** this GCs *scopes*; Stage 3 adds an object/array heap (`Obj(u32)` handle variant on
  `JSValue`) to the same collector. The scope arena proved the model on the cyclic case
  (closure ↔ env) first.

### Stage 3 — objects, prototypes, closures over the heap 🟡 (objects landed)
**Objects done (b956706):** object literals, dot + computed property get/set, nested objects,
reference equality, and an `Obj(u32)` heap cell that flows through the *same* mark-sweep
collector — `markScope` gained a `markValue` that follows `Obj` handles into their props; the
object arena sweeps alongside scopes. Validated the Stage 2 design claim: adding a heap type was
extra `markScope` variants, nothing more. `console.log` inspect matches bun (multi-line, 2-space
indent, double-quoted values). GC stress with 100k short-lived objects stays byte-identical.
**Arrays done (c3f3c44):** literals, indexed get/set with grow-on-write, `.length`, `push`/`pop`,
nesting, arrays-of-objects — arrays reuse the object heap (a JSObj with an `elems` Vec + `isArray`
flag), so the GC marks elements alongside props for free. `console.log` matches bun for scalar
arrays; the multi-line wrap bun applies to arrays *containing* objects/arrays is a known cosmetic
gap (bun's inspect layout heuristic), not a semantic one.
**`this` / `new` / method dispatch done (00c06b2):** method calls bind `this` to the receiver;
`new Ctor(args)` builds an object, runs the constructor with `this`, and honors a constructor that
returns an object. The constructor-assigns-methods pattern and method chaining (`return this`)
work. `this` is a plain identifier bound in each call scope (plain calls get `this = undefined`).
A **temp-root stack** (`Interp.tempRoots`, marked by `collect`) keeps in-flight receivers,
closures, and part-built literals alive across a GC triggered mid-dispatch (a call argument can be
another call) — verified byte-identical under 177 collections. This closed a real
memory-safety hazard, not a theoretical one.
**Landed since:** `for` loops (97ac34b), `typeof`, `try`/`catch`/`throw`/`finally` (exceptions via
an unwinding flag that crosses call boundaries; pending values GC-rooted across finally), and
`++`/`--` + compound assignment + ternary (39cd87f, shared readLValue/writeLValue). During this
work a real **Milo compiler bug** surfaced and was fixed (7e77a0d): match-binding allocas were
numbered from a different counter than `let`/for allocas, so two same-named locals of different
types could collide on one `%name.N.addr` SSA name → link error.
**Native builtins + methods landed (6f312af):** `JSValue.Native` for built-in functions; the
Error family (`Error`/`TypeError`/`RangeError`/`SyntaxError`/`ReferenceError`) + `instanceof`
(per-object `ctor` slot for user constructors, error-kind match for the Error family); and the
big one — String methods (`length`/index/`toUpperCase`/`trim`/`slice`/`split`/`indexOf`/
`includes`/`replace`/…) and Array methods (`map`/`filter`/`reduce`/`forEach`/`join`/`indexOf`/
`slice`/`reverse`/`concat`/…), all byte-identical to bun, including `.split().map().join()`
chaining. String helpers live in a new `src/engine/builtins.milo`; callback array methods stay in `src/engine/eval.milo`
(they need `callFunction`). *Hazard found:* Milo flat-compiles all files into one namespace, so
milojs helper names must not collide with std (mine shadowed `std/string`'s `strIndexOf` and broke
std internally until renamed).
**JSON landed (e943e78):** `JSON.stringify` (compact, nested, escaping, undefined/function
omission, NaN/Infinity→null) and `JSON.parse` (recursive-descent over a byte cursor, builds heap
objects/arrays, temp-rooted while building). `JSON` is a global object whose methods are native
functions; `callMember` now dispatches `Native`-valued props. The real path
`JSON.parse(x).map(...).reduce(...)` is byte-identical to bun.
**Prototype-chain landed (eeb9043):** functions get a lazily-created `.prototype` object
(`funcProtos`, a GC root); `new F()` links the instance's `proto`; `getMember` walks own-props →
prototype chain (own props shadow). Shared methods, `this`-chaining through prototype methods,
`instanceof`, and shared function identity (`a.m === b.m`) all byte-identical to bun — the ES5
class pattern works. This was the last core *language* gap.
**Math landed (231fbbe):** `floor`/`ceil`/`round`/`trunc`/`abs`/`sign`/`min`/`max` in **pure Milo**
(byte-identical to bun — no FFI), `sqrt`/`pow` via the hardware/libc extern (IEEE
correctly-rounded), `random` via a pure-Milo xorshift64 PRNG, plus `PI`/`E`. `Math` is a global
object with native-fn methods.
**Regex landed (4481b3f):** a pure-Milo backtracking engine in `src/engine/regex.milo` (pattern → node tree
→ bytecode → recursive backtracking VM). Char classes/ranges/negation, `\d\w\s`, quantifiers
`*+?{n,m}` greedy+lazy, groups/`(?:)`, alternation, anchors `^$`, `\b\B`, flags `i/g/m`.
`new RegExp` + `re.test`/`re.exec` + `str.replace(re,$1)`/`str.match`. Byte-identical to bun (incl.
`$3/$2/$1` date reformat). No C dependency. Represented as an `Obj` with a hidden `regexId`.
Deferred: `/.../ ` literal lexing, `str.split(regex)`, backreferences, lookaround, named groups.

**Parser: arrows + let/const multi-declarator (b73b4b6), template literals + spread (this fire)** —
all byte-identical to bun. The QuickJS corpus should now parse on most files.

**Two-binary split (4be585e): `milojs-engine` (the engine) + `milojs` (the runtime).** Runtime has
process/global; ran the tahoeroads express bundle → it's a CommonJS module (`require` ×15,
`Object.defineProperty`, express/compression/trpc/prisma...). Booting it is the whole Stage-5
runtime: **module loader (`require`) is the critical next build**, then `Object.defineProperty`,
fs/http shims, and every npm package express pulls in (minibun spent many sessions on 20/21
packages — same surface). (Those parser gaps — comma operator, `void`/`delete`, `in`, bitwise — are all closed; see the note at the end of this stage.)
**Closed since (verified 2026-08-19 by running each):** promises + the async event model,
`switch`, `for...in`/`for...of`, bitwise ops, real `===`, the comma operator, `void`, `delete`,
and `in`. Every item this stage listed as open is done; the list is kept only so a reader who
finds an old failure message here does not reopen one of them as a lane.
**Gate:** prototype-based method dispatch + a class-ish pattern (constructor + prototype methods).

**Test yardstick (decided):** milojs *is* the engine, so unlike minibun's JSC, both test262 and
QuickJS's own `~/git/quickjs/tests/` grade milojs directly. QuickJS's suite is the near-term
target (local, pure-JS, self-contained `assert()`), but its `test_language.js` needs
`try`/`catch`/`throw`, `typeof`, `for`, `instanceof` — so those features gate suite adoption.
Until then: byte-identical-vs-bun differential smokes in `tests/`. Package test suites don't
apply (they need the node runtime = minibun's layer, not the engine).

### Stage 4 — bytecode VM 🟡 (a subset compiles, calls included; the value model is the open half)
`src/engine/bytecode.milo` compiles a `for` statement or a whole function body to a flat
opcode array and runs it in one dispatch loop, falling back to the tree-walker for anything
outside its subset. That fallback is the design, not a stopgap: both engine sweeps held their
exact numbers through every step below, because a chunk that cannot be compiled is never run.

**Compiles today:** numbers, strings, locals, arithmetic and comparisons, `if`/`while`,
`return`, property reads and writes, plain object literals, and calls of a plain identifier.
Arithmetic fast-paths two numbers
and hands everything else to the evaluator's own `evalBinValues`/`memberOfValue`/
`setMemberOfValue`, so there is one implementation of ToPrimitive ordering and of the
primitive-receiver rules, not two.

**Rooting:** the frame lives on `Interp` as `vmStack`/`vmSp` and `collect` marks `0..vmSp`, so
"what is live" is one array rather than whatever the evaluator happened to be holding. Any
opcode that re-enters the evaluator publishes the exact live top first. Verified under
`MILOJS_GC_THRESHOLD=1`, which collects on every allocation.

**Three measurements that decide the rest of this stage.** Per-bench numbers move with the
tree, so they live in the commit messages and `bench/`; these are the durable findings:

- A dispatch loop is worth about **12x** the tree-walker on identical work when values are
  unboxed `f64`, and about **5x** once they are boxed `JSValue`. So the boxing question below
  is not academic: it costs half the win.
- **Calls cannot be compiled by handing control back to `callValue`** — and this one is now
  FIXED, which is why it reads as history rather than as a blocker. A self-recursive function
  reached depth **1** that way, against **2156** for the tree-walker. It was not the per-call
  chunk copy; removing that changed nothing. It was `runChunk`'s own native frame: one large
  dispatch function whose frame dwarfs the tree-walker's chain of small ones, paid again at
  every level. The fix was the frame stack the finding asked for — `VmFrame` on `Interp`, a
  compiled callee getting `pc = 0` inside the SAME `runChunk` invocation. Measured now:
  **10,000 frames**, which is the `callDepthLimit` backstop rather than the native stack (node
  on this machine: 10,399). A callee that does not compile (a native, a generator, an async or
  bound function, a proxy) still costs one native round trip through `callPlainValue`, which is
  what the tree walker pays for every call anyway. The same frame stack is what generators on a
  saved instruction pointer will need.
- Two narrower blockers found on the way, both real: `callValue` **drops `thisVal` for a
  `JSValue.Native`** (it forwards to `callNativeProg`, which takes no receiver), and
  `callBuiltinByName` is **not** a general substitute: it is one branch of `callMember`'s
  per-object-kind dispatch, and using it generally broke `Reflect.apply`. Method calls need
  the first of those fixed.

**Coverage, measured with acorn over node's `test/parallel`** (3,979 files): the corpus has 618
loops and 21,617 function bodies, which is why the function body is a compilation unit and not
just the loop. Supporting calls is worth about **39 more points** of covered function bodies
than anything else on the list, three times the next largest step.

**Gate:** every Stage 1–3 demo produces identical output with the VM enabled; both engine
sweeps unchanged; `tests/deepRecursion.js` passes.

### Stage 5 — host compatibility: the builtins real packages reach for ⬜
Complete the standard library and Node surface that npm packages actually touch. Server HTTP and
async `fetch` work; client `http.request`/`http.get`, TLS serving, child processes, generators,
class fields/getters, and computed `require` do not. We own the microtask queue outright, so
there is no API-boundary drain to work around.
**Gate:** a real Express/tRPC application serves its routes under `milojs` end to end. `RegExp`
and `Date` are the long poles — spec-correctness diverges from "expressible" there.

### Stage 6 — test262 conformance, measured and growing 🟡 (harness + published score landed; corpus not vendored, scored from a sample)
**Why this is a real goal, not a footnote:** an engine that only runs "the subset our apps need"
is a private tool nobody else can trust. What makes milojs usable *as* an embeddable engine
(the QuickJS-alternative pitch) is a **published, honest conformance number that goes up over
time**. So test262 is the standing metric, not a one-time lock.

Concretely:
- **Harness:** vendor a pinned test262 checkout; a milojs runner that parses each test's YAML
  frontmatter (`includes`, `flags: [onlyStrict|noStrict|module|raw|async]`, `negative`,
  `features`), prepends `harness/sta.js`+`assert.js`, runs strict & sloppy, and honors negative
  (parse vs runtime) + async (`$DONE`) tests. This is the QuickJS `run-test262` contract.
- **Metric:** report `pass / total` per top-level area (`language/`, `built-ins/`,
  `intl402/`, `annexB/`) every run, checked into a `test262-status.md` so the trend is visible.
  Exclude nothing silently — an excluded/failing test is logged with the reason.
- **Grow-and-lock:** probe → fix → lock (the JSON/base64 pattern), but the locked set is a
  *ratchet on the whole suite* — the number only moves up, regressions fail CI.
- **Honesty:** full ES2020 is a decade (QuickJS too — one person's life's work). We do **not**
  claim conformance we don't have; we publish exactly where we are and grow it. `RegExp`, `Date`,
  and Number formatting are the big "expressible ≠ spec-correct" cliffs — expect the number to
  stall there and log precisely which sub-areas are unimplemented.

Target ladder (illustrative, to be set from the first real run): host compatibility (Stage 5)
needs only a slice; a *credible public engine* wants `language/` + core `built-ins/` in the high
90s%. Measure first (see below — the QuickJS `tests/` microtests are the cheap pre-test262
smoke), then set the ladder.

## Critical path & honesty

Stage 1 → 2 → 3 → 4 → 5 → 6, mostly linear (2 and 3 are the hard middle; 4 can overlap 5 once
the value model is frozen). **Where it genuinely stalls:** the GC (Stage 2) and `RegExp` +
`Date` + Number formatting edge cases (Stage 5) — big surface where "expressible" and
"spec-correct" diverge. Everything else is mechanical parsing/dispatch.

**This is a from-scratch engine, not a binding effort.** That makes it larger, but it is also
what makes it ours: no C++ engine underneath, nothing to swap out. Each stage is independently
demoable: Stage 1 runs closures; Stage 3 runs OO JS; Stage 5 runs real npm packages.

## Embedding — how others FFI in (the "like bun/QuickJS" surface)
Milo exposes a **stable C ABI**: top-level `fn`s use the C calling convention, and
`milo build-lib src/libmilojs.milo -o libmilojs.a` emits the archive **+ a companion `libmilojs.h`**.
The public embedding API is opaque-pointer + scalar (`MiloJSContext*`, handle-based values) —
exactly QuickJS's `JSContext*`/`JSValue` shape, and exactly what minibun already does when it
hands Milo function pointers to JSC as C callbacks. So milojs is embeddable from C/C++/Rust
(cgo/ctypes too) the day its API is C-spellable. (Caveat: define-side struct-by-value *return*
is not yet lowered — irrelevant, an engine API is opaque pointers anyway.)

## Open questions
- Value representation: tagged Milo enum (clean, a word of tag overhead) vs NaN-boxed f64
  (QuickJS-style, denser, unsafe bit-twiddling). Lean was **tagged enum through Stage 4**,
  revisiting boxing only if the VM benchmarks demanded it. They now do: boxing measured at 2x
  on the compiled subset, i.e. half the dispatch win. The condition attached to that revisit
  was "after calls land, not before" — **calls have landed, so this is the open decision of
  Stage 4, not a deferred one.** Note also that "fights the ownership model" (see *Do NOT port
  QuickJS line-by-line*) is a real argument against NaN-boxing and hand-rolled allocators and
  the OPPOSITE of true for interned property keys: a `u32` atom is friendlier to move semantics
  than an owned `string`, because there is nothing to clone and nothing to drop. Atoms were
  swept into a blanket rejection whose stated reason does not apply to them, and
  `docs/backlog.md` §Perf re-derived them from a profile two stages later. Do not let the
  heading do that again to the next idea it happens to share a paragraph with.
- GC: mark-sweep (simple, stop-the-world) vs ref-count-with-cycle-collector (QuickJS's choice,
  incremental but complex). Lean: **mark-sweep first** — correctness before pause times.
- Keep the tree-walker permanently as a differential oracle, or delete it after Stage 4? (lean:
  keep — it is the cheapest VM correctness check we will ever have.)
- Keep the Node-compat shims as pure JS (`lib/*.js`), or rewrite the hot ones as Milo builtins
  for speed? (lean: JS first, profile, promote later.)
