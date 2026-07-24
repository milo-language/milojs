# milojs backlog

Work items carried over from the milo repo's backlog when milojs moved to its own repo.

## milojs: Array change-by-copy methods (ES2023) — gap, and why the easy fix fails

`with`, `toReversed`, `toSorted`, `toSpliced` are missing. Found by the QuickJS
sweep (`with is not a function`, 3 cases).

They cannot be added to `lib/engine-prelude.js`. Array methods are natives
dispatched by a **name whitelist** in `eval.milo` (`isArrayMethod`, ~line 6349),
and member lookup on an array never falls back to `Array.prototype` — so
`Array.prototype.with = ...` in the prelude is unreachable dead code. I wrote
that version, watched it have no effect, and backed it out.

Adding them means implementing natively: extend the whitelist and add the cases
alongside `findLast`/`findLastIndex`. Each is pure array shuffling; the only
subtlety is spec index handling — a negative index counts from the end, and a
fractional or out-of-range index throws `RangeError` rather than clamping.

Worth noting for anything else "missing" from the sweep: check whether the
method is prototype-dispatched or whitelisted before assuming the prelude is the
place to put it.

### Not gaps, despite the sweep's wording

`concat`, `sort`, `apply`, `toString`, `escape` all work on ordinary receivers —
those sweep failures are on unusual receivers (typed arrays and similar), not
missing methods. Probe before implementing.

### Math.fround stays out

The existing exclusion comment in the prelude is correct and should not be
"fixed": rounding to f32 needs a bit-level reinterpret the engine has no
primitive for. The usual JS workaround, `new Float32Array([x])[0]`, is not
available either — `Float32Array` is not implemented.

## milojs: built-in constructors have no real `.prototype`, so `.constructor` is missing

Probed against node:

| expression | node | milojs |
|---|---|---|
| `new C().constructor === C` (user class) | true | **true** |
| `({}).constructor === Object` | true | false |
| `[].constructor === Array` | true | false |
| `Object.getPrototypeOf(new TypeError("x")) === TypeError.prototype` | true | false |
| `typeof TypeError.prototype.constructor` | `"function"` | throws — `TypeError.prototype` is `undefined` |

The last row is the root cause. Built-in constructors are natives with no
prototype object behind them, so there is nothing to hold a `constructor`
property and nothing for `getPrototypeOf` to return. User-defined classes work
because class construction sets `constructor` itself.

Found while writing the ES2023 array fixture: `catch (e) { e.constructor.name }`
throws here, and the fixture had to use `e.name` instead. `err.constructor ===
TypeError` is a common branch in library code, so this is app-relevant and not
only a conformance detail — it is a plausible cause of a library taking a wrong
error path rather than failing loudly.

Not a one-liner: it means giving Object/Array/Error and the Error subtypes real
prototype objects wired to their natives, which touches construction, the
prototype chain and `instanceof`. Worth doing as its own slice with the app
smoke test, not folded into an unrelated change.

Related: several QuickJS sweep failures reported as `X is not a function` are
methods called on unusual receivers rather than missing methods (see the
change-by-copy note above). Probe before implementing.

