<!-- doc-meta
system: milojs-generators
purpose: how generators work in milojs (status), plus the pre-implementation design kept as historical rationale
key-files: src/engine/eval.milo, src/engine/parser.milo, src/engine/ast.milo
update-when: generator behaviour changes, or a claim in the historical half is found to have rotted
last-verified: 2026-09-22 (re-verified after the typed-array dispatch commit: Interp.taProtoObj/taProtos/taProtoPristine guard the direct call over all twelve prototypes, getMember no longer synthesises a bound method per read, typedArrayOverride is gone, %TypedArray%.prototype is rebuilt in node's order with its @@toStringTag getter, and of/from move onto %TypedArray% in the engine prelude. Previous note: re-verified after the DataView dispatch commit: Interp.dataViewProtoObj/dataViewProtoPristine guard the direct call, getMember no longer synthesises a bound method per read, and DataView.prototype gains the BigInt64/BigUint64/Float16 accessors and @@toStringTag in node's order. Previous note: re-verified after the RegExp dispatch commit: Interp.regexProtoPristine guards the direct call, String's regex operations hand themselves to the argument's symbol methods (stringRegexProtocol), RegExp.prototype.test and the symbol methods are generic over objects and run the spec algorithms self-hosted in the engine prelude unless the regex is plain (regexIsPlain), and a RegExp subclass instance keeps its base's own slots. Previous note: re-verified after the Date dispatch commit: Interp.dateProtoPristine guards the direct call as arrayProtoPristine does, getMember no longer synthesises a bound method per date read, Date.prototype[@@toPrimitive] runs OrdinaryToPrimitive through the receiver, toJSON is generic under the internal name __dateToJSON, and the toPrimitive helpers lose their isDate shortcuts. Previous note: re-verified after WeakMap/WeakSet became their own natives: Builtin.WeakMap/WeakSet with BRAND_WEAKMAP/BRAND_WEAKSET, entries in the Map side table under JSObjExtra.weakKind (not isMap/isSet), the prelude class is gone, and buildNativeProto installs constructor first to match node's property order. Previous note: re-verified after the symbol primitive commit: JSValue gains Sym(id), symbols live in Interp.symDescs/symHasDesc/symRegistered plus a Symbol.for registry, well-known symbols are fixed ids WK_* registered first, and a symbol property key is spelled only by symKey/symIdOfKey (0xFF then the decimal id), so no string can collide with one; Symbol.for/keyFor are natives. Previous note: re-verified after the closure function-object commit: JSValue.Func carries a third field, an index of a real JSObj that is the closure's identity and its property bag, minted only by makeClosure; Interp.funcProtos, Interp.funcStatics and Scope.fnStatKeys/fnStatVals are gone, `.prototype` is an ordinary own property of that object, and JSObj.ctor is replaced by fnIdx/fnEnv; a generator function's `.prototype` is now created with its other own properties and linked to %GeneratorPrototype% there, the chain described below is unchanged. Previous note: re-verified after the scoped-temp-root commit: evalArgs leaves its roots pushed and callMember/evalCall/evalNewArm/callOptional truncate st.tempRoots back to their entry depth; the eval scope is pushActive while it runs; slice and splice root their result across proxy traps; tools/gc-stress.sh gates it. saveExecCtx/restoreExecCtx copy tempRoots whole, so a park inside a native call keeps the boundary's extra roots and truncation on resume still lands on the right depth; nothing about suspension changes. Previous note: re-verified after the class heritage commit f035b8d (ClassDef.superExpr: any LeftHandSideExpression is evaluated once at class creation, a non-constructor heritage is a TypeError, extends null gives a null-prototype C.prototype) and c8c0c78 (__jsonStringifyFast registered as an engine intrinsic); nothing this doc describes changes. Previous note: re-verified after a91f36c (every imported name listed explicitly for the current milo compiler) and 7b2b447 (ToNumber of a symbol throws at every coerced argument); import lists and coercion helpers, nothing this doc describes changes. Previous note: re-verified after top-level `this` and global-descriptor commit (unbound this answers the global object, CommonJS binds this to exports, markBuiltinGlobals fixes the builtin/var boundary for globalThis descriptors) and the JSON.stringify fast path; nothing this doc describes changes. Previous note: re-verified after the property-descriptor commit: Object.defineProperty/defineProperties/create normalise through toPropertyDescriptor and array methods root their arguments; nothing about generators changes. Previous note: re-verified after the host-std import ratchet: the only source change is eval.milo losing an unused std/fetch import that host.milo now declares itself; nothing this doc describes changes. Previous note: re-verified after the throwErr unification and the isJsSpace/isJsWs removal: every throwing/thrownValue/return-undefined triple in eval.milo now spells return throwErr(...), a textual substitution; nothing this doc describes changes. Previous note: re-verified after the Map/Set constructor and dispatch commit: the constructor now drives a generator argument through genNext one entry at a time and closes it with genResume mode 2 on an abrupt entry, which is the same resume protocol this doc describes; nothing about how a generator suspends changes. Previous note: re-verified after the timer unref and mkdir errno commits: the event loop now ignores unref'd timers when deciding whether to sleep, which does not change how a generator suspends or resumes. Previous note: re-verified after the explicit &mut call-argument migration: every bare argument bound to a &mut parameter now reads '&mut x', a spelling change only; no behaviour this doc describes changes. Previous note: re-verified after mode B: suspension bodies still never compile. Previous note: re-verified for the ops batch: suspension bodies still never compile. Previous note: re-verified after op.callmember: generator bodies still never compile (suspension-body), and a generator method called via callmember takes the walker path it always took. Previous note: re-verified after the raw-f64 lane in the evaluator dispatch path: generator bodies are rejected by the chunk compiler (suspension-body), so no generator path runs on the lane. Previous note: re-checked against the evalUnArm change: the unary operator is now decided into a UnOp before the operand is evaluated, which fixes a dangling AST borrow and changes no behaviour this doc describes)
-->

# milojs: generators (design of record)

## Status (2026-08-19): all three slices shipped, on BOTH binaries

Working and fixture-covered (`tests/runtime/generators.js`,
`generatorGcRoots.js`), byte-identical to node: `next()`, bidirectional
`next(v)`, early `return` (value with `done:true`), `for-of` / spread /
`Array.from` consumption, `yield*` delegation, infinite generators with `break`,
clean process exit when a generator is abandoned mid-iteration, GC over a
generator parked at a `yield` (R7-style, under `MILOJS_GC_THRESHOLD=1`), and
generators interleaved with `async`/`await`.

Two design points that changed during implementation:
- **No current-generator stack.** Each generator body runs on its own green
  task, so `yield` resolves its generator by `schedulerCurrent()==genTask`. The
  per-task stack this doc assumed (for nested generators) is unnecessary — task
  identity already distinguishes them.
- **Records are removed on completion.** A finished generator's stale body-task
  pointer would otherwise collide with a later generator whose freshly-spawned
  task reuses the freed address, mis-resolving `yield`. `genNext` drops the
  record on the terminal read; a later `next()` on the object (still flagged
  `isGenerator`) returns `{done:true}`.

**No longer runtime-only.** This section used to say generators need the
green-task scheduler that only the runtime binary starts, that `next()` throws on
the engine, and that the QuickJS sweep therefore cannot benefit. The engine now
runs the program on a green task too, so all of it works under
`milojs-engine`. Re-verified 2026-08-15: `next()`, `yield*` delegation with
`finally`, `gen.return()`, `gen.throw()`, async generators and `for await` all
produce output byte-identical to node under the engine binary.

**Slice 3 is done.** `gen.return()` and `gen.throw()` ship (see the backlog for
`genResume`, the per-task `genReturning` flag, IteratorClose, and completions
forwarded inward through `yield*`). Direct array destructuring
`const [a, b] = gen()` also works: declarators now bind the temp to `[...expr]`,
so the iteration protocol runs instead of an indexed read.

**A generator object has a real prototype chain** (2026-08-17). It used to have
none: `makeGenerator` built a bare object and `next`/`throw`/`return`/
`[Symbol.iterator]` were synthesised in `getMemberDyn` before any chain walk, so
nothing else was reachable. That was invisible until the iterator helpers landed
on `%IteratorPrototype%` — `[1].values().map(f)` worked and `gen().map(f)` was
`undefined`, for all eleven of `map`/`filter`/`take`/`drop`/`flatMap`/`reduce`/
`toArray`/`forEach`/`some`/`every`/`find`.

The chain is now the spec's shape: generator object → the generator function's
`.prototype` → `%GeneratorPrototype%` → `%IteratorPrototype%`.
`%GeneratorPrototype%` (`Interp.genProtoObj`, created on first use by
`generatorProtoHandle`) holds nothing but `@@toStringTag = "Generator"`. It exists
as its own level rather than linking straight to `%IteratorPrototype%` because
that one tags itself `"Iterator"`, and `util.types.isGeneratorObject` reads the
tag — linking one level higher made every generator report `[object Iterator]`.

It is also an explicit GC root. Normally it is reachable through some generator
function's `.prototype`, but it is created BEFORE that link is made, and a
collection in that window would sweep it; `collect` marks the field directly and
`generatorProtoHandle` publishes it before the `objSet` that can allocate.

The function's `.prototype` is an ordinary own property of its function object
(2026-09-22), created by `propertyBagOf` together with `name` and `length` and
linked to `%GeneratorPrototype%` there; unlike a constructor's, it carries no
`constructor`. When a program has replaced it with a primitive, `makeGenerator`
falls back to `%GeneratorPrototype%` directly.

---

# The original design (HISTORICAL — everything below shipped)

Everything from here down is the plan as written BEFORE generators existed, kept
because the reasoning about suspension is still the best explanation of why the
implementation looks the way it does. It is not a worklist, and two of its
prescriptions were wrong — the Status section above records which and why.
Verified 2026-08-19: `function* g(){ yield 1; yield 2 }` spreads to `[1, 2]` and
`g().next` is a function under `milojs-engine`, so the "already parses far enough
to throw 'generator functions are not supported'" framing this section opens with
has not been true for some time.

The approach was to reuse the async-activation machinery (green tasks +
park/unpark + ExecCtx save/restore) already built for await suspension — `yield`
is structurally the same suspension as `await`, so this was cheaper than a
from-scratch coroutine. That part held.

## The reused machinery (src/engine/eval.milo)

`spawnActivation` is the template: it spawns the body on an 8 MB green task, the
body runs and unparks its caller at the first suspension point, and the caller
parks and later resumes restoring its ExecCtx via `resumeExecCtx`. Study also
`saveExecCtx`/`resumeExecCtx`, `schedulerPark`/`schedulerUnpark`, the
`actTask`/`actPromise`/`suspended` vectors, and how `collect` marks parked
activations' roots. (This used to cite "`spawnActivation` (5073)". It is at 12466
today, which is the argument against line numbers in prose: grep the name.)

## The key difference from async activations

An async body runs to its first `await` AUTOMATICALLY (the caller parks
meanwhile). A generator body starts PAUSED and runs only when `next()` is called,
and `yield` is BIDIRECTIONAL — `yield e` returns the value passed to the
resuming `next(v)`. So a generator is a persistent task that pauses at every
`yield` and resumes on each `next()`, passing a value in each direction.

## Generator object

A JSObj flagged `isGenerator`, with a side record (parallel vectors keyed by the
gen object index, like actTask — or a HashMap<i64, GenState> per the object
side-table plan) holding:

- `task`: the body's green-task ptr.
- `state`: start | suspended | running | done.
- `yielded`: value handed out by the current `yield`/return (→ next()'s caller).
- `sent`: value passed into `next(v)` (→ the yield expression's result).
- `ctx`: the saved ExecCtx while the gen is parked at a yield.
- these are GC roots while parked — `collect` must mark `yielded`/`sent` and the
  saved ctx, exactly as it does for suspended activations.

## Protocol

- **Call a `function*`** → `makeGenerator(fnIdx, env, args, this)`: create the gen
  object, spawn the body task which IMMEDIATELY parks (waiting for the first
  `next`). Do NOT run the body. Return the gen object. (The plan added "push the
  gen onto a CURRENT-GENERATOR stack keyed by task". **Not built, and not needed**
  — see "No current-generator stack" above: each body has its own green task, so
  `schedulerCurrent()==genTask` already resolves which generator a `yield`
  belongs to.)
- **`gen.next(v)`**: if done → `{value: undefined, done: true}`. Else set
  `sent = v`, save the caller's ExecCtx + park the caller, unpark the gen task.
  The gen resumes (restore its ctx), runs to the next `yield`/return/throw, which
  unparks the caller. Caller resumes → read `yielded`/`done` → return
  `{value: yielded, done}`.
- **`yield e`** (a new eval case): find the current gen (top of the stack for
  this task); eval `e` → `yielded`; save the gen's ExecCtx, unpark the caller,
  park the gen; on resume restore the gen's ctx and the whole `yield` expression
  evaluates to `sent`.
- **return / body end**: `state = done`, `yielded = <return value>`, unpark the
  caller with `done = true`, pop the current-gen stack.
- **`gen.return(v)` / `gen.throw(e)`**: resume the gen forcing a return / throw at
  the current yield point (a pending-signal field the `yield` resume checks).
- **`yield* iterable`**: desugar to a loop that drives the inner iterator's
  `next`, yielding each value (can be done in the prelude once `yield` works).

## The subtle parts (where R1/R1b-style bugs hide — test each under GC stress)

1. ~~**Current-generator tracking must be a STACK, per task**~~ — this one was
   wrong. A generator can call `next()` on another generator, but each body runs
   on its own green task, so task identity resolves `yield` to the right generator
   with no stack at all.
2. **ExecCtx save/restore must be symmetric** — a bare park without saving the
   ctx bypasses R6 and corrupts an unrelated activation (this is exactly what
   sank the R1a bare-yield attempt). yield goes through save/restore like
   parkOnPromise, not a raw schedulerYield.
3. **GC roots** — the parked gen's ctx + yielded/sent are the only refs to those
   objects while suspended; `collect` must walk them. Run every slice under
   `MILOJS_GC_THRESHOLD=1`.
4. **A generator abandoned mid-iteration** leaves a parked task forever; that is
   acceptable (matches a dropped generator in JS), but confirm it does not wedge
   the event loop the way the reverted R1b whole-program-on-green-task did.

## Slices (all three shipped; kept for the ordering argument)

1. Parser + AST: `yield e` / `yield* e` expression, `FuncDef.isGenerator`. (No
   score gain alone — the call still throws — so fold into slice 2.)
2. `makeGenerator` + `gen.next` + the `yield` eval case + the `{value, done}`
   result. Minimal: `function* g(){ yield 1; yield 2 } [...g()]` → `[1,2]`.
3. `gen.return`/`gen.throw`, `yield*`, and `for...of` over a generator.

Fixtures from node: a counter generator, bidirectional `next(v)`, early return,
throw-into, `yield*` delegation, spread/`for-of` consumption.
