<!-- doc-meta
system: backlog
purpose: what to work on next, with measured conformance attribution per change
key-files: src/eval.milo, src/builtins.milo, src/parser.milo, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: an item lands, a gap is discovered, or a sweep re-attributes a score
last-verified: 2026-08-15
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
| test262, <!--fact:t262-sample-->1500<!--/fact-->-case deterministic sample | <!--fact:t262-pass-->699<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> = **<!--fact:t262-pct-->47.6%<!--/fact-->** | 2026-08-15 |
| QuickJS `tests/` at `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->` | <!--fact:qjs-pass-->98<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> = **<!--fact:qjs-pct-->65.8%<!--/fact-->** | 2026-08-15 |

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

- `Object.groupBy` / `Map.groupBy` (ES2024) are missing — `groupBy is not a
  function`.
- `String.prototype.normalize` returns its input unchanged, so
  `"e\u0301".normalize("NFC").length` is 2 where node gives 1. Needs
  composition/decomposition tables; the same generator approach as
  `tools/gen-unicase.mjs` would work.
- `structuredClone` is not defined.
- `String.prototype.isWellFormed` / `toWellFormed` (ES2024) are missing.
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

## Node-API: 10 of 64 entry points are stubs

`src/napi.milo` marks them honestly in-source (they exist only so `dlopen`, which
resolves eagerly, does not fail the whole module). Each returns `napi_ok` without
doing anything, which is a lie an addon can act on. Ranked by what a real addon
hits:

1. `napi_create_external_buffer`: owned and copied Buffers now expose stable
   shared memory in both C and JavaScript, but addon-owned memory still needs an
   exactly-once finalizer before external buffers can be honest.
2. `napi_get_and_clear_last_exception`, `napi_fatal_exception` — errors vanish
   instead of propagating.
3. `napi_create_bigint_words` and the three `napi_get_value_bigint_*`.
   `src/bigint.milo` already exists, so this is wiring, not new work.
4. `napi_coerce_to_object`, `napi_add_env_cleanup_hook`, `napi_fatal_error`.

Already real: `napi_define_class`, `napi_wrap`/`unwrap`, references, promises and
deferreds, synchronous calls back into JavaScript, and the full
threadsafe-function set. Node-API handles are collector roots, including while a
native callback re-enters JavaScript.
