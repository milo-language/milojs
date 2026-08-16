<!-- doc-meta
system: backlog
purpose: what to work on next, with measured conformance attribution per change
key-files: src/eval.milo, src/builtins.milo, src/parser.milo, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: an item lands, a gap is discovered, or a sweep re-attributes a score
last-verified: 2026-08-16
-->

# milojs backlog

Work items carried over from the milo repo's backlog when milojs moved to its own
repo, re-verified against the engine through 2026-07-30.

## Native evaluator frame on the normal stack — DONE

The full expression dispatcher reserved about 250 KB per native frame on
x86-64, so ordinary recursion crashed around depth 14 on an 8 MB Linux stack.
The evaluator now routes literals, identifiers, binary expressions, and calls
through a small front dispatcher. `evalExpr` is 824 bytes and its binary helper
about 5.7 KB; the full dispatcher is reached only for less common expression
shapes. The unchanged recursion fixtures pass on the normal stack, and the whole
Gate 0 suite is green without `ulimit` changes. A differential fixture now also
requires 100 successful recursive calls before checking that runaway recursion
still becomes a catchable `RangeError`; the engine guard is 104 frames.

## Measured conformance

Both sweeps need a local corpus (`TEST262=`, `~/git/quickjs/tests`), so these are
run by hand rather than in CI:

| sweep | score | measured |
|---|---:|---|
| test262, <!--fact:t262-sample-->1500<!--/fact-->-case deterministic sample | <!--fact:t262-pass-->705<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> = **<!--fact:t262-pct-->48.0%<!--/fact-->** | 2026-08-15 |
| QuickJS `tests/` at `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->` | <!--fact:qjs-pass-->99<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> = **<!--fact:qjs-pct-->66.4%<!--/fact-->** | 2026-08-15 |

Movement on 2026-08-15: the engine now runs the program on a green task, so
generators work there (they threw "generators require the milojs runtime"
before). test262 508→539 (34.6%→36.7%) and QuickJS 95→97 (63.8%→65.1%). Only
31 of the 104 generator-blocked cases converted; the rest need `gen.throw()` /
`gen.return()` and async generators, none of which exist yet.

Denominators move between runs as cases start or stop being scored — compare
the numerator and the fraction from the same table row, not across rows. The
`96/166` and `473/1476` rows this replaced were 2026-07-24/30 measurements.

### The buffer family got real prototypes — 2026-08-15

`Int8Array.prototype`, `ArrayBuffer.prototype` and `DataView.prototype` were all
**undefined**: typed arrays were pure name dispatch, with the methods existing
only as a whitelist checked on the property path. Nothing in this repo noticed,
because milojs's own fixtures only ever call methods on instances.

test262 notices immediately. `testTypedArray.js` opens with
`var TypedArray = Object.getPrototypeOf(Int8Array)` and reads
`TypedArray.prototype` for nearly every assertion, and its resizable-buffer
section starts with `if (ArrayBuffer.prototype.resize)`. Both read a property of
undefined, so **all 1446 cases threw before running a line of their own** — the
`built-ins/TypedArray` 0% in the old table was one missing object, not 1446 bugs.

Now built the way Array.prototype already was: a `%TypedArray%` intrinsic whose
`prototype` carries every shared method as an UNBOUND bound-method (so the call
site's receiver wins and `TypedArray.prototype.map.call(ta, fn)` resolves), each
concrete constructor's `prototype` chaining to it, and the native's property bag
`proto` pointing at `%TypedArray%` — which is what makes
`Object.getPrototypeOf(Int8Array)` return it. Plus `BYTES_PER_ELEMENT`, `name`,
`constructor`, and `@@toStringTag` for the whole family.

| area | before | after |
|---|---:|---:|
| `built-ins/TypedArray` | 0/1446 = 0% | **149/1446 = 10.3%** |
| `built-ins/TypedArrayConstructors` | 29/738 = 3.9% | **134/738 = 18.2%** |
| `built-ins/DataView` | 137/561 = 24.4% | **153/561 = 27.3%** |
| `built-ins/ArrayBuffer` | 43/221 = 19.5% | 43/221 = 19.5% |

Locked by `tests/typedArrayPrototypes.js`.

### Every remaining constructor got a prototype — 2026-08-15

A probe over all 21 built-in constructors found **seven with no prototype object
at all**: Number, Boolean, Symbol, BigInt, Map, Set and Promise. Same gap as the
buffer family, Date and RegExp, so this sweep finishes the pattern — every
constructor now has one, built by a shared `buildNativeProto`, with Map/Set/
Promise instances linked to theirs.

Promise needed its own step: its global binding is a plain OBJECT, not a
`JSValue.Native`, so a prototype hung off the `NATIVE_PROMISE` bag is
unreachable from it. The link is made in `setupRemainingProtos`, which runs
after `setupGlobals` has built that object — attaching it earlier silently did
nothing, because `st.promiseProtoObj` was still -1.

Two more bugs came out of it:

- **A primitive receiver reaching a built-in method value** fell through to the
  generic object tag: `Number.prototype.toString.call(255, 16)` returned
  `"[object Number]"` instead of `"ff"`, and likewise for Boolean and BigInt.
- **Assignment to a native constructor's property ignored writability.** The
  `JSValue.Native` branch of SetMember called `objSet` unconditionally, so
  `Boolean.prototype = x` replaced it even though a built-in `prototype` is
  `{writable: false, enumerable: false, configurable: false}`. Found because
  test262's `verifyNotWritable` assigns and re-reads rather than trusting the
  descriptor — the descriptor was already right.

| area | before | after |
|---|---:|---:|
| `built-ins/Number` | 160/340 = 47.1% | **184/340 = 54.1%** |
| `built-ins/Boolean` | 24/51 = 47.1% | 22/51 = 43.1% |

Whole-suite 1500-sample 655 → 660. Locked by `tests/builtinPrototypes.js`.

**Boolean went DOWN by 2, and that is real.** Four cases that used to fail on
"prototype is undefined" now fail on stricter checks, against one newly passing.
The two still outstanding need `isConstructor` semantics —
`new Boolean.prototype.toString()` must throw a TypeError, and built-in methods
are not constructors here. Related and also unfixed: `Number.prototype` and
`Boolean.prototype` should be a Number/Boolean OBJECT wrapping 0/false, not a
plain object, so `Boolean.prototype.toString()` should return `"false"`.

**Sweep timing note:** `built-ins/Map` and `built-ins/Set` take far longer than
their case counts suggest — the sweep allows 10s per case, so a directory with
many slow or hanging cases stalls for many minutes. Neither was measured this
round. Worth finding the slow case before relying on those numbers.

### RegExp — 2026-08-15

`RegExp.prototype` did not exist. Same shape of gap as the buffer family and
Date, and by now a recognisable pattern: **a constructor with no prototype
object.** Instances carried `source`, `flags`, `global` and `lastIndex` and
nothing else — `.ignoreCase`, `.multiline`, `.sticky`, `.unicode`, `.dotAll`,
`.hasIndices`, `.unicodeSets` all read `undefined`, and `undefined` is not
`false`.

Now built: a real prototype with `exec`/`test`/`toString`/`compile`, the flag
family as accessors (registered under an internal `__reGet_*` name so an
instance's own data property still wins on a normal read — this engine resolves
flags on the instance, the spec puts them on the prototype, and both can hold),
`Symbol.match`/`matchAll`/`replace`/`search`/`split` — which did not exist as
symbols at all — and instances linked to it.

Three separate pre-existing bugs surfaced while building it:

- **`/ab/gi.toString()` returned `undefined`.** `toString` was listed in
  `isRegexMethodName` but `regexMethod` had no branch for it.
- **`RegExp.prototype.compile` did not exist.**
- **`String.prototype.match.call(s, /re/)` returned `undefined`** while
  `s.match(/re/)` worked, and `String.prototype.split.call(s, /,/)` returned the
  string unsplit. The regex-taking String operations lived only on `evalExpr`'s
  method-call path; `callBuiltinByName` goes straight to `stringMethod`, which
  knows nothing about regexes. Both paths now share `stringRegexOp`. This is the
  same class of bug as the uncurry-this one — a second dispatch path that never
  learned what the first one knows.

| area | before | after |
|---|---:|---:|
| `built-ins/RegExp` | 605/1879 = 32.2% | **724/1879 = 38.5%** |

+119 cases. Whole-suite 1500-sample 653 → 655. Locked by
`tests/regexpSurface.js`.

The `@@match`/`@@replace`/`@@split` implementations delegate to the String
methods, which is the reverse of the spec's direction (String delegates to the
symbol). That is fine while nothing overrides them, and wrong for a user subclass
that redefines `@@match` — worth inverting if subclassed regexes ever matter.

### Date — 2026-08-15

`Date.prototype` carried 20 of node's 47 methods. Most of the gap was not
missing behaviour: the whole `set*` / `setUTC*` family was already implemented
inside `dateMethod` and simply never listed on the prototype. Added the rest of
the list, plus `toTimeString`, `toGMTString`, `getYear`, `setYear`,
`toUTCString` in its real RFC 7231 form, and `toLocale*` in node's default
en-US shape (all of these previously returned the ISO string).

**Date also disagreed with itself.** The local getters decomposed in the HOST
timezone (`DateTime.fromEpochLocal`), while the setters decomposed in UTC and
`getTimezoneOffset` reported 0. So `d.setHours(d.getHours())` shifted the date
by the host offset, and `getHours()` returned 3 where `getUTCHours()` returned
10. Everything is UTC now, which makes milojs behave as node run under
`TZ=UTC`. That is a deliberate simplification, not a fix in disguise: std
exposes `localtime_r` but no `mktime`, so a correct LOCAL setter family is not
expressible today — and a half-local Date is worse than a consistent UTC one.
Anyone adding a timezone database must do the getters and setters together.

Also: built-in CONSTRUCTORS had no own `name`/`length` (`Date.length` was
undefined) — they are bound with `scopeDefine` rather than hung off a namespace
object, so the `nameNativesOf` pass never reached them. There is now a
`builtinCtorArity` table, generated from node like the other two. `Date.parse`
is the one static whose name collides across namespaces (`JSON.parse` is 2), so
it is set explicitly after the namespace pass.

| area | before | after |
|---|---:|---:|
| `built-ins/Date` | 137/594 = 23.1% | **209/594 = 35.2%** |

Whole-suite 1500-sample 649 → 653. Locked by `tests/dateSurface.js`, which
asserts only the TZ-independent surface — the local-time forms cannot be pinned,
since node's output for them depends on where the capture ran.

`toLocale*` is en-US only and ignores any argument; real `Intl` support is not
modelled.

### The uncurry-this idiom, and `name`/`length` on built-ins — 2026-08-15

**The single highest-leverage bug found so far.**
`Function.prototype.call.bind(f)` — the uncurry-this idiom, which turns a method
into a standalone function taking the receiver as its first argument — returned
`undefined` whenever `f` was a BUILT-IN. A plain JS function worked, which is
why it went unnoticed. The uncurried call arrives at `callBuiltinByName` as
receiver = the built-in, name = `"call"`, and nothing handled that case.

test262's `propertyHelper.js` opens with
`var __hasOwnProperty = Function.prototype.call.bind(Object.prototype.hasOwnProperty)`
and four more like it, so **every `verifyProperty` test in the suite failed
before it looked at any property** — which is why the "name/length should be an
own property" buckets refused to move in the previous attempt no matter how
correct the descriptors were made.

Alongside it, built-ins now carry own `name` AND `length` with the spec's
`{writable: false, enumerable: false, configurable: true}`. The arity tables
(`builtinArity`, `builtinStaticArity` in `src/eval.milo`) are **generated from
node** — it is the oracle for this too. Two tables, because the same name can
differ: `Object.keys` is 1 while `Array.prototype.keys` is 0. Across every
prototype only three names disagree internally — `constructor` (excluded),
`toString` (Number's is 1, everything else 0) and `set` (Map's is 2,
%TypedArray%'s is 1); the commoner value wins for those two. To regenerate,
walk the prototypes and constructors in node reading
`Object.getOwnPropertyDescriptor(p, k).value.length`.

Date instances also now link `Date.prototype` (`Object.getPrototypeOf(new Date())`
was not `Date.prototype`).

| area | before | after |
|---|---:|---:|
| `built-ins/Object` | 1350/3411 = 39.6% | **1649/3411 = 48.3%** |
| `built-ins/Array` | 1672/3082 = 54.3% | **1783/3082 = 57.9%** |
| `built-ins/TypedArray` | 248/1446 = 17.2% | **339/1446 = 23.4%** |
| `built-ins/String` | 468/1223 = 38.3% | **560/1223 = 45.8%** |
| `built-ins/Date` | 87/594 = 14.6% | **137/594 = 23.1%** |

**+644 cases** across those five. Whole-suite 1500-sample 615 → 649
(41.8% → 44.1%). Locked by `tests/builtinFunctionShape.js`.

`Date.prototype` still has 20 of node's 47 methods — the whole `setX`,
`getUTCX` and `setUTCX` families are missing, which is most of what is left in
`built-ins/Date`.

### The rest of %TypedArray%.prototype, and detached views — 2026-08-15

Added the methods that were simply missing: `copyWithin`, `lastIndexOf`,
`keys`/`values`/`entries`, `toReversed`, `toSorted`, `toLocaleString`, and
`[Symbol.iterator]`.

More interesting: **detachment was tracked on the ArrayBuffer but no view ever
consulted it.** After `buffer.transfer()` a view still reported its old
`length`, still `fill`ed, and still read its stale bytes. Views now behave as
the spec says — zero for `length`/`byteLength`/`byteOffset`, `undefined` at
every index, a dropped write, and a TypeError from every prototype method.

**And a harness bug that was inflating the failure count.**
`scripts/test262-sweep.ts` never provided `$262`, the host object test262
expects a *runner* to supply. Every detached-buffer case died on
`$262 is not defined` before asking the engine anything, and was counted as an
engine failure. The sweep now injects it, with `detachArrayBuffer` going through
`ArrayBuffer.prototype.transfer`.

Attribution, measured by running the new sweep against the PREVIOUS engine:

| area | before | harness only | + engine work |
|---|---:|---:|---:|
| `built-ins/TypedArray` | 191/1446 = 13.2% | 200 = 13.8% | **248/1446 = 17.2%** |
| `built-ins/DataView` | 186/561 = 33.2% | 225 = 40.1% | 225/561 = 40.1% |
| `built-ins/ArrayBuffer` | 58/221 = 26.2% | — | 63/221 = 28.5% |

So DataView's **entire** +39 is the harness fix — the engine contributed
nothing there, and that number was previously understated rather than wrong.
TypedArray is +9 harness and **+48 engine**. Whole-suite 1500-sample 608 → 615.
Locked by `tests/typedArrayMethods2.js`.

**Still the top TypedArray blocker: `BigInt64Array`/`BigUint64Array`, 544
cases.** Now scoped properly: `taLoad`/`taStore`/`taElem`/`taSetElem` are all
`f64`-typed, and f64 cannot hold a 64-bit integer exactly, so this is not a new
`TA_*` kind plus a width — it needs a parallel `JSValue`-returning element path
threaded through all ~30 prototype methods. Also note `NATIVE_TA_BASE` is 79
with ids 79..87 used and 88 taken by `NATIVE_HTTP_FETCH`, so the base has to
move to a free range before two more kinds can be added.

### Static accessors, and static inheritance — 2026-08-15

`static get` / `static set` did not work **at all**. A class's statics live in a
per-function object, and every path that touched it used the non-invoking
`getMember`/`objSet`/`setMember` — so a getter was returned as a data property
(i.e. never called, reading `undefined`) and a setter was silently overwritten
by the assigned value. Instance accessors were fine, which is why this survived:
nothing in this repo uses a static one.

Fixed on all four paths — read, method-call, write, and the compound-assignment
lvalue reads — by moving to `getMemberDyn` / `setMemberDyn`. Three related bugs
came out of the fixture while writing it:

- **Statics were not inherited.** `class D extends B {}` linked only the
  instance prototype; `D.staticOfB` was undefined. The statics object now
  chains to the base's.
- **An own static named `call`/`apply`/`bind` lost to `Function.prototype`.**
  `class C { static call() {} }` then `C.call()` ran `Function.prototype.call`
  and returned undefined. An own static now wins; a class without one still
  gets `Function.prototype`'s.
- **`C.#priv++` on a static private field did not increment**, for the same
  accessor-blind lvalue read.

| area | before | after |
|---|---:|---:|
| `language/statements/class` | 1680/4361 = 38.5% | **1926/4361 = 44.2%** |
| `language/expressions/class` | 1560/4052 = 38.5% | **1806/4052 = 44.6%** |

+492 cases. Whole-suite 1500-sample 588 → 608 (40.0% → 41.4%). Locked by
`tests/staticAccessors.js`.

### Built-in function `name` — 2026-08-15, correct but did NOT move the number

Every bound-method built-in now carries an own `name` with the spec's
`{writable: false, enumerable: false, configurable: true}`, matching node's
descriptor exactly, and each native reachable as a method of a namespace
(`Math`, `JSON`, `Object`, `Array`, `String`, `Date`, `Promise`) gets its name
from the key it is registered under — a per-namespace pass, since a native's
properties live in a shared per-id bag with nowhere to put a name at the ~145
individual registration sites. 39 prelude function expressions written as
`X.y = function (…)` were also given names.

The test262 `name should be an own property` bucket did **not** move (19 before
and after). The sampled cases target function values that have no own-property
bag at all — `Object.getOwnPropertyNames(Math.cosh)` returns `[]` here versus
`["length","name"]` in node — so `name` reads correctly but is not an own
property. Making JS functions and natives carry real property bags is the
prerequisite, and it also gates the `length.js` half, which additionally needs a
per-method arity table. Kept because it is a genuine fidelity improvement and
costs nothing; recorded here so nobody re-measures it expecting a win.

### Receiver brand checks — 2026-08-15

Built-in methods are dispatched by NAME here, which is correct for
`Array.prototype` (genuinely generic in ES) and wrong for the buffer family
(node throws a TypeError when `this` is the wrong kind). So
`Int8Array.prototype.join.call([1, 2], '-')` returned `"1-2"` instead of
throwing, and `ArrayBuffer.prototype.slice.call({})` returned an object.

A bound method built for `%TypedArray%` / `ArrayBuffer` / `DataView` now records
a `boundBrand` and checks the receiver before dispatching — at both call sites
(plain invocation and `.call`/`.apply`), and the brand survives `bind()`. Also
added `ArrayBuffer.isView`.

| area | before | after |
|---|---:|---:|
| `built-ins/DataView` | 153/561 = 27.3% | **186/561 = 33.2%** |
| `built-ins/ArrayBuffer` | 43/221 = 19.5% | **58/221 = 26.2%** |
| `built-ins/TypedArray` | 149/1446 = 10.3% | **191/1446 = 13.2%** |

Locked by `tests/bufferBrandChecks.js`. Still missing on ArrayBuffer:
`Symbol.species`, and `name`/`length` on native constructors generally
(`ArrayBuffer.name` is undefined) — the latter is the "should be an own
property" bucket, ~42 cases suite-wide across all builtins.

**Next in this cluster, in order of size:**
1. **`BigInt64Array` / `BigUint64Array` do not exist** — now the top bucket in
   `built-ins/TypedArray` at **538 cases**. Needs two new `TA_*` kinds at width
   8 and, more invasively, element access that yields a `JSValue.BigInt` rather
   than an f64: `taElem` returns f64 today and every typed-array method is
   written against that.
2. `ArrayBuffer` did not move at all (19.5%) — its own prototype exists now, but
   `maxByteLength`/`resizable`/`detached` accessors and the options-bag
   constructor are still missing.
3. Property descriptors: `length`/`name` "should be an own property" is ~42
   cases suite-wide, across all builtins, not just this cluster.

Weakest areas (before this change): `built-ins/TypedArray` 0%, `ArrayBuffer` 0%, `Atomics` 0%,
`language/eval-code` 0%, `Temporal` 1%, `TypedArrayConstructors` 5%, `Map` 14%.
Strongest: `language/block-scope` 100%, `literals` 77%, `identifiers` 75%.

### Open, in rough value order

- **`gen.throw()` / `gen.return()`** — DONE 2026-08-15. `genResume(o, args,
  mode, st)` drives the parked body for all three completions; `genYield` reads
  the mode at its resume point. `return(v)` unwinds on the throw machinery with
  a separate per-task `genReturning` flag (in `ExecCtx`, so it is saved and
  restored across a park like `throwing`): `execTryBody` will not let a `catch`
  intercept it, `execTry` carries it across `finally`, and `genFinish` turns it
  back into a normal completion. Also implemented alongside it:
  - **IteratorClose** — for-of abandoned by break/return/a throw out of the body
    now calls the iterator's `return()`, which is what runs a generator's
    `finally`. An error from `return()` is discarded if the loop was already
    unwinding, as in node.
  - **`yield*` forwards completions inward** — throw()/return() reaching a
    delegating generator go to the INNER iterator first, so its catch/finally
    runs and whatever it does continues outward. Both the generator and the
    hand-rolled-iterator delegation paths. This also gave `yield*` two-way
    `next(v)` threading, which it never had.

  Measured on test262 (whole-suite 1500-sample moved only 539→540 — it is thin
  here, so these are the directories that matter):
  `built-ins/GeneratorPrototype` **26.2% → 75.4%**,
  `language/expressions/yield` **41.3% → 57.1%**,
  `language/statements/for-of` **50.5% → 51.4%**. QuickJS 97→98/149.
  `language/statements/generators` did not move (48.9%), and is where the
  remaining generator work is. Locked by `tests/generatorCompletions.js`.

- **No duplicate-declaration check.** `const x = 1; const x = 2;` in one scope is
  accepted; node raises `SyntaxError: Identifier 'x' has already been declared`.
  Found while assembling `tests/generatorCompletions.js`, whose groups had to be
  braced to avoid relying on this.
- **Async generators** — DONE 2026-08-15 (with one open limitation, below).
  `async function*` is now a generator first: `callFunction` builds the
  generator object BEFORE the activation-spawn branch, which used to swallow it
  and hand back a promise. The body still awaits, because it runs on its own
  green task and that is all `parkOnPromise` needs. `next`/`throw`/`return` wrap
  each step in a promise (`genResumeAsync`), and the async return-wrapping in
  `callFunction` is skipped for a generator body — it was turning `return v`
  into `{value: Promise, done: true}` and hiding a throw from `genFinish`.
  `for await (… of …)` parses (a bool on `Stmt.ForOf`) and prefers
  `Symbol.asyncIterator`; over a plain sync iterable it awaits each VALUE
  instead, per CreateAsyncFromSyncIterator. The ~200-line `await`
  implementation was factored out of the Unary branch into `awaitValue` so
  for-await reuses it rather than growing a second copy.

  test262, before → after:
  `language/statements/for-await-of` **47.9% → 91.0%** (+532 cases),
  `language/expressions/async-generator` **14.1% → 43.3%** (+182),
  `language/statements/async-generator` **11.3% → 40.5%** (+88),
  `built-ins/AsyncGeneratorPrototype` **0% → 41.7%** (+20).
  Whole-suite 1500-sample 540 → 577 (36.7% → 39.3%).
  Locked by `tests/asyncGenerators.js`.

- **OPEN, and the one thing that can HANG: `next()` on an async generator drives
  the body instead of scheduling it.** node returns a *pending* promise
  immediately and runs the body afterwards; `genResumeAsync` parks the caller,
  drives the body to its next yield, and returns an already-settled promise.
  Values are always identical, but interleaving differs whenever two async
  functions are in flight — and it deadlocks in one shape: a caller that invokes
  `next()` WITHOUT awaiting it, where the body then awaits a promise that only
  settles after `next()` returns. Nothing is runnable and the process hangs.
  QuickJS `bug1355.js` is exactly this (it was a parse error before async
  generators existed, so nothing that previously worked regressed).

  The fix is to stop driving the body from the caller: `next()` should register
  a pending promise, unpark the body task, and return without parking, letting
  the body settle that promise when it reaches its yield. That needs a per-
  generator queue of pending requests, since node queues concurrent `next()`
  calls, and `runEventLoop` must count a live async generator body as work.

  **This was attempted on 2026-08-15 and reverted — read this before trying
  again.** The queue itself worked: a FIFO of (generator, promise, mode, arg)
  in `Interp` (marked by `collect`, since nothing else roots the promise or the
  send value), `asyncGenRequest` enqueueing and returning a pending promise
  without parking, `asyncGenYield` settling the served request and either
  picking up the next queued one or parking, and `asyncGenFinish` draining the
  rest. `bug1355.js` stopped hanging and the simple cases passed. Two further
  fixes were needed and made: for-await's IteratorClose and `yield*` delegation
  both drove the inner generator with the SYNCHRONOUS `genResume`, which parks
  the caller against a queue only that caller can feed — both must go through
  the async request and await the promise.

  What killed it was the event loop. Yielding to a runnable generator body
  before `runOneTimer` starves the timer that would settle the await the body
  is parked on. Moving the yield after timers fixed that specific livelock but
  left a NONDETERMINISTIC hang in ordinary sequential code — the same script
  produced 2, 16, or all 18 lines across runs — which is strictly worse than
  the one pathological shape it set out to fix. The remaining race was not
  identified. Whoever picks this up should start by making the body's
  runnability explicit rather than inferring it from "a request is queued":
  the event loop cannot currently distinguish "body is runnable" from "body is
  parked on a promise nothing has settled yet", and spins on the difference.

- **`built-ins/AsyncGeneratorFunction` is unmoved at 13%** — the
  `AsyncGeneratorFunction` constructor and the prototype/`@@toStringTag` chain
  are not modelled at all, separately from the objects working.
- **`await` of an already-settled promise resumes inline** instead of after a
  microtask tick, so an async function whose awaits all settle synchronously
  runs to completion before returning. `tests/promises.js` pins the one line
  this moves ("then 42"); everything else in that fixture matches node.
- **console.log/util.inspect** — DONE 2026-08-15. Was bun-shaped; now
  reproduces node's `util.inspect` defaults (depth 2, breakLength 80, compact 3):
  node's quote selection and escapes for nested strings, its `^[a-zA-Z_]\w*$`
  bare-key rule (`$` is NOT in it, so `{ '$x': 1 }`), inline-when-it-fits
  layout with no trailing comma, `groupArrayElements` column layout for arrays
  over six entries, `<N empty items>` for holes, `-0`, `[Function: name]`,
  `Map(n) {…}` / `Set(n) {…}`, and a RegExp as its literal. `lib/util.js` no
  longer keeps a second copy — it delegates through the new `__inspect` native.
  Engine `.expected` files that are byte-exact node captures went **140/157 to
  153/158**. Locked by `tests/consoleInspect.js` and
  `tests/runtime/utilInspectMatchesConsole.js`.

  Still divergent in inspect, both needing new state rather than new formatting:
  a class prints `[Function: Foo]` where node prints `[class Foo]` (there is no
  isClass flag on FuncDef), and `Object.create(null)` is missing node's
  `[Object: null prototype]` prefix.

- **The five fixtures whose `.expected` is not a node capture**, and why:
  `binaryLength` (uses `__byteLength`, an engine-only global node lacks),
  `errorInspect` (node prints absolute-path stack frames), `modules` (node
  prints a PID-stamped circular-dependency warning), `promises` (the settled-
  `await` tick above), and `radixToString` — that last one is a **real bug**:
  `Number.prototype.toString(radix)` diverges in the final digits
  (`1.204620462046204621` in node vs `1.2046204620462046205` here).

Stage 6 of the roadmap calls for a checked-in `test262-status.md` so the trend is
visible. It does not exist yet — this table is the stopgap.

## The dispatch model — Array, String, and Error done

Built-in methods were **not** real properties on real prototype objects. They
were dispatched by a name whitelist checked at gated sites on the property path.
Three slices of this are now fixed; the pattern for the rest is established.

**Done — arrays.** `newArray` links `st.arrayProtoObj`, which carries every method
as a real non-enumerable property. Three of the four `isArrayMethod` gates are
gone. `Array.prototype.foo = …` works (it was unreachable dead code before), an
override wins on calls and not just reads, `[].map === Array.prototype.map`, and
`Object.create(Array.prototype)` inherits.

The fourth gate survives deliberately, as a **guarded fast path**: while
`arrayProtoPristine` holds, a call dispatches straight to the native; any write to
`Array.prototype` clears it permanently and every later call takes the real chain.
Without the guard a tight `arr.indexOf()` loop ran ~30% slower. This is the shape
to copy for the remaining types — correctness by default, speed while untouched.

**Done — the Error family** (see below).

**Done — strings.** Primitive property reads now resolve through the real,
non-enumerable `String.prototype` properties. While that prototype is pristine,
calls retain direct native dispatch; any write, accessor definition, or deletion
permanently moves calls to ordinary lookup. Extensions and warmed-up overrides
therefore work, and `"x".slice === String.prototype.slice` matches Node.

**Still whitelisted:** Map/Set (`isMapSetMethodName`), RegExp, Date, DataView,
and typed arrays. Each has the same symptom: prototype assignment is dead code
and overrides are ignored on calls. Map/Set is the next slice.

**Do the rest before Stage 4.** A bytecode VM built on the whitelist inherits it
permanently.

Risk to respect: these sites are hot, and `makeBoundMethod`'s late-binding is
load-bearing — capturing `Promise.resolve` as a value re-entered itself forever
without it. Take one type per slice with the full fixture suite as the guard; the
array slice surfaced three unrelated real bugs (`bind` dropping a receiver on a
first bind of an unbound method value, `Array.prototype.toString` returning the
type tag, and assignment resetting an existing property's attributes), and each
was caught only by a fixture.

## milojs: built-in constructors' `.prototype` — DONE

Each error native carries a real prototype in its `getNativeProps` bag (already a
GC root, so no new root was needed); subtypes chain to `Error.prototype`, and both
construction paths — `callNative` and the internal `makeError` — link instances to
it. So `getPrototypeOf(e) === TypeError.prototype` and `e.constructor` resolve
whether the error was constructed or raised by the runtime.

Two pre-existing bugs surfaced while probing and were fixed with it: `String(err)`
answered `"[object Object]"` instead of `"Name: message"`, and `name`/`message`/
`stack` were enumerable, so `Object.keys(new TypeError("x"))` gave 3 entries where
node gives 0. Locked by `tests/errorPrototype.js`.

Remaining divergence, minor: `name` and `message` are own properties on each
instance as well as on the prototype. Node keeps `name` prototype-only. Observable
only via `hasOwnProperty`.

## milojs: Array change-by-copy methods (ES2023) — DONE

`with`, `toReversed`, `toSorted`, `toSpliced` are implemented natively, via
exactly the route the old note proposed (extend the whitelist, implement
alongside `findLast`), and locked by `tests/arrayChangeByCopy.js`.

Two other claims in the old note also expired: `Math.fround` exists, and so does
`Float32Array`.

## milojs: Array methods on array-like receivers — DONE

Array methods used to run only on real arrays, and a non-array receiver produced
a **silent wrong answer** rather than an error:

```js
var o = {length: 3, 0: 'a', 1: 'b', 2: 'c'};
Array.prototype.join.call(o, '-')      // was: undefined   (node: "a-b-c")
Array.prototype.indexOf.call(o, 'b')   // was: undefined   (node: 1)
Array.prototype.forEach.call(o, cb)    // was: no calls    (node: 3 calls)
Array.prototype.map.call("abc", f)     // was: TypeError
```

Fixed by adapting a non-array receiver into a scratch array, running the existing
native on that, and writing the result back for the mutating methods.
`arrayLikeOrig` on the scratch array preserves the one observable difference —
the spec hands callbacks the *original* object as their 3rd argument. Locked by
`tests/arrayGenericReceiver.js`, byte-identical to node.

Moved `built-ins/Array` from 28.3% to 45.0%, and the whole-suite number from
30.6% to 31.8%.

The optional `thisArg` after the callback (`map`/`filter`/`forEach`/`some`/
`every`/`find`/`findIndex`/`findLast`/`findLastIndex`/`flatMap`) was also ignored
outright and is now honored — `reduce`/`reduceRight` stay excluded, since their
second argument is the initial accumulator. Locked by
`tests/arrayCallbackThisArg.js`.

Still generic-unaware: typed-array receivers (`concat is not a function` on a
typed array, 3 QuickJS cases) reach `callMember` on a path that never gets to
`callBuiltinByName`.

## Probe before implementing

Several sweep failures reported as `X is not a function` are methods called on
unusual receivers, not missing methods. `concat`, `sort`, `apply`, `toString`,
and `escape` all work on ordinary receivers. Check whether a method is
prototype-dispatched or whitelisted before assuming the prelude is the place to
put it.

## ESM over the CommonJS loader — working, with two known divergences

Every import form now loads: default, named, namespace, side-effect, renamed,
`export ... from`, `export *`, and dynamic `import()` of a literal specifier.
Module discovery recognises the ESM syntax directly (`scanRequires` in
`src/modules.milo`), because it runs on tokens before the parser has desugared
anything to `require`. `tests/esmImports.js` and `tests/runtime/esmModules.js`
lock the behavior against node.

Remaining divergences:

- Bindings are snapshots, not ESM live bindings. A mutated export does not
  update an importer that already read it.
- `import()` with a computed specifier fails the same way a computed `require`
  does: the preload scan cannot see it, so the module is never registered.

## Found by differential sweep 2026-07-30, not yet fixed

Ranked by how likely a first-time user is to hit them. All four are reproducible
against node with a two-line script.

1. **A user-defined `Symbol.iterator` is never consulted — DONE.** Three separate
   defects, all fixed and locked by `tests/runtime/objectSymbolIterator.js` and
   `tests/runtime/classSymbolIterator.js`:
   - The drive loops in `spreadInto` and `Stmt.ForOf` read `next` as a stored
     property. `*[Symbol.iterator]() {}` hands back a GENERATOR, whose `next` is
     native, so spread came out empty and for-of reported `iterator has no next
     method`. Both now recognise a generator iterator and drive it via `genNext`.
   - Array destructuring and the `Map`/`Set` constructors index-read their source,
     which answers undefined for something that is iterable and nothing else.
     `const [a, b] = pattern` now binds the temp to `[...expr]` (spread IS the
     protocol), and the constructors materialize through `iterableToArray`.
   - A class body dropped both the `*` that makes a method a generator (consumed
     and ignored) and a computed `[expr]` key (never parsed), so every iterable
     class was un-iterable. `ClassMember` now carries `keyExpr`, evaluated in the
     class scope like an object literal's computed key.

   Still open next door: async generators (`async *m() {}`) produce an object with
   no `next` in both object literals and classes, and `for await (... of ...)` does
   not parse.
2. **`TypedArray.prototype.subarray` returns an empty view — DONE 2026-08-15.**
   Not a subarray bug: `a.subarray(1)` passed `undefined` as the end index and
   every built-in with a defaulted argument treated an explicit `undefined` as
   "0", not as "absent". See "Explicit `undefined` meant absent" below.
3. **`[1, , 3].flat()` keeps the hole** (length 3, node gives 2) — one symptom
   of a representation gap, see "Array holes are not modelled" below.
4. **`"ß".toUpperCase()` answers `"ß"` — DONE 2026-08-15**, and the entry
   understated it: the gap was not one special case but every script. See
   "Case mapping was ASCII and Latin-1 only" below.

## Smaller known gaps


## Explicit `undefined` meant absent — DONE 2026-08-15

Every built-in with a defaulted argument checked presence as `args.len() > i`
alone, so `arr.slice(1, undefined)` took `undefined` through `toNum` to `0` and
returned `[]` where node returns `[2,3,4]`. That is the shape a forwarded
optional parameter produces, so it is common in ordinary code, not a corner.
Nine methods diverged: `Array.prototype.slice`/`fill`/`copyWithin`/`join`/
`flat`, `String.prototype.substr`/`padStart`/`padEnd`, and
`%TypedArray%.prototype.subarray`/`slice`/`fill`/`join`.

Fixed centrally: `argPresent(args, i)` in `src/builtins.milo` is the presence
test, and `argNum` uses it — which covers every `String.prototype` site at once.
The array and typed-array branches in `src/eval.milo` call it directly.

Two neighbouring bugs came out of the same probe:

- **`String.prototype.substring` was implemented as `slice`.** It has its own
  clamping — a negative index goes to 0 rather than counting from the end, and
  out-of-order ends are swapped — so `"abcdef".substring(2, 1)` answered `""`
  where node answers `"b"`, and `.substring(-2)` answered `"ef"` where node
  answers the whole string. Four of eight probed argument shapes were wrong.
- **`Array.prototype.lastIndexOf` ignored `fromIndex` entirely.**
  `[1,2,3,2].lastIndexOf(2, 0)` answered 3; it must answer -1.

test262 1500-sample 660 → 662. Directory scores after the fix (no before-number:
the milo compiler at `d6adecc5` cannot build this repo at HEAD, see below, so a
baseline binary could not be produced): `built-ins/String/prototype/substring`
31/46, `built-ins/Array/prototype/lastIndexOf` 144/198,
`built-ins/Array/prototype/fill` 9/22, `built-ins/Array/prototype/copyWithin`
19/39, `built-ins/TypedArray/prototype/subarray` 11/67. Locked by
`tests/undefinedOptionalArgs.js`.

## Case mapping was ASCII and Latin-1 only — DONE 2026-08-15

`upperCp`/`lowerCp` were two `if` chains covering `a-z` and the Latin-1
Supplement, with a comment calling wider scripts "a documented limit". The limit
was that **every non-Latin script passed through unchanged**:

```
"привет".toUpperCase()  // "привет"
"αβγ".toUpperCase()     // "αβγ"
"čšž".toUpperCase()     // "čšž"
```

Now generated rather than hand-written: `tools/gen-unicase.mjs` asks node's own
ICU for the mapping of all 0x110000 code points and emits `src/unicase.milo` —
199 uppercase and 186 lowercase ranges as a balanced if-tree (milo has no static
array initialiser, and a comparison tree is O(log n) with nothing to allocate or
lazily initialise), plus the 102 mappings that GROW the string (ß → SS, ﬁ → FI,
the Greek iota-subscript family), which no code-point delta can express.

Verified exhaustively, not by sampling: a script printing every code point whose
case differs, run through both engines, is byte-identical to node across all
2981 lines. Re-run the generator after a node upgrade.

`toLocaleUpperCase`/`toLocaleLowerCase` were fixed alongside — both had an arity
entry in `builtinArity` and no dispatch anywhere, so both answered `undefined`.
They are the locale-independent mappings here; there is no locale data in this
engine and node only diverges for tr/az/lt.

| area | before | after |
|---|---:|---:|
| `built-ins/String/prototype/toUpperCase` | 13/26 = 50.0% | **15/26 = 57.7%** |
| `built-ins/String/prototype/toLowerCase` | 13/30 = 43.3% | **15/30 = 50.0%** |
| `built-ins/String/prototype/toLocaleUpperCase` | 1/26 = 3.8% | **15/26 = 57.7%** |
| `built-ins/String/prototype/toLocaleLowerCase` | 1/28 = 3.6% | **15/28 = 53.6%** |

Locked by `tests/unicodeCaseMapping.js`.

## Array holes were modelled but never consulted — DONE 2026-08-15

The earlier entry here called this a representation gap and listed `Object.keys`
as one of the divergences. **Both were wrong.** `JSObj` has had a `holes` index
list all along, and `in`, `Object.keys`, `hasOwnProperty` and `delete` all
consult it correctly — `Object.keys([1,,3])` was already `["0","2"]`. The real
gap was that every ITERATION method ignored it. Twelve divergences, one cause:

| expression | was | node |
|---|---|---|
| `[1,,3].flat()` / `.flatMap(x=>[x])` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].filter(() => true)` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].forEach` callback count | 3 | 2 |
| `1 in [1,,3].map(x => x)` | `true` | `false` |
| `[1,,3].some(x => x === undefined)` | `true` | `false` |
| `[1,,3].every(x => x !== undefined)` | `false` | `true` |
| `[1,,3].reduce` callback count | 3 | 2 |
| `[1,,3].indexOf(undefined)` | 1 | -1 |
| `1 in [1,,3].slice()` / `.concat([4])` | `true` | `false` |
| `[3,,1].sort()` hole position | index 1 | index 2 |

Fixed at each site rather than centrally, because the correct treatment differs
per method and the spec is not uniform about it: some/every/forEach/filter/
reduce/reduceRight/indexOf/flat/flatMap SKIP a hole (they are specified over
present indices), map/slice/concat PRESERVE one (a new `arrPushMaybeHole`), and
find/findIndex/includes deliberately do NOT skip — they read through a hole as
undefined, so they were already right and were left alone.

`sort` needed a rewrite rather than a guard. It sorted `elems` in place under a
holes list that names INDICES, so the recorded holes ended up pointing at
whichever elements had moved into those slots; and the spec sinks `undefined`
below every defined value and a hole below that, which does not fall out of
comparing `"undefined"` as a string (`["z", undefined, "a"].sort()` is
`["a", "z", undefined]`, not `["a", "undefined", "z"]`). It now lifts the
present defined values out, sorts those, and lays undefined and then the holes
back down as a tail.

`built-ins/Array` 1814/3082 → **1819/3082**. Locked by `tests/arrayHoles.js`.

## Class static blocks did not parse — DONE 2026-08-15

`static { ... }` (ES2022) was not handled by the class-body parser at all, and a
parse error is fatal: one static block anywhere killed the WHOLE file, not just
the class. Modelled as a static field with an empty name whose initializer is a
function; the class builder calls it with `this` bound to the class and stores
nothing, which gets the interleaving with static fields right for free (they run
in one declaration-ordered pass). `language/statements/class` 2011/4361 →
**2024/4361**. Locked by `tests/classStaticBlocks.js`.

## Native addons: how far a real one gets, and the wall — 2026-08-15

Chasing `chat`, `todo`, `milo-list` and `smith` to a running state. **`chat` now
runs and serves bytes identical to node.** The other three reach the addon and
stop at a boundary that is not milojs's to move.

Shipped on the way:

- **`tls` did not exist — DONE.** `ws` opens with `const tls = require('tls')`,
  so a WebSocket server could not load at all. `lib/tls.js` provides the surface
  read at require time (`TLSSocket`, `Server`, `createSecureContext`,
  `rootCertificates`, the DEFAULT_* constants) and throws a message naming the
  gap for anything that needs to negotiate a session. `checkServerIdentity` is
  implemented rather than stubbed, since it is pure string work over a
  certificate the caller supplies.
- **`Error.prepareStackTrace` and CallSite objects — DONE.** V8's structured
  stack-trace API. `bindings` sets `prepareStackTrace`, calls
  `captureStackTrace`, and walks frames for the first file that is not its own,
  to locate an addon relative to its CALLER. With no frames it read `undefined`
  and threw. `FuncDef` now records the file it was parsed from, `Interp` carries
  an `fnFileStack` pushed and popped around every call (by wrapping
  `callFunction` rather than editing its many early returns), and the prelude
  turns those into CallSite objects. The shim's own frames are dropped off the
  front, as node drops the capture frame.
- **`require` as a VALUE — DONE.** It was handled only at the call site by name,
  so `typeof require` was `"undefined"`. Every addon loader is built on
  `const requireFunc = ... : require`. Each module scope now binds its own
  `require` carrying its own directory, which is node's model.
- **`__filename` and `__dirname` were RELATIVE — DONE.** node guarantees
  absolute, and packages join candidate paths onto them: a relative one sent
  every candidate to the wrong directory. Resolution still keys on the
  registry's relative form (`relativizeToCwd`), so the two stay in step.
- **A missing addon now reports as not-found — DONE.** `bindings` probes a list
  of paths and rethrows anything that does not read as not-found, so
  "dlopen failed" stopped the search at the first candidate.
- **`dlopen` failures now carry `dlerror()`.** Without it the reason for a failed
  link is invisible, and that reason is the whole story.

**The wall, and it is not ours.** With all of the above, `bindings` locates the
right file and milojs dlopens it. It fails with:

```
symbol not found in flat namespace '__ZN2v811HandleScope16DeleteExtensionsEPNS_7IsolateE'
```

That is `v8::HandleScope::DeleteExtensions`. better-sqlite3 11.10.0's prebuilt
links the **V8 C++ API**, not Node-API: `nm -u` on it shows **49 `v8::` symbols
and zero `napi_` symbols**. milojs has no V8, so this binary cannot load here no
matter how complete the Node-API surface becomes. The three apps need either a
better-sqlite3 rebuilt against Node-API or a sqlite package that is napi-native.
Worth knowing before any further Node-API work is justified by "it will make
better-sqlite3 run", because it will not.

Locked by `tests/runtime/stackTracesAndPaths.js`.

## Past get-intrinsic: the `in` operator, and the host surface — 2026-08-15

The four apps blocked inside get-intrinsic are past it. Three separate gaps, each
uncovered by fixing the one before it:

- **`in` answered false for a NATIVE or a FUNCTION right-hand side — DONE.**
  `"prototype" in String` was false while `String.prototype` read fine, because
  both copies of the operator (it existed twice) matched only `JSValue.Obj` and
  fell through to `false`. get-intrinsic walks `%String.prototype.indexOf%` with
  exactly that test, so every package depending on it died on "base intrinsic for
  %String.prototype.indexOf% exists, but the property is not available". Now one
  `evalInOperator` handles objects, natives (through the property bag) and
  functions (through their statics, plus the members every function carries), and
  a primitive right-hand side is a TypeError rather than false, which is what the
  spec says.
- **`fs` was missing what a promisify target needs — DONE.** better-sqlite3 opens
  with `promisify(fs.access)`, and `util.promisify` rejects a non-function, so a
  missing member was not a missing feature, it was a module that would not load.
  Added `access`, `open`, `close`, `realpath`, `chmod`, `chown`, `utimes`,
  `appendFile`, `exists`, `rmdir`, `fstatSync` and `fs.constants`, each with its
  sync and callback form, plus four more `fs.promises` members.
- **`process.versions`, `process.release` and `process.config` did not exist —
  DONE.** A native addon reads `versions.modules` (the Node-API ABI number) to
  pick its prebuilt binary and dereferences it unconditionally, so the absence
  was a TypeError before the module finished loading.

Locked by `tests/runtime/inOperatorAndHostSurface.js`. tahoeroads still serves
bytes identical to node with zero parse errors.

**Where the four apps stand now, and it is a different kind of wall.** All four
get much further and stop on something structural rather than a shim:

- `chat` needs the `tls` builtin module, which is not implemented.
- `todo`, `milo-list` and `smith` all load **better-sqlite3, a native addon**.
  It fails before the addon is even reached: `bindings` discovers its caller's
  filename through **`Error.prepareStackTrace` plus `Error.captureStackTrace`**,
  V8's structured stack-trace API, where a callback receives CallSite objects and
  reads `.getFileName()`. milojs never calls `prepareStackTrace`, so the filename
  comes back undefined and `fileName.indexOf('file://')` throws. Supporting it
  means synthesising CallSite objects from the interpreter's call stack: a real
  feature, not a shim, and the gate in front of every `bindings`-based addon.

## Four more real applications, and the npm floor — 2026-08-15

Four other node apps in the same tree (`chat`, `todo`, `milo-list`, `smith`) all
died in the same place, and none of it was app code: **`node_modules/get-intrinsic/index.js`,
whose first line is `var undefined;`**. get-intrinsic sits under a large fraction
of npm, so this was closer to a floor than to four bugs. Fixed in order as each
one uncovered the next:

- **Contextual keywords could not be binding names — DONE.** `undefined`, `async`,
  `await`, `yield` and `let` get their own lexer tokens but are NOT reserved
  words. Every name slot (declarator, parameter, function name, catch parameter)
  tested `peekKind(p) == T_IDENT`, so `var undefined;` was a **parse error**, and
  a parse error is fatal. Relaxed through one `isBindingName` predicate, used
  only where a NAME is expected — `await` and `yield` keep their operator meaning
  in expression position, which is the context rule the spec uses anyway.
- **`EvalError` and `URIError` did not exist — DONE.** Both are core ECMAScript.
  `EvalError` was a ReferenceError at first mention, and the comment on
  `errorCtorIdFor` already admitted they were "thrown by name but with no native
  constructor". They do not fit the contiguous `NATIVE_ERROR..NATIVE_REFERENCE_ERROR`
  range (0..4 is full), so the range checks name them explicitly.
  `decodeURIComponent("%")` now throws a real `URIError`.
- **`eval` did not exist as a VALUE — DONE.** It was handled only at the call
  site, so `typeof eval` was `"undefined"` and get-intrinsic's `'%eval%': eval`
  table entry blew up. There is now a global binding whose native throws
  `EvalError` when called indirectly (there is no runtime compiler), while the
  direct `eval("bareIdent")` form still works — the guard moved from `scopeHas`
  to a new `scopeHasBelowGlobal`, so only a USER binding shadows it.

Whole-suite 1500-sample **677 → 680**. Locked by
`tests/contextualKeywordBindings.js`.

**Still blocked, next in line:** all four apps now get through get-intrinsic's
parse and its global table and fail inside it with
`base intrinsic for %String.prototype.indexOf% exists, but the property is not
available`. `String.prototype.indexOf` itself is fine (typeof, `hasOwnProperty`,
`getOwnPropertyDescriptor` and `in` all agree with node), so the fault is in
whatever get-intrinsic uses to walk from `%String.prototype%` to the member.
One measured lead: `Object.getOwnPropertyNames(String.prototype)` returns 28
names where node returns 52.

Two smaller things found by the same probe, not yet fixed:

- Running `scripts/test262-sweep.ts` without `--json` writes
  `docs/conformance/test262.json` containing ABSOLUTE paths
  (`/Users/<you>/git/test262`), which the pre-commit hook then rejects as a
  home-directory leak. Either the report should record `$HOME`-relative paths or
  the default output belongs outside `docs/`.

- **`globalThis` is missing most builtins in the RUNTIME.** `typeof Symbol` is
  `"function"` but `typeof globalThis.Symbol` is `"undefined"`, and likewise for
  `Function`, `RegExp`, `Proxy`, `Reflect`, every typed array, `decodeURI`,
  `escape` and more. The engine's `globalThis` is much more complete than the
  runtime's, so the runtime is putting a different object in front of it.
- Reading a contextual keyword still yields the KEYWORD, not the binding:
  `var undefined = 5; console.log(undefined)` prints `undefined`, not `5`,
  because `undefined` in expression position lexes as the literal. Declaring
  works (which is all get-intrinsic needs, since it declares `var undefined;`
  precisely to obtain the real value); shadowing does not. The fix is to make
  `undefined` an ordinary global binding rather than a literal token.

## eval is real now, and "no runtime compiler" was never true — DONE 2026-08-15

`eval` resolved a bare identifier and hard-errored on everything else, under a
comment in `evalCall` saying milojs has no runtime compiler. That comment was
wrong, and I wrote it. `src/repl.milo` has always called `lex()` and
`parseProgram()` on new source at runtime and executed the result: eval is that
same operation with the CALLER's scope instead of the REPL's global one.

`runEvalSource(src, st, scope)` parses into the shared `gProg` and runs the
statements, answering the completion value. Three details that are not wiring:

- **`var` and function declarations belong to the caller's scope, `let`, `const`
  and `class` do not.** Hoisting into the caller and executing in a fresh child
  scope gives both: `eval("var vv = 2")` is visible afterwards, `eval("class Ce {}")`
  leaves nothing behind.
- **Indirect eval runs in the GLOBAL scope.** `const e = eval; e(src)` goes
  through the `NATIVE_EVAL` native at scope 0, so it cannot see the caller's
  locals. That is the whole difference between the two forms.
- **Appending to `gProg` mid-evaluation is safe here** because Milo's `&Prog` is
  a second-class reference, re-read through rather than cached across a call, so
  an outer `evalExpr` walk picks up a reallocated arena. Stressed by the fixture:
  400 eval'd closures escape into an array, each append able to reallocate under
  a live walk, then all are called afterwards.

| suite | before | after |
|---|---:|---:|
| test262 1500-sample | 680/1470 = 46.3% | **699/1470 = 47.6%** |
| QuickJS `tests/` | 97/149 = 65.1% | **98/149 = 65.8%** |

+19 on test262, the largest single move this session outside the constructor
prototype work. QuickJS moved only 1 because its remaining eval cases need more
than eval (`new.target` in a function context, `var_obj` semantics).

Locked by `tests/evalRuntime.js`.

## The parser accepted truncated input instead of failing — DONE 2026-08-15

`parsePrimary` ended in "unexpected token: consume it so parsing always makes
progress", which swallowed ANY token that cannot start an expression and answered
`undefined`. `atStatementEnd` then treats EOF as a legal statement end, so a
truncated expression ran off the end without complaint. Six of ten malformed
sources parsed clean, and nothing downstream could tell.

Three separate holes, all closed:

- **`parsePrimary`'s fallback now marks the parse failed** (still consuming the
  token so recovery reports as much as it can, and not consuming EOF). That
  covers `var =`, `1 +`, `}` and `()=>`.
- **An expression statement had no end check.** `a b c` parsed as `a` and then
  started over, silently dropping `b c`. It now calls `expectStatementEnd`, which
  still honours ASI.
- **A top-level `return` is rejected in eval only.** It is legal in a CommonJS
  module, since node wraps the file in a function, so the parser cannot tell the
  two apart; `runEvalSource` checks the parsed block instead.

Making the parser strict immediately exposed a bug it had been hiding, in
express's own dependency tree: **`break` and `continue` took the next line as
their label.** `proxy-addr` writes

```js
if (!trust(addrs[i], i)) continue
addrs.length = i + 1
```

and the label parser consumed `addrs`, then choked on the `.`, silently mangling
the function body. The comment above it admitted "No ASI tracking here". `return`
had the same gap in the other direction, swallowing the next line as its
expression. All three now stop at a line break.

Verified against five real applications: tahoeroads still serves bytes identical
to node on every route and now logs **zero** parse errors (it was mangling
proxy-addr before), and the other four apps report zero parse errors and fail at
exactly the same get-intrinsic point as before. No valid code was rejected.

QuickJS `tests/` 98/149 → **99/149**. The test262 sample did not move: its
`Expected a SyntaxError` bucket is mostly early errors the parser still does not
diagnose (duplicate declarations, bad assignment targets, strict-mode rules),
which is a separate body of work. Locked by `tests/parserRejectsBadInput.js`.

## What a real application found that the suites did not — 2026-08-15

Pointing milojs at `tahoeroads` (express 4 + Prisma + tRPC, a deployed backend)
turned up two defects in ten minutes that test262 and every fixture here had
missed, and the app now serves bytes identical to node on every route tried.
Both are recorded in `docs/status.md` under Evidence. Keep doing this.

- **`require` inside a closure resolved against the wrong module — DONE.**
  `requireModule` took its base directory from `st.modDirStack`, which is
  DYNAMIC: it is popped when a module body finishes. body-parser exports its
  parsers through `Object.defineProperty(exports, 'json', {get: ... require('./lib/types/json')})`,
  so the require fires long after body-parser's body ended and resolved against
  whoever touched the getter — express — producing
  `node_modules/express/lib/lib/types/json`. **express 4 could not load at all.**
  Now resolved through the lexical `__dirname` binding in the closure's own env
  chain, which names the module the code was WRITTEN in. Locked by the lazypkg
  fixtures under `tests/modfix/`.

- **`\S`, `\D` and `\W` inside a character class became the literal letters —
  DONE.** `reParseClass` recognised only the lowercase shorthands; the uppercase
  ones fell through to `reEscapedChar`. So `[\s\S]` meant "whitespace or the
  letter S": it matched a newline but not a letter, `[\s\S]*` matched the EMPTY
  string, and `[\s\S]+` matched nothing. The app rewrites page metadata with
  `/<title>[\s\S]*?<\/title>/` and silently served the untouched template.
  Fixed by adding the complement ranges over the byte domain — the domain `[^]`
  already matches over. `built-ins/RegExp` 724/1879 → **725/1879**: test262
  barely notices, which is exactly why a real app was needed to find it. Locked
  by `tests/regexClassShorthands.js`.

## Smaller gaps found by probe on 2026-08-15

- **`String.prototype.normalize` is a SILENT no-op.** It returns its input, so
  `"e\u0301".normalize("NFC").length` is 2 where node gives 1, and a caller
  normalizing before an equality check gets `false` for strings that are equal.
  The in-source comment justified it with "strings are byte buffers, so every
  form is already normalized", which is false reasoning: UTF-8 says nothing about
  canonical composition. Comment corrected; the behaviour is unchanged and still
  wrong. Needs composition/decomposition tables, generatable from node the way
  `tools/gen-unicase.mjs` does (canonical decomposition, combining-class
  ordering, composition with the exclusion list).

  The form ARGUMENT is validated now, because that costs nothing and an invalid
  form is a RangeError in the spec: `"a".normalize("NFZ")` throws instead of
  silently pretending. `built-ins/String/prototype/normalize` 3/14 → **4/14**.
  Asserted by `tests/normalizeFormArg.js`, which deliberately encodes only the
  part that matches node, so it will not need rewriting when the gap closes.
- Unicode property escapes do not match: `/\p{L}/u.test("é")` is `false`.

## ToString reached neither Date.prototype nor Object.prototype — DONE 2026-08-15

`String(someDate)` answered `"[object Date]"`. So did `"" + d`, `[d].join("")`
and `` `${d}` `` — every way a date reaches a string except calling
`d.toString()` by hand. Any `console.log("at " + date)` was wrong.

Four separate defects, found by probing ToPrimitive rather than Date:

- **`callBuiltinByName` excluded `toString` and `valueOf` from date dispatch**
  (`isDate && name != "toString" && name != "valueOf"`). Every generic conversion
  reads those off the prototype as bound method values and calls them, so all of
  them fell through to the object tag; `d.valueOf.call(d)` answered the ISO
  string instead of the epoch number.
- **Date's default ToPrimitive hint.** Date is the one built-in whose
  `@@toPrimitive` turns the DEFAULT hint into the STRING one. Without it, fixing
  `valueOf` to answer a number made `"" + d` WORSE — it started printing the
  epoch. `toPrimitiveDefault` now routes a Date to the string ordering.
- **`({}).toString` and `({}).valueOf` read as `undefined`.** A plain object has
  `proto == -1`, and the fallback to `Object.prototype` lives in `protoOfHandle`,
  which the property-chain walk does not use — so the copies stored on
  `Object.prototype` were unreachable from any ordinary object or class instance.
  ToPrimitive with the string hint then skipped straight to `valueOf`, which is
  the wrong order: `String({valueOf: () => 5})` answered `"5"` where node answers
  `"[object Object]"`. Resolved with the same shape of arm
  `hasOwnProperty`/`isPrototypeOf`/`propertyIsEnumerable` already had.
- **`String.prototype.concat` converted with the prog-free `toStr`**, so every
  object argument became `"[object Object]"` — including an array or a Date.
  Split out as `strConcatProg`; `stringMethod` has no Prog to re-enter user code
  with, which is why it could not be fixed in place.

Template literals were fixed alongside, and needed the AST node the old entry
predicted: **`Expr.ToStrHole`**, one per hole. The `"" + x` chain they desugared
to takes the DEFAULT hint, so an object with `Symbol.toPrimitive` saw `"default"`
where the spec passes `"string"`. The node also carries the one case where a
template is stricter than `String()`: `` `${Symbol()}` `` is a TypeError, while
`String(Symbol())` is not.

| area | before | after |
|---|---:|---:|
| `built-ins/Object/prototype/valueOf` | 9/20 = 45.0% | **13/20 = 65.0%** |
| `built-ins/String/prototype/concat` | 17/22 = 77.3% | **18/22 = 81.8%** |
| `built-ins/Object/prototype/toString` | 17/41 = 41.5% | **18/41 = 43.9%** |

The 1500-sample did not move (673 either way) — test262 is thin here, and the
value is that ordinary string building stopped printing `[object Date]`. Locked
by `tests/toPrimitiveHints.js`, whose Date assertions are written as identities
(`String(d) === d.toString()`) so the fixture says nothing about the host
timezone.

Still open, and needing a representation change rather than a fix: **an object
with a null prototype is indistinguishable from one with a default prototype**
(both `proto == -1`), so `String(Object.create(null))` answers
`"[object Object]"` where node throws `TypeError: Cannot convert object to
primitive value`. This is the same missing bit that keeps `util.inspect` from
printing node's `[Object: null prototype]` prefix.

## The runtime shadowed the engine's native typed arrays — DONE 2026-08-15

`lib/prelude.js` redefined `ArrayBuffer`, seven of the typed arrays and
`DataView` as plain JS arrays carrying an `_isTypedArray` marker. Because the
prelude runs in the runtime, `milojs` was strictly worse than `milojs-engine`
on every one of them:

| | shim (runtime) | node / engine |
|---|---|---|
| `u8[0] = 300` | stays `300` | `44` |
| `Object.getPrototypeOf(u8)` | `Array.prototype` | `Uint8Array.prototype` |
| `Object.prototype.toString.call(u8)` | `[object Array]` | `[object Uint8Array]` |
| `DataView.prototype.setUint16` | missing | present |
| `ArrayBuffer.prototype.slice` | missing | present |
| `new TextEncoder().encode("héllo")` | 5 latin-1 bytes | 6 UTF-8 bytes |

It was also inconsistent with itself: the comment noted that `Int16Array` and
`Float32Array` "are provided natively by the engine and are left as-is", so the
runtime shipped a mixed set where the element type decided whether you got a real
typed array. Deleted — the whole block is now a comment saying why it is empty.

`TextEncoder`/`TextDecoder` stay in the prelude, because they are host APIs the
engine does not provide, but they were rewritten to do real UTF-8 (including
surrogate pairs and U+FFFD for a truncated or lone one) over a real `Uint8Array`.

Removing the shim exposed one genuine engine gap, now also fixed:
**`makeTypedArray` ignored every argument that was not an Array, an ArrayBuffer
or another typed array.** Anything else fell through to the length branch, where
`toNum` of an object is NaN, so `new Uint8Array(buf)` came back EMPTY instead of
throwing — silent, and exactly what the runtime's own `typedArrayCoerce` fixture
caught. Both spec paths now exist: the iterable one (using the same drivability
test `iterableToArray` uses, since a Set carries no `Symbol.iterator` PROPERTY
here) and the array-like one (`length` plus indexed reads).

`built-ins/TypedArrayConstructors` 162/738 → **172/738** from the constructor
fix alone (measured against a baseline binary; the other typed-array directories
moved this session for reasons outside this change, so they are not attributed
here). Locked by `tests/runtime/typedArrayNative.js` and the rewritten
`tests/runtime/typedArrayCoerce.js`.

Still missing on the constructors themselves: `%TypedArray%.of` and
`%TypedArray%.from`. Both need a native id that knows which element type it was
reached through, which `Array.from`'s single `NATIVE_ARRAY_FROM` does not model.

## The milo compiler at `d6adecc5` could not build this repo — RESOLVED

`milo build src/milojs-engine.milo` on a clean HEAD failed in LLVM with
`error: use of undefined value '@.str.5025'` on a `getenv` call, deterministically
but layout-sensitively: adding unrelated code to `src/eval.milo` moved the index
and the build succeeded, which is why the suite was green mid-session and red an
hour later against unchanged milojs source. Gone as of milo `b5a40d2b`. Recorded
because the failure mode is worth recognising: `milo` is a symlink to
`~/git/milo/milo`, so a red build here can be a compiler that moved underneath.

## The regex engine matched bytes, not code points — DONE 2026-08-15

Found while checking whether `\p{L}` was worth implementing. It is not the first
thing to fix, because the engine was not code-point aware at all:

| expression | was | node |
|---|---|---|
| `"aéb".match(/./gu).length` | 4 | 3 |
| `/^a.b$/.test("aéb")` | false | true |
| `/^é+$/u.test("ééé")` | false | true |
| `/^.$/u.test("😀")` | false | true |

Two causes, both in how an atom is built rather than in the matcher's search:

- **`.` advanced by one BYTE.** `RE_ANY` now steps a whole UTF-8 sequence, so a
  2-byte é is one dot instead of two plus a stray continuation byte.
- **A multibyte literal was one `Char` node per byte**, so a following quantifier
  bound to the LAST BYTE: `/é+/` meant "0xC3 then one-or-more 0xA9". A multibyte
  literal is now wrapped as a non-capturing group, which is a single atom for the
  quantifier to attach to.

`built-ins/RegExp` 727/1879 → **734/1879**.

## String.prototype.split ignored zero-width matches and captures — DONE 2026-08-15

Two separate defects in `regexSplit`, both common idioms:

```js
"fooBarBaz".split(/(?=[A-Z])/)  // was ["fooBarBaz"], node ["foo","Bar","Baz"]
"a1b".split(/(\d)/)             // was ["a","b"],     node ["a","1","b"]
```

A zero-width match just advanced the cursor and never split, and capture groups
in the separator were dropped instead of becoming elements. Rewritten to the
spec's shape (`p` the pending piece, `q` the cursor, an empty match advancing `q`
only when it lands at `p`), with one adjustment the spec does not need: it
matches AT `q` while `regexExec` SEARCHES from `q`, so a match starting at the
end of the string has to be rejected explicitly or a trailing zero-width
separator adds a spurious `""`.

`built-ins/String/prototype/split` 64/120 → **68/120**. Locked together by
`tests/regexCodePointsAndSplit.js`.

### Every zero-width advance, and string indices — DONE 2026-08-15

Prompted by the milo maintainer finding the same shape in `std/regex`'s
`findAll`. Their symptom was the mirror of mine: a byte-advance after a
zero-width match made their loop retry mid-character, where a now-correct matcher
REJECTED the position and the list came back truncated. Mine invented extra
matches instead, and `replace` spliced its output around half a character:

    "aéb".replace(/x*/gu, "-")   ->  "-a-\xef\xbf\xbd-\xef\xbf\xbd-b-"   (invalid UTF-8)
    "aéb".match(/x*/gu)          ->  5 empty strings, node gives 4

Four loops had it (global replace, replace-with-callback, matchAll, global
match); `split` had already been fixed and was the template. All advance a whole
character now.

Their note is the one worth keeping: **a half-corrected stack can be worse than
an uncorrected one.** Their locale fix turned a wrong-but-complete answer into a
silently truncated one, which is why they went looking at the loop rather than
declaring the locale change done.

**String indices were BYTE offsets**, found while checking the above:
`"aéb".match(/b/).index` was 3 where node says 2, so `s.slice(m.index)` cut in
the wrong place. `.index`, the offset a replace callback receives, and
`lastIndex` (which a caller both reads AND writes) are UTF-16 units now, with the
conversion at the boundary and bytes kept internally.

`built-ins/RegExp` 734/1879 → **736/1879**.

### Relative specifiers that climb above their base — DONE 2026-08-16

`normalizePath` popped a segment for `..` and, when there was nothing to pop,
**dropped it silently**. So a path that climbs above its base lost the climb:

    from pkg/sub/deep:  require('../../lib.js')  ->  resolved as 'lib.js'

Not a missing feature, a wrong answer: it resolved against the wrong directory
and reported "cannot read module". Only an ABSOLUTE path may discard a `..`
(nothing is above the root); a relative one has to keep it, and must not later
pop a `..` it just kept.

Also fixed alongside: `require('.')` and `require('./')` normalised to the empty
string, and an empty base resolves against nothing. Both are the directory
itself, which node answers with its package.json `main` or `index.js`.
`require('..')` and `require('../')` already worked once the `..` survived.

How it was found is the point: I went looking for real package test suites to run
after concluding that `\p{...}` was not worth its table size, and
`define-properties`' suite failed on `require('../')` before it could even load
its test harness. The bug was never going to show up in a fixture written by
someone who already knew how this resolver behaves.

Locked by `tests/modfix/updir/`, exercised from `tests/modules.js`.

### `\p{...}` property escapes: measured, and NOT worth it as code — 2026-08-16

Sized before building, which is why it was not built. Generating range tables for
the 46 useful properties (general categories, Alphabetic, White_Space, ID_Start,
ID_Continue, Emoji and friends) from node's own regex engine yields **10,869
ranges**. As a balanced if-tree in the shape of `src/unicase.milo` that is tens of
thousands of lines of generated Milo for a feature no application tested here has
ever used.

If it is built, it should be compact DATA decoded once at startup, not emitted
code, and probably a subset (L, N, Alphabetic, White_Space, ID_Start/Continue)
rather than all 46. The code-point work it was waiting on is done, so this is a
size/benefit decision now rather than a blocked one.

### A NULL out-param killed the process and exited 0 — DONE 2026-08-16

Prompted by the milo maintainer finding that std/crypto passed constant lengths
across an FFI boundary where `requires` contracts are dropped at -O2. Their rule
is the transferable part: **the same construct is a different risk at an FFI
boundary**, because there the check is the last line of defence and nothing else
is watching.

milojs's Node-API surface is that boundary here. 45 entry points wrote to an
addon-supplied `result` pointer with no null check. node DEFINES this case: it
answers `napi_invalid_arg` and writes nothing. milojs called `memcpy` to address
0, and the observed failure is worse than the crash it sounds like:

    node:   status from NULL out-param: 1     (napi_invalid_arg)
    milojs: <no output>                       exit code 0

The process died mid-callback and reported success. A CI run reads that as a
pass. All 45 now return `NAPI_INVALID_ARG`, matching node.

Severity, checked before claiming it rather than after: **prospective, not
live.** No addon in the five applications tested does this, and one that did
would be broken against node too. What makes it worth fixing is the failure
MODE, not its likelihood.

Nine entry points are deliberately NOT guarded, because a NULL out-param is
meaningful for them: `napi_get_value_string_utf8` (NULL buf means "tell me the
length"), `napi_get_cb_info`, `napi_get_typedarray_info` and the handle-scope
family all treat it as "I do not want this output". Guarding those uniformly
would have broken working addons, which is why the sweep was reviewed per
function rather than applied to every `*u8` parameter.

Locked by `tests/napi/nullout.c`, which asserts the returned STATUS rather than
that the process survived: a run that died would print nothing and still exit 0,
so "we got here" is not an assertion.

### util.types lied about features this engine has — DONE 2026-08-16

Found with the milo maintainer's mechanical grep (functions whose whole body is a
constant return, where the NAME promises a check). Four `util.types` predicates
returned a constant `false`:

    isAsyncFunction(async function(){})   false, node true
    isGeneratorFunction(function*(){})    false, node true
    isGeneratorObject(gen())              TypeError: not a function
    isBoxedPrimitive(new Number(1))       false, node true

The first three are features milojs genuinely has, so a caller dispatching on
`util.types` took the wrong branch silently. Fixing them needed the type tags
first, which were also wrong: an async function, a generator function and a
generator object all reported `[object Function]` or `[object Object]`. They now
report `AsyncFunction`, `GeneratorFunction`, `AsyncGeneratorFunction`,
`Generator` and `AsyncGenerator`, matching node, which is what
`Object.prototype.toString` is supposed to say and what the predicates read.

Two remain `false`, both for reasons that are properties of the engine rather
than guesses, and both written as real checks so they become correct on their own
if that changes:

- **`isProxy`**: a Proxy here is indistinguishable from its target through any
  JS-visible channel (its type tag reflects the target, as in node). node answers
  true using an internal slot this engine does not expose.
- **`isBoxedPrimitive`**: there are no wrapper objects to find. `new Number(1)`
  returns the PRIMITIVE 1 (`typeof` is `"number"`, `instanceof Number` is
  false), so `new String`/`new Boolean`/`new Number` are all identity. That is
  the real gap and it is bigger than these predicates: it is also why
  `Number.prototype` is a plain object rather than a Number wrapping 0.

### The UTF-16 model is lossy for lone surrogates — OPEN

Found by turning the milo maintainer's "grep for JUSTIFICATIONS, not limitation
notes" at code I had written hours earlier. milojs strings are UTF-8, which has
no encoding for an unpaired surrogate, and two operations lose data rather than
erroring:

| expression | milojs | node |
|---|---|---|
| `String.fromCharCode(0xD800).charCodeAt(0)` | 65533 (U+FFFD) | 55296 |
| `JSON.parse('"\ud800"').charCodeAt(0)` | 65533 | 55296 |
| `"\u{1F600}".slice(0,1).length` | 2 (whole char) | 1 (the high half) |

The substitution is silent. A program doing surrogate arithmetic, or round-
tripping JSON that contains `\ud800`, gets a different string back and no
indication. Fixing it means a representation that can hold unpaired surrogates
(WTF-8, or UTF-16 units with a UTF-8 fast path), which is a string-layer decision
rather than a patch.

`isWellFormed`/`toWellFormed` were rewritten to SCAN for unpaired surrogates
instead of returning `true` unconditionally. The answers are identical today,
because no operation can produce one; the point is that the old version argued an
invariant about the rest of the engine from a site that cannot enforce it, so it
would have become a lie silently. A scan keeps working if the representation ever
changes.

**A correction worth keeping.** On first reading `"\u{1F600}".slice(0,1).charCodeAt(0)`
answering 55357 in both engines, I concluded milojs COULD hold half a character
and that my earlier reasoning had been wrong twice over. It had not: 55357 is
simply the first unit of the whole character milojs returns, and its `.length` is
2 where node's is 1. Condemning your own earlier work is not automatically the
rigorous move; it needs the same evidence as defending it.

### An audit for silent limitations, mostly negative — 2026-08-16

Run at the milo maintainer's suggestion after they found `std/json` decoding
surrogate pairs into CESU-8. Their refined property is the useful one: **grep for
limitations that are SILENT, not for limitation comments.** A comment saying
"only X is supported" next to code that throws is fine; the dangerous shape is a
comment that justifies returning a plausible wrong answer, and it survives review
because the code matches its own documentation perfectly.

Yield here, reported in full because most of it is negative:

- Every other limitation in `src/` and `lib/` is LOUD: `child_process`, `https`,
  `net.createServer`, `http.request`, `tls.connect` and the sqlite BigInt cases
  all throw with a message naming the gap.
- **`normalize` was the exception**, and its comment was actively false. See
  above.
- **A stale comment in `parseClass`** said class fields and getters are
  unsupported and that a getter parses as a method. All of it works. This is the
  quietest kind of wrong doc: it under-claims, so nobody hits a bug, they just
  avoid a feature that works.
- **Fixture flakiness: none.** Six fixtures use `setImmediate`, `Math.random`,
  `Date.now` or `hrtime`. Ran node 6x and milojs 8x against each: all
  deterministic on both sides. The one that WAS flaky by construction
  (`eventLoop`) had already been found and fixed. Note the method: running only
  the side you control proves nothing, which is the lesson from that fixture.

### Error stacks carry frames, and a subclass gets one at all — DONE 2026-08-16

`new Error("boom").stack` was the header line alone, with no frames, and
`class E extends Error {}` produced an instance whose `.stack` was **undefined** —
the one property a caller reaches for when logging a custom error.

Both fixed using the frame machinery added for V8 structured traces
(`fnFileStack`). A stack now names the source file of each function on the call
stack. Deliberately no line or column: this engine records no per-frame position,
and `:0:0` would be fake precision a reader would try to use. Frames stay
repo-relative rather than absolute, because an absolute path would make the
fixture machine-specific and uncommittable. Locked by `tests/errorStacks.js`,
which is byte-identical to node.

### A fixture that pinned an order node does not guarantee — DONE 2026-08-16

`tests/eventLoop.js` asserted that `setImmediate` runs after the 0ms/1ms timers.
**node does not guarantee that in the main module**, and does not deliver it
consistently: across 15 runs it printed "immediate" at line 6 eight times and at
line 8 seven times, because whether the 0ms timer is already due depends on how
long process startup took. milojs is deterministic (15/15 at line 6).

So the fixture was flaky by construction, and its exemption was recording a
divergence that was really a coin flip. The fixture now asserts what node does
guarantee: that `setImmediate` runs, and after the microtask drain. Deterministic
in both engines, 10/10 against the committed capture, and the exemption is gone
for a real reason this time.

**How this was found is the part worth keeping.** I deleted that exemption
earlier the same hour on a SINGLE observation that it matched node, which is the
exact mistake this file warns about elsewhere: one run is not a measurement. The
STALE check added minutes before caught it and put the exemption back. Then the
12-run retest said "deterministically divergent", which was also wrong, because
it compared against one node capture that happened to be the other coin face.
The truth needed running BOTH engines repeatedly. A gate written an hour earlier
caught its author.

### An exemption that stopped diverging — DONE 2026-08-16

`tools/verify-expected.sh` checks every `.expected` against node, and
`tests/.node-oracle-exempt` is the list of fixtures it skips. Each entry is
argued in the file, which is good, but nothing re-tested them.

**`tests/eventLoop.js` had stopped diverging.** Its exemption said setImmediate
runs before the 0ms/1ms timers where node runs the timer phase first. That was
fixed at some point and the exemption outlived it: the fixture had been matching
node exactly while sitting behind a hole in the gate. It is a node-verified
fixture again and the entry is gone (5 exemptions left, from 6).

Two checks added so the registry cannot rot the same way again, both proven to
fire before being committed:

- **STALE**: every DIVERGENCE exemption is re-run against node, and one whose
  output already matches fails, telling you to delete it. A gate stops gating
  when its exceptions outlive their reasons, and nothing was watching for that.
- **UNARGUED**: the file's own rule was "do not add a DIVERGENCE without a
  backlog entry", enforced by nobody. It is checked now. NOT-RUNNABLE entries
  are exempt from that rule, because node genuinely cannot run them and there is
  no bug to track, so the headings in the file are read rather than decorative.

The rule this came from, borrowed from the milo maintainer, who hit it the same
day from the other side (a fixture that passed only because a worse parse error
let the checker recover far enough to reach the assertion): **a fixture that can
be satisfied by weakening the thing under test was not testing it.** The local
form is that an exemption list nobody re-tests is a way to make a failing fixture
pass, one commit at a time.

### matchAll answered an array, and six methods were missing from String.prototype — DONE 2026-08-16

Chasing the 0/25 above. The flat zero was one wire, as the pattern predicted:

- **`matchAll` returned an ARRAY where the spec says an iterator.** So the common
  `[...s.matchAll(re)]` worked and nothing else did: `.next` was absent, and
  spreading the same value twice yielded the matches twice where an iterator is
  exhausted after one pass. It reuses the existing array iterator now, which
  supplies `next`, `@@iterator` and the one-shot behaviour together.
- **A non-global regex no longer silently succeeds.** The spec makes it a
  TypeError, because the result would repeat the same match forever.
- **Six methods dispatched by name but were absent from `String.prototype`:**
  `matchAll`, `at`, `codePointAt`, `replaceAll`, `localeCompare`, `normalize`.
  `typeof "".matchAll` was `"undefined"`, so anything starting from the prototype
  (which is how test262 is written, and how `Function.prototype.call.bind` and
  every uncurry idiom work) failed before calling anything.

| area | before | after |
|---|---:|---:|
| `String/prototype/matchAll` | 0/25 | **5/25** |
| `String/prototype/at` | 0/11 | **9/11** |
| `String/prototype/localeCompare` | 3/13 | **9/13** |
| `String/prototype/replaceAll` | 5/45 | **9/45** |

`at` was a second flat zero from the same cause, which is the pattern holding a
third time: **a whole subsystem reading as broken is more often one wire than N
faults.** The 1500-sample did not move (699 either way); these directories are
not in it. Locked by `tests/matchAllAndStringProto.js`.

### Character classes were byte ranges too — DONE 2026-08-15

`ReClass` held `u8` ranges, so a class compared one byte at a time:

| expression | was | node |
|---|---|---|
| `/^[à-ÿ]$/u.test("é")` | false | true |
| `/^[^a]$/u.test("é")` | false | true |
| `/^[а-я]+$/u.test("привет")` | false | true |
| `"aéb".match(/[^x]/gu).length` | 4 | 3 |

Ranges are code points now, class members parse as code points (so `[à-ÿ]` is one
range rather than four bytes of which two look like one), the shorthand
complements span to 0x10FFFF instead of 0xFF, and case folding inside a class
goes through the real Unicode mappings so `/[à-þ]/i` matches É.

One more had to move with it: **the search loop advanced one BYTE per failed
attempt**, restarting the match inside a multibyte character where a decode reads
a continuation byte as its own code point. `/[^é]/u.test("é")` was true because
the retry at offset 1 "matched" the second half of the é it had just rejected.
It steps a whole character now.

`built-ins/RegExp` did not move (734/1879 either way): test262's coverage here is
almost entirely ASCII, which is the same observation that made the real-app check
worth building. The evidence is the 31-case differential fixture.

**Still open, now genuinely unblocked:** `\p{...}` property escapes are
unsupported and match nothing silently (`/\p{L}/u.test("é")` is false). Classes
can hold the ranges now, so it is table generation in the shape of
`tools/gen-unicase.mjs` plus a `\p{...}` branch in the class parser.

## The runtime hid globalThis behind a whitelist, and four missing members — DONE 2026-08-15

- **`globalThis` was a hand-written object in the RUNTIME.** The engine installs
  a real one whose property reads resolve through the global scope, and
  `src/milojs.milo` then overwrote it with a bare `{}` (plus a prelude object
  listing about twenty well-known names). So `globalThis.Symbol`,
  `globalThis.Reflect`, `globalThis.Proxy` and every typed array read as
  undefined under `milojs` while working under `milojs-engine`. Feature detection
  is written that way constantly. The comment in milojs.milo claimed the engine
  exposed no global-object reflection; it does, through the `isGlobal` flag.
  Now identical to node across 12 probed globals, plus `global === globalThis`
  and the self-reference.
- **`Object.groupBy` / `Map.groupBy`** (ES2024) added.
- **`String.prototype.isWellFormed` / `toWellFormed`** (ES2024) added. milojs
  strings are UTF-8, which cannot represent a lone surrogate, so every string
  here is well-formed by construction and saying so is more useful than omitting
  the methods.
- **`%TypedArray%.of` / `.from`** added, `from` taking an iterable or array-like
  plus an optional map function.
- **`structuredClone` was already implemented** and the backlog entry was stale.

Two things worth keeping from how this went wrong:

- **Adding `isWellFormed` via `String.prototype` broke `normalize` and
  `localeCompare`.** Assigning to that prototype marks it touched, which turns
  off the by-name string dispatch, and any method living only on that path
  disappears. They are implemented in `stringMethod` instead. Anything added to
  `String.prototype` from JS carries the same risk.
- **`Set` is iterable but its `Symbol.iterator` is not readable as a property**,
  so `typeof src[Symbol.iterator] === "function"` is a broken iterability test
  here. `%TypedArray%.from` spreads instead.

Locked by `tests/runtime/modernSurfaceAndGlobal.js`.

## An in-progress compiler change broke async, and how it was found — RESOLVED

For a few hours this repo's suite was red with eight fixtures failing, all
async/generator/green-task shaped: `doubleBind`, `generatorProtocol`,
`microtaskHandlerGcRoot`, `objectGeneratorMethods`, `promises`, `r2r3Barrier`,
`r6LocalsLiveAcrossSuspend`, `staticAccessors`. The symptom was silent: `await`
on a BOUND async function produced no output, no error, exit code 0.

```js
function C(x){ this.x = x; }
C.prototype.m = async function(a){ return this.x + a; };
var mm = new C(7).m.bind(c);
async function main(){ console.log(await mm(3)); }   // expected 10, printed nothing
main();
```

**Nothing pushed to milo was ever broken.** The first diagnosis written here said
"a regression between `b5a40d2b` and `03635d2b`", and that was wrong: the milo
maintainer bisected every pushed commit in that range and all of them print 10.
The breakage was in their UNCOMMITTED working tree, which this repo builds from,
because `milo` on PATH is a symlink into that checkout. Cause: new drop glue for
closure environments, specifically `reapTask` releasing a spawned task's
environment. That one release has been dropped from what they are landing; a
spawned task's environment keeps leaking exactly as it does today.

Two things to keep from this:

- **A red suite here can mean a dirty compiler tree, not a landed regression.**
  Check `milo --version` against `~/git/milo`'s status before writing anything
  down, and say "the compiler this was built with", not "a pushed commit".
- **Conformance numbers must not be republished while the toolchain is
  suspect.** The 1500-sample read 682 during the outage against the 699 on
  record; publishing that would have recorded a 17-case decline that never
  happened in this repo. Re-measured after the fix: 699 and 99 again, exactly
  what was already published.
- **Check `uptime` before believing a number that moved without a code change.**
  This machine is shared with other agents building the compiler. A suite run
  here went 4s to 16s (and run-milo 14s to 49s) with no source change at a load
  average of 12.96, and the milo maintainer independently saw full-suite runs
  report 19, then 202, then 21, then 32 failures with different membership each
  time, every one of which passed when run alone. Re-run before diagnosing.

Resolved on the milo side by `3436dd96`: the codegen glue had been swept into an
unrelated commit WITHOUT its std/runtime half, so spawn paths were not forgetting
what they hand over. Verified from this repo against `e551a4e6`: 209/209 fixtures
over three consecutive runs, both GC-pinning fixtures clean under
`MILOJS_GC_THRESHOLD=1`, tahoeroads and chat still byte-identical to node, and
conformance back to 699/99.

**The lifetime question is still open, and this repo is the one that can answer
it.** milojs matches tasks by RAW POINTER and holds those pointers past the
body's completion, in `genTask`/`genEnv`, `actTask`, and
`awaitTask`/`suspendedTask`. The abandoned-generator case is unbounded rather
than a window: `for (const x of g()) break;` leaves a body task that never
finishes and never gets a terminal read, so `removeGen` never runs. A
"task is about to be reclaimed" hook would let us drop our record and delete the
recycled-address workaround documented above `removeGen`; the requirements we
need from it are recorded in that discussion (fire before reuse, fire for
abandoned tasks too, hand back the task pointer, be safe to call mid-reap).

Open on the milo side, and this repo is the one that can answer it: something
reaches a spawned task's environment AFTER the task is reaped, which is why
releasing it breaks async. See milo's backlog #18.

## Node-API: 20 entry points added, and three real addons load — 2026-08-15

An audit of every `.node` file across five real applications, by diffing the
symbols each one needs against the symbols milojs exports:

| addon | v8 syms | napi syms | status |
|---|---:|---:|---|
| prisma query engine | 0 | 60 | loads (tahoeroads serves DB-backed pages) |
| `sharp` | 0 | 52 | **now loads** |
| `fsevents` | 0 | 20 | **now loads** |
| `onnxruntime-node` | 0 | 65 | linux/x64 build, not testable here |
| `better-sqlite3` | **49** | 0 | cannot load, see below |

`sharp` named 18 entry points that were **absent from the binary rather than
stubbed**, which is a different failure: a missing symbol makes `dlopen` fail
before the addon runs a line. Added, with `fsevents`'s two on top:

- handle scopes: `napi_open_handle_scope`, `napi_close_handle_scope`, the
  escapable pair, and `napi_escape_handle`. Every handle is already mirrored into
  the interpreter's foreign-host root set for its lifetime, so a scope has no
  storage to reclaim and these are bookkeeping.
- async work: `napi_create_async_work`, `napi_queue_async_work`,
  `napi_delete_async_work`. node runs `execute` on a libuv threadpool and
  `complete` on the loop thread; milojs has one JS thread, so queueing runs
  execute and then complete in that order. An addon sees its work finish
  correctly, but gets no parallelism, so a long execute blocks the loop.
- values: `napi_create_string_latin1` (one byte per code point, not UTF-8),
  `napi_get_value_int64`, `napi_get_typedarray_info` (length in ELEMENTS, and
  `data` pointing at the VIEW's first byte, not the buffer's, or a subarray reads
  the wrong bytes), `napi_create_external` / `napi_get_value_external`.
- properties: `napi_define_properties` (honouring accessors, not flattening a
  getter into a data property), `napi_has_property`, `napi_has_own_property`,
  `napi_add_finalizer`.
- errors: `napi_get_last_error_info`, `napi_is_exception_pending`,
  `napi_create_type_error`.

Two bugs in the engine came out of writing the test addon for them:

- **A Node-API accessor never fired.** `getMemberDyn` gated its getter on
  `isCallable`, the value-only predicate, and a Node-API function is an OBJECT
  carrying a `napiFn` index. `isCallableIn` recognises it.
- **`objHasInChain` stopped one level short.** A plain object's `proto` field is
  -1 and the link to Object.prototype is resolved by type, so the raw walk
  reported `toString` as absent.

Also fixed: **the preloader tried to PARSE `.node` files as JavaScript**, and
reported `expected an expression, found '<'` against a Mach-O load command table.
`.node` files are dlopened at require time and must not be followed by the module
graph walk.

Locked by `tests/napi/surface.c` and `tests/napi/surface.js`, which are a link
test first: if any of these regresses out of the build, loading the addon fails
outright. Writing them also caught a misuse worth recording: deleting an
async_work straight after queueing frees it under a live threadpool worker, and
node segfaults. The handle is deleted from the complete callback instead.

**better-sqlite3 stays out of reach, and no amount of Node-API work changes
that.** Its 11.10.0 prebuilt links the V8 C++ API: `nm -u` shows 49 `v8::`
symbols and zero `napi_`. Implementing those means reproducing V8's object
layout, not just its function names, because the V8 headers inline much of it.
For scale: Bun's V8 compatibility layer is ~4,300 lines and its own notes
describe it as "V8-compatible object layouts that inline V8 functions can read"
plus tagged pointers and handle-scope buffers. The three sqlite apps need a
sqlite package that is napi-native instead.

## console had 11 missing methods, could not be overridden, and wrote diagnostics to stdout — DONE 2026-08-16

Found by running `html-escaper`'s own test suite, whose first statement is
`console.assert(...)`. Three separate defects, in increasing order of how much
they matter:

**Missing methods.** `assert`, `table`, `group`, `groupEnd`, `groupCollapsed`,
`time`, `timeEnd`, `timeLog`, `count`, `countReset` and `clear` did not exist.
Each was not a degraded log line but a `TypeError` that killed the program: a
library that instruments itself with `console.time` cannot even be imported.
Added in `lib/prelude.js` with node's semantics, including group indentation
applied to every stream and `console.assert` printing only on a falsy first
argument.

**`console.log` could not be overridden.** `evalCall` had a fast path that fired
on the receiver being named `console` and the method being a known name, so
`console.log = fn` was accepted and then ignored. Monkey-patching console is how
loggers, test harnesses and output capture all work, so this silently broke a
whole class of library. The fast path now consults `consoleMethodIsPristine`,
which checks the live binding is still the native before taking the shortcut.

**`console.error` and `console.warn` wrote to stdout.** Any program whose stdout
is piped or parsed got its diagnostics interleaved into its data. Both the native
(`NATIVE_CONSOLE_ERROR`) and the fast path now select `eprint`. The two sites had
to be fixed together: fixing only the native left the shortcut still wrong, which
is exactly what the first verification pass caught.

Locked by `tests/runtime/consoleSurface.js`, which diffs stdout and stderr
against node separately — the combined-stream capture that `tests/run.sh` uses
cannot see a stream mix-up at all.

## Built-in arguments skipped ToString, and `new` could not take a computed callee — DONE 2026-08-16

Found by a new method: install real npm packages and run each one's OWN test
suite under milojs and under node, then diff. 53 of the packages installed as
transitive dependencies ship a runnable `test/index.js`. All 53 failed, and all
53 failed for the same reason, which is what made the method worth keeping: a
corpus that fails as a block is pointing at one defect, not fifty-three.

**Arguments to built-ins were never coerced through the interpreter.**
`builtins.milo` has no `Prog` and so cannot re-enter the evaluator; its `argStr`
and `argNum` answer `"[object Object]"` and `NaN` for every object, skipping the
user `toString`/`valueOf` the spec requires calling. 13 of 17 probed operations
were wrong: `exec`, `test`, `@@match`, `indexOf`, `includes`, `startsWith`,
`split`, `replace`, `padStart`, `repeat`, `at`, `charAt`, `slice`.

That is a spec deviation on its own, but the reason the whole corpus died is
narrower. `is-regex` identifies a regex by handing `RegExp.prototype.exec` an
object whose `toString` throws a private marker, and answering whether the
marker comes back. An engine that stringifies without asking makes the function
return `undefined` — neither true nor false — and `safe-regex-test` then rejects
an actual RegExp with "`regex` must be a RegExp". `tape` is built on that path,
so no package that tests with tape could load.

Fixed by coercing at the dispatch boundary, in `eval.milo`, where a `Prog`
exists and a throwing conversion has somewhere to throw from; `builtins.milo`
stays prog-free. The position table (`strArgWantsString`/`strArgWantsNumber`) is
per method because the spec is: `padStart` ToNumbers argument 0 and ToStrings
argument 1. It runs after the regex-op branch, since stringifying a RegExp
argument would turn `s.replace(/a/g, "x")` into a search for the literal `/a/g`.

**`new` accepted only `.name` in its callee.** `parseNew` looped on `T_DOT` and
nothing else, so `new g[name]()` parsed as `new g` and reported "value is not a
constructor" against the container instead of constructing what the key names.
`new g.Uint8Array()` worked, which is why this survived: the two forms are
interchangeable everywhere else. Indexing a table of constructors is how
`which-typed-array` builds one instance per global name.

Next barrier in the same corpus, not fixed here: `Object('a')` returns the
primitive rather than a String wrapper object, so `0 in Object('a')` throws.
That is the primitive-wrapper item already open below.

Locked by `tests/coercionAndNewCallee.js`.

## Primitive wrapper objects did not exist — DONE 2026-08-16

`new String("a")`, `new Number(1)`, `new Boolean(false)` and `Object(prim)` all
handed back the PRIMITIVE. Three observable things were wrong at once: `typeof`
said "string", `new Boolean(false)` was falsy, and the result was `===` its own
primitive. The fourth consequence is the one that surfaced it: `0 in Object("a")`
threw, because the `in` really was being applied to a string.

Found by the npm-package corpus. `array.prototype.every`'s first two lines are

    var boxedString = Object('a');
    var splitString = boxedString[0] !== 'a' || !(0 in boxedString);

a feature probe for an engine bug from 2010, and it is a dependency of tape.

A wrapper is now an ordinary object carrying `JSObjExtra.boxed`, which doubles as
its own discriminator since no wrapper ever holds undefined or null. A String
wrapper materialises its index properties and `length` eagerly, frozen and (for
the indices) enumerable, matching node's descriptors: the string behind them can
never change, so there is nothing to keep in sync and every path that enumerates,
tests `in`, or reads a key works without a special case.

The paths that had to learn about it:

- **ToPrimitive** unwraps, which covers `+`, template holes, `String()`,
  `Number()`, and relational comparison in one place.
- **`==` between an object and a primitive** now converts the object side. That
  is the general spec rule, not a wrapper special case; it was simply missing.
- **Method dispatch** delegates to the primitive for anything the wrapper does
  not own, because the prototype's entries are bound methods carrying no
  receiver. A user-defined override still wins.
- **instanceof**, **spread/iteration**, **`Object.prototype.toString`** tags, and
  **JSON.stringify**.

Two things learned the hard way. JSON.stringify is implemented in
`lib/engine-prelude.js`, not in the native: the native cannot call back into user
code, so `toJSON`, the replacer and the reviver live in JS. Unwrapping in
`mjPushStringified` therefore had no effect at all, and the debug print that
proved the branch was never reached was worth more than the reasoning that said
it should have been. And `Object.prototype`'s own methods were enumerable, which
nothing had ever exposed because a plain object is not linked to it here; String
wrappers listed `hasOwnProperty`/`toString`/`valueOf`/`isPrototypeOf` among a
string's indices in for-in until they were marked non-enumerable.

Measured on the 53-package corpus: 52 of 53 suites now execute (they previously
died before their first assertion), 666 of 1699 assertions pass where 0 did, and
20 packages match node's assertion count exactly. The remaining gap is spread
across many small causes rather than one barrier, which is a different kind of
work from the three single-cause fixes that got here.

Locked by `tests/primitiveWrappers.js`.

## An absolute entry path under the working directory broke every node_modules require — DONE 2026-08-16

`milojs /path/to/app/main.js` run from inside `/path/to/app` failed with
"module was not pre-loaded" on every `require`, while the same program run as
`milojs main.js`, or with the same absolute path from a different working
directory, worked. Absolute entry plus cwd-at-or-above-the-entry is the common
shape — it is what a shell script, a supervisor, and an editor's run button all
produce.

The module registry keys on the paths the PRELOADER produced, and require
resolves through `relativizeToCwd`. An absolute entry keyed the whole graph
absolutely while every lookup arrived in relative form, so nothing matched. The
entry path is now relativized before the graph walk, and `preloadGraph` returns
the entry's index by the same key it registered it under — the second half
mattered: relativizing only the queue made the entry itself unfindable and
turned the failure into "cannot read".

Found because `tools/check-packages.sh` passed absolute paths.

## tools/check-packages.sh: real packages' own test suites as a gate — 2026-08-16

The fixtures in `tests/` are written by whoever is fixing something, so they
encode what was already suspected. A package's own suite does not. Three defects
in one sitting — built-in arguments skipping ToString, `new` rejecting a computed
callee, primitive wrappers not existing — were each invisible to all 217
fixtures and each fatal to roughly fifty npm packages.

The corpus is the ljharb/es-shim dependency tree, on purpose: those packages
feature-detect the engine aggressively and test with tape, so one engine defect
shows up as a whole suite that cannot start. That amplification is what makes
the signal readable — a corpus that fails as a BLOCK is pointing at one cause,
and each of the three fixes above took the block from 0 assertions to thousands.

Counted per TAP assertion rather than per suite: a suite that dies on its first
line and a suite that fails one edge case are very different results, and
pass/fail per file cannot tell them apart. `tools/packages-baseline.txt` holds
the last measured pair and the script fails only on a DECREASE, because the
number moves with the corpus as well as with the engine.

Today: 53 suites run, 666/1699 assertions, 20 suites complete. Before this
session's three fixes: 0/1699 and 0 complete.

## Prototype methods accepted any receiver, so every is-* detector answered true — DONE 2026-08-16

`String.prototype.valueOf.call([])` returned `""` instead of throwing. Same for
`Number.prototype.valueOf`, `Boolean.prototype.valueOf` and every Date getter.
Not a quiet deviation: calling a prototype method on a candidate and catching
the TypeError IS the detector that `is-string`, `is-number-object`,
`is-boolean-object`, `is-date-object`, `is-weakref` and
`is-finalizationregistry` are built on, so each of them reported arrays,
objects and regexes as instances of its type.

The existing `boundBrand` mechanism (built for the buffer family) already had the
shape; it needed four more brands and a receiver rule that accepts the PRIMITIVE
as well as the wrapper, since `String.prototype.valueOf.call("abc")` is legal and
`.call([])` is not. Three related fixes fell out of it:

- **`String.prototype.valueOf` on a primitive returned undefined.** It was never
  implemented in `stringMethod`, so the detector failed in the other direction.
- **`String.prototype` really is a String object.** The spec gives it, and
  Number.prototype and Boolean.prototype, a [[StringData]]/[[NumberData]]/
  [[BooleanData]] slot holding `""`, `0` and `false`. That is why
  `String.prototype + ""` is `""`, and it is why the brand check must accept the
  prototype as a receiver for its own valueOf. Symbol.prototype, BigInt.prototype
  and Date.prototype are ORDINARY objects by contrast, and node throws for their
  branded methods called on themselves; the fixture pins both halves.
- **The REST of String.prototype is generic** and ToStrings whatever receiver it
  gets: `String.prototype.indexOf.call(["a","b"], "b")` is 2, because the
  receiver becomes `"a,b"` and the array is not searched as an array. milojs
  answered 1 by dispatching on the array. Branding those methods generic and
  converting the receiver at the bound-method call sites fixes it while keeping
  null/undefined a TypeError.

**A defect of my own, caught by the new gate.** The `==` object-vs-primitive
conversion added with the wrapper work converted `obj == null` too. The spec
resolves that to false with NO conversion, and get-intrinsic opens with exactly
that null guard against `Date.prototype`, whose valueOf now correctly throws. So
a correct fix (brand checks) turned an already-shipped bug (over-eager `==`
coercion) fatal. `tools/check-packages.sh` went 666 to 0 assertions and refused
to pass, which is the entire argument for having built it a run earlier.

Corpus: 666 to 701 assertions, 20 to 26 suites complete.

Locked by `tests/receiverBrandChecks.js`.

## `this` in a receiver-less call was undefined, and Function was not callable — DONE 2026-08-16

Two defects that only look separate. `Function("return this")()` is how a
library finds the global object, and it needed both halves to work.

**`Function` was a plain object holding `.prototype`.** Calling it reported
"Function is not a function", and `new Function(a, b, body)` reported "value is
not a constructor". It is now a Native built on the same evaluator `eval` uses,
producing node's exact source layout (`function anonymous(a\n) {\nbody\n}`)
because `Function.prototype.toString` on the result is observable. Always the
global scope: a function built this way never closes over its caller, which is
the difference from direct eval. es-get-iterator (140 assertions) and
function-bind (46) build their test subjects with it and could not start.

**`this` in a call with no receiver was `undefined`, not `globalThis`.** This is
OrdinaryCallBindThis and it was simply absent, so every UMD wrapper, every
`var global = (function(){ return this })()`, and every sloppy-mode method
extraction saw the wrong value. Fixed at the single point where a frame binds
`this`. The engine tracks no strict mode, so it applies the sloppy rule
throughout, which is also the mode the test262 sweep runs in.

Also: **`fn.constructor === Function`** and **`fn instanceof Function`** were
both false. Functions are not objects in this value model, so nothing linked
them to `Function` and the instanceof walk never saw them.

Corpus: 701 to 760 assertions.

Locked by `tests/functionConstructor.js`.

## RESOLVED 2026-08-16: Function.prototype.toString returns "[object Function]", never source

Every function stringifies to `[object Function]` — declared, expression,
arrow, or built by `new Function`. Node returns the verbatim source text, and
libraries read it: lodash distinguishes native from user functions by looking
for `[native code]`, and several detectors parse the parameter list out of it.

Blocked on the lexer, not on the printer. `Token` carries `kind`, `num`, `text`,
`nlBefore` and `raw` but no byte offset, and `FuncDef` keeps no span, so there is
nothing to slice the original source with. Reconstructing text from the AST would
not fix it either: the `.expected` files are byte-exact against node, and a
pretty-printer cannot reproduce the author's spacing.

The fix is offsets on Token, a start/end span on FuncDef, and the source text
retained per module. Worth doing, but it touches the hot lexer path and should
be measured, not assumed free.

## getPrototypeOf/setPrototypeOf ignored primitives, and Symbol.iterator was unreadable on Map/Set/String — DONE 2026-08-16

`Object.getPrototypeOf` and `Reflect.getPrototypeOf` differ in exactly one way:
Object BOXES its argument, so `Object.getPrototypeOf(42)` is `Number.prototype`,
while Reflect does not and throws for the same input. milojs returned `null` for
every primitive from both and threw from neither. Four packages test precisely
that boundary — get-proto, reflect.getprototypeof, dunder-proto, set-proto — and
between them account for 30 failing assertions.

Fixed: `Object.getPrototypeOf`/`setPrototypeOf` follow ToObject (nullish throws,
a primitive resolves to its wrapper prototype), and every `Reflect` entry point
requires a real object. `__proto__` reads on primitives resolve the same way, and
`Object.prototype.__proto__` is now a visible accessor descriptor — the evaluator
still short-circuits `__proto__` before any chain walk, so the property makes the
descriptor VISIBLE rather than implementing the behaviour, which is what
dunder-proto reads off it.

**Two latent bugs surfaced by the Reflect check, in the same pattern as the
`obj == null` one.** Making Reflect reject a non-object turned two silent wrong
answers into hard failures, and the corpus went to 0 twice more:

- **%IteratorPrototype% was not linked to Object.prototype.** The array-iterator
  chain was one link shorter than node's, so walking it three deep answered null.
- **`Map.prototype[Symbol.iterator]`, `Set`'s and `String`'s did not exist as
  readable values.** for-of and spread always worked because they drive the
  collection directly and never read the member. get-intrinsic resolves
  `%MapIteratorPrototype%` by CALLING it, which is a different thing.

That second one needed fixing in two places, and the reason is worth recording:
`m[Symbol.iterator]` extracted and then called goes through the member-read path,
while `m[Symbol.iterator]()` written as one expression dispatches by the symbol
KEY. The extracted form worked as soon as the member read was fixed, so the
direct form looked fixed too until the corpus said otherwise.

Corpus: 760 to 796 assertions.

Known divergence, not fixed: `Object.getOwnPropertyDescriptor(Object.prototype,
'__proto__').get.call(undefined)` returns Object.prototype where node throws. The
getter is a strict built-in, so node leaves `this` undefined; milojs has no
strict-mode tracking and substitutes globalThis for every receiver-less call. The
two are indistinguishable at the call site without tracking strictness.

Locked by `tests/prototypeOpsAndIterators.js`.

## Four defects in Function.prototype.bind, and match/search rejected string patterns — DONE 2026-08-16

**bind.** The result carried no own `length` or `name`, `.call` on it replaced
the bound receiver instead of ignoring the call-site one, and `new` on it
reported "value is not a constructor". A wrapper that preserves arity by reading
`fn.length` off a bound function got `undefined`; function-bind asserts all four.
`length` is now the target's less the pre-bound arguments (floored at 0) and
`name` is `"bound " + target name`, set at every one of the six sites that build
a bound object. `.call`/`.apply` route through `callValue` on the bound object
itself, which already merged the bound receiver and arguments correctly — the
bug was one site calling the TARGET directly and discarding both. `new` on a
bound function constructs the target with the bound arguments in front and the
bound `this` ignored, per [[Construct]].

**match/matchAll/search with a string pattern returned undefined.** The spec has
no non-regex form for these three: it builds a RegExp from whatever it is handed,
so `"a1b".match("\\d")` is `["1"]`. `replace` and `split` DO have literal-string
forms and keep them, which is why the conversion is keyed to the three names
rather than applied to every regex-ish op.

Locked by `tests/bindAndStringPatterns.js`.

## RESOLVED 2026-08-16: is-callable reports every object as callable

`isCallable({})` is `true`. The package detects callables by calling
`Function.prototype.toString` on the candidate inside a try/catch; milojs accepts
any receiver there, so nothing throws and everything looks callable. Classes are
also reported callable, because that check regex-matches `/^\s*class\b/` against
the source text milojs does not have.

Branding `Function.prototype.toString` to require a callable receiver was tried
and REVERTED: it fixes `isCallable({})` but costs 9 assertions elsewhere in the
corpus, through a path that ends in "String.prototype.match called on
incompatible receiver" during tape's own reporting and was not diagnosed. It is
also only half a fix while the source text is missing, since class detection
stays broken either way. Both halves want the lexer-offset work in the
Function.prototype.toString entry above; they should land together.

## OPEN: require() of an absolute path to a package directory

`require('/abs/path/to/node_modules/function-bind')` fails with "no such
package", where node resolves the directory through its package.json `main`.
Relative and bare specifiers both work; only the absolute-directory form is
missing. Found while writing a probe against the package corpus.

## Function.prototype.toString now returns real source — DONE 2026-08-16

Every function stringified to `[object Function]`. Not merely imprecise: lodash
and friends tell a built-in from a user function by looking for the exact string
`[native code]`, so every user function looked native; and is-callable decides
whether a value is callable by whether `Function.prototype.toString` throws on
it, so every object looked callable.

Answering it needs the VERBATIM text — the `.expected` files are byte-exact
against node, and a pretty-printer cannot reproduce the author's spacing. So:

- `Token` gains `at` and `end` byte offsets. Stamped centrally in the lex loop
  rather than at each of the ten Token literals, several of which are built in
  helpers that never see the cursor. Each iteration consumes exactly one token
  or only whitespace, so at the top of the NEXT iteration the cursor is exactly
  the previous token's end.
- `FuncDef` gains `srcStart`/`srcEnd`, filled at all six construction sites.
  `async` is included because the caller consumed it and node's output has it;
  a class METHOD starts at its name while a static BLOCK starts at `static`.
- `Prog` keeps each file's text once, so a span can be sliced back out. Once per
  file, not per function: a function's text contains every nested function's
  text, so per-function slices would duplicate the program at each nesting level.

Built-ins keep node's `function <name>() { [native code] }`, and a genuine
bind() result prints anonymously where a built-in METHOD value keeps its name.
ToString of a function is its source everywhere, not only through `.toString()`:
`String(fn)`, `"" + fn` and `${fn}` all had to be routed through the Prog.

**Two latent bugs this exposed.** `Object.getPrototypeOf(fn)` answered
Object.prototype for every function: a function's property BAG is an ordinary
object, and the bag was what got asked. A bag with a DELIBERATE prototype still
wins, which matters because `Object.getPrototypeOf(Int8Array)` is the
%TypedArray% intrinsic and test262's whole TypedArray tree opens with that read.
And `String(x)` used the prog-free `toStr`, so a user `toString` never ran there.

With those fixed, branding `Function.prototype.toString` to require a callable
receiver is net POSITIVE — the earlier attempt cost 9 assertions and was
reverted, and the reason was this getPrototypeOf bug, not the brand. Corpus 797
to 800 assertions and 26 to 28 complete suites.

Still wrong: `isCallable(class {})` is true. That check regex-matches
`/^\s*class\b/` against the source, and a class's source is not yet recorded —
classes are built from `ClassDef`, which has no span. Same fix, different node.

Locked by `tests/functionSourceText.js`.
