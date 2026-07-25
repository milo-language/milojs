# milojs backlog

Work items carried over from the milo repo's backlog when milojs moved to its own
repo, re-verified against the engine on 2026-07-24.

## Measured conformance (2026-07-24)

Both sweeps need a local corpus (`TEST262=`, `~/git/quickjs/tests`), so these are
run by hand rather than in CI:

| sweep | score |
|---|---|
| test262, 1500-case deterministic sample | 470/1476 = **31.8%** |
| QuickJS `tests/` | 93/149 = **62.4%** |

Weakest areas: `built-ins/TypedArray` 0%, `ArrayBuffer` 0%, `Atomics` 0%,
`language/eval-code` 0%, `Temporal` 1%, `TypedArrayConstructors` 5%, `Map` 14%.
Strongest: `language/block-scope` 100%, `literals` 77%, `identifiers` 75%.

Stage 6 of the roadmap calls for a checked-in `test262-status.md` so the trend is
visible. It does not exist yet — this table is the stopgap.

## The dispatch model is the structural debt — fix before the bytecode VM

Built-in methods are **not** real properties on real prototype objects. They are
dispatched by a name whitelist (`isArrayMethod` in `eval.milo`, a 37-way string
compare) checked at four gated sites on the property-access path, and
`Array.prototype` is a hand-populated object of bound-method stubs.

Everything below is a symptom of that one design:

- `Error.prototype` and every subtype's `.prototype` are `undefined` (see below).
- A method cannot be added from `lib/engine-prelude.js`, because member lookup on
  an array never falls back to `Array.prototype` — prelude assignments there are
  unreachable dead code.
- Array methods needed a copy-in adapter to work on array-like receivers rather
  than simply being generic (see below).

Fixing it means: real prototype objects for `Object`/`Array`/`Function`/`String`/
`Number`/`Boolean` and the Error family, populated with real native-fn
properties; the four gated sites collapse into ordinary `getMemberDyn`; the
whitelist goes away. `st.arrayProtoObj` and `st.objectProtoObj` already exist, so
the singleton pattern is established.

**Do this before Stage 4.** A bytecode VM built on the whitelist inherits it
permanently.

Risk to respect: those sites are hot, and `makeBoundMethod`'s late-binding is
load-bearing — capturing `Promise.resolve` as a value re-entered itself forever
without it (see the comment at the `__promiseResolveValue` definition). Worth its
own slice with the full fixture suite as the guard.

## milojs: built-in constructors' `.prototype` — mostly fixed, Error family still open

Re-probed against node. Most of this entry is now stale:

| expression | node | milojs |
|---|---|---|
| `new C().constructor === C` (user class) | true | **true** |
| `({}).constructor === Object` | true | **true** |
| `[].constructor === Array` | true | **true** |
| `Object.getPrototypeOf([]) === Array.prototype` | true | **true** |
| `e.constructor === TypeError` in a `catch` | true | **true** |
| `typeof TypeError.prototype` | `"object"` | **`"undefined"`** |
| `typeof Error.prototype` | `"object"` | **`"undefined"`** |

Only the Error family is left: those constructors are still natives with no
prototype object behind them, so `TypeError.prototype.x` throws. test262 reaches
for `<Ctor>.prototype` constantly, so this feeds a large share of the
`cannot read property '…' of undefined` bucket — the single biggest one in the
sweep. Folds naturally into the dispatch-model work above.

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

- `thisArg` — the optional 2nd argument to `map`/`filter`/`forEach`/`some`/
  `every`/`find` is ignored outright; callbacks always run with
  `this === undefined`. Cheap to fix, test262 checks it.
- Generators are runtime-only: `function*` throws
  `generators require the milojs runtime (not the engine)` under
  `milojs-engine`, costing 42 test262 and 3 QuickJS cases. The runtime handles
  them, so this is engine/runtime factoring, not a missing feature.
- `milojs-engine.milo:207` calls `embedFile(...)` where the compiler expects
  `@embedFile` — a warning on every build of both binaries.

## Node-API: 14 of 64 entry points are stubs

`napi.milo` marks them honestly in-source (they exist only so `dlopen`, which
resolves eagerly, does not fail the whole module). Each returns `napi_ok` without
doing anything, which is a lie an addon can act on. Ranked by what a real addon
hits:

1. `napi_call_function` — an addon calling back into JS gets silence. Highest
   impact by far.
2. The Buffer family: `napi_get_buffer_info`, `napi_create_buffer`,
   `napi_create_buffer_copy`, `napi_create_external_buffer`. Any addon moving
   bytes is dead.
3. `napi_get_and_clear_last_exception`, `napi_fatal_exception` — errors vanish
   instead of propagating.
4. `napi_create_bigint_words` and the three `napi_get_value_bigint_*`.
   `bigint.milo` already exists, so this is wiring, not new work.
5. `napi_coerce_to_object`, `napi_add_env_cleanup_hook`, `napi_fatal_error`.

Already real: `napi_define_class`, `napi_wrap`/`unwrap`, references, promises and
deferreds, and the full threadsafe-function set.
