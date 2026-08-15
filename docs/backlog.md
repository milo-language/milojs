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
| test262, 1500-case deterministic sample | 539/1470 = **36.7%** | 2026-08-15 |
| QuickJS `tests/` at `fced162` | 97/149 = **65.1%** | 2026-08-15 |

Movement on 2026-08-15: the engine now runs the program on a green task, so
generators work there (they threw "generators require the milojs runtime"
before). test262 508→539 (34.6%→36.7%) and QuickJS 95→97 (63.8%→65.1%). Only
31 of the 104 generator-blocked cases converted; the rest need `gen.throw()` /
`gen.return()` and async generators, none of which exist yet.

Denominators move between runs as cases start or stop being scored — compare
the numerator and the fraction from the same table row, not across rows. The
`96/166` and `473/1476` rows this replaced were 2026-07-24/30 measurements.

Weakest areas: `built-ins/TypedArray` 0%, `ArrayBuffer` 0%, `Atomics` 0%,
`language/eval-code` 0%, `Temporal` 1%, `TypedArrayConstructors` 5%, `Map` 14%.
Strongest: `language/block-scope` 100%, `literals` 77%, `identifiers` 75%.

### Open, in rough value order

- **`gen.throw()` / `gen.return()`** are not implemented at all — `g.throw(e)`
  returns undefined and the caller traps reading `.value`. `throw` is the easy
  half (set `st.throwing` at the resume point in `genYield`); `return` has to
  unwind the body through its `finally` blocks, which the Flow machinery does
  not currently express across a park.
- **Async generators.** `async *m() {}` produces an object with no `next`, in
  both object literals and classes, and `for await (... of ...)` does not parse.
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
2. **`TypedArray.prototype.subarray` returns an empty view.** `a.subarray(1)` has
   length 0, so `join`/spread over it are empty. `slice` is correct.
3. `[1, , 3].flat()` keeps the hole (length 3, node gives 2).
4. `"ß".toUpperCase()` answers `"ß"`; the special casing to `"SS"` is missing.

## Smaller known gaps

- `console.log` quotes strings inside an inspected array/object with `"`, where
  node uses `'`. Cosmetic, but it means any fixture printing a nested string is
  locked to milojs's spelling rather than node's.
- `Object.groupBy` / `Map.groupBy` (ES2024) are missing.

- Generators are runtime-only: `function*` throws
  `generators require the milojs runtime (not the engine)` under
  `milojs-engine`, costing 42 test262 and 3 QuickJS cases. The runtime handles
  them, so this is engine/runtime factoring, not a missing feature.
- A template literal desugars to `"" + x`, so its holes convert with the DEFAULT
  ToPrimitive hint rather than the string hint the spec requires. Observable only
  for an object with both `valueOf` and `toString`: `` `${x}` `` answers valueOf
  where node answers toString. `String(x)` and `join` take the string hint
  correctly. Fixing it needs a template-concat node rather than a chain of `+`.

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
