# milojs backlog

Work items carried over from the milo repo's backlog when milojs moved to its own
repo, re-verified against the engine on 2026-07-24.

## Gate 0 blocker: native evaluator frame exceeds the normal stack

Against Milo `a9c2a5b8`, `evalExpr` reserves about 250 KB per native frame on
x86-64. A simple non-tail recursive JavaScript function crashes around depth 14
with the normal 8 MB Linux stack; `tests/closures.js` and `tests/semantics.js`
reproduce it. Both pass at 12 MB, and the whole suite passes with an unlimited
diagnostic stack.

This must be fixed in compiler stack allocation or by splitting the tree-walker
dispatcher. Do not change `tests/run.sh` to raise `ulimit`: embedders and ordinary
shell users have the same stack constraint, and MiloJS's JS-level recursion
guard cannot catch a native segfault that happens first.

## Measured conformance (2026-07-24)

Both sweeps need a local corpus (`TEST262=`, `~/git/quickjs/tests`), so these are
run by hand rather than in CI:

| sweep | score |
|---|---|
| test262, 1500-case deterministic sample | 473/1476 = **32.0%** |
| QuickJS `tests/` | 93/149 = **62.4%** |

Weakest areas: `built-ins/TypedArray` 0%, `ArrayBuffer` 0%, `Atomics` 0%,
`language/eval-code` 0%, `Temporal` 1%, `TypedArrayConstructors` 5%, `Map` 14%.
Strongest: `language/block-scope` 100%, `literals` 77%, `identifiers` 75%.

Stage 6 of the roadmap calls for a checked-in `test262-status.md` so the trend is
visible. It does not exist yet — this table is the stopgap.

## The dispatch model — Array and Error done, the rest still whitelisted

Built-in methods were **not** real properties on real prototype objects. They
were dispatched by a name whitelist checked at gated sites on the property path.
Two slices of this are now fixed; the pattern for the rest is established.

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

**Still whitelisted:** `String` (`isStringMethodName`), Map/Set
(`isMapSetMethodName`), RegExp, Date, DataView, typed arrays. Each has the same
symptom: prototype assignment is dead code, overrides are ignored on calls.
Strings are the most valuable next slice — `built-ins/String` is at 38%, and
string methods are reached far more often than Map/Set ones.

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

## Smaller known gaps

- Generators are runtime-only: `function*` throws
  `generators require the milojs runtime (not the engine)` under
  `milojs-engine`, costing 42 test262 and 3 QuickJS cases. The runtime handles
  them, so this is engine/runtime factoring, not a missing feature.

## Node-API: 13 of 64 entry points are stubs

`napi.milo` marks them honestly in-source (they exist only so `dlopen`, which
resolves eagerly, does not fail the whole module). Each returns `napi_ok` without
doing anything, which is a lie an addon can act on. Ranked by what a real addon
hits:

1. The Buffer family: `napi_get_buffer_info`, `napi_create_buffer`,
   `napi_create_buffer_copy`, `napi_create_external_buffer`. Any addon moving
   bytes is dead.
2. `napi_get_and_clear_last_exception`, `napi_fatal_exception` — errors vanish
   instead of propagating.
3. `napi_create_bigint_words` and the three `napi_get_value_bigint_*`.
   `bigint.milo` already exists, so this is wiring, not new work.
4. `napi_coerce_to_object`, `napi_add_env_cleanup_hook`, `napi_fatal_error`.

Already real: `napi_define_class`, `napi_wrap`/`unwrap`, references, promises and
deferreds, synchronous calls back into JavaScript, and the full
threadsafe-function set. Node-API handles are collector roots, including while a
native callback re-enters JavaScript.
