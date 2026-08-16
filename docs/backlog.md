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
| test262, 1500-case deterministic sample | 660/1470 = **44.9%** | 2026-08-15 |
| QuickJS `tests/` at `fced162` | 97/149 = **65.1%** | 2026-08-15 |

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

- A template literal desugars to `"" + x`, so its holes convert with the DEFAULT
  ToPrimitive hint rather than the string hint the spec requires. Observable only
  for an object with both `valueOf` and `toString`: `` `${x}` `` answers valueOf
  where node answers toString. `String(x)` and `join` take the string hint
  correctly. Fixing it needs a template-concat node rather than a chain of `+`.

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

## Array holes are not modelled

`[1, , 3]` stores a real `undefined` element rather than a hole, so every method
that is specified to skip holes visits them instead. All six diverge from node:

| expression | milojs | node |
|---|---|---|
| `[1,,3].flat()` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].flatMap(x => [x])` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].filter(() => true)` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].forEach` callback count | 3 | 2 |
| `1 in [1,,3].map(x => x)` | `true` | `false` |
| `Object.keys([1,,3])` | `["0","1","2"]` | `["0","2"]` |

This is one representation decision, not six bugs: `JSObj.elems` has no "absent"
value distinct from `undefined`. Everything else follows from it, including
`delete arr[1]`. The backlog previously carried only the `flat` symptom.

## Smaller gaps found by probe on 2026-08-15

- `Object.groupBy` / `Map.groupBy` (ES2024) are missing — `groupBy is not a
  function`.
- `String.prototype.normalize` returns its input unchanged, so
  `"e\u0301".normalize("NFC").length` is 2 where node gives 1. Needs
  composition/decomposition tables; the same generator approach as
  `tools/gen-unicase.mjs` would work.
- `structuredClone` is not defined.
- `String.prototype.isWellFormed` / `toWellFormed` (ES2024) are missing.

## The runtime shadows the engine's native typed arrays

`lib/prelude.js`'s `_taFactory` defines `Uint8Array` and friends as ordinary JS
arrays with `_isTypedArray = true` and per-instance `set`/`subarray` closures.
It runs in the runtime, where it overwrites the engine's real typed arrays, so
`milojs` is strictly worse than `milojs-engine` here:

```
$ .dev/mj-engine  sub.js   # len 3  buf? true   proto true   own subarray? false
$ .dev/mj-runtime sub.js   # len 3  buf? false  proto false  own subarray? true
```

`a.buffer` is null, `Object.getPrototypeOf(a) !== Int8Array.prototype`, and every
instance carries own method properties node puts on the prototype. The engine
grew real `%TypedArray%` prototypes on 2026-08-15; the prelude copy was never
removed. Deleting `_taFactory` (and the `DataView` next to it) should be mostly
subtraction — check `lib/buffer.js`, which builds on `this.bytes`.

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
