<!-- doc-meta
system: milojs
purpose: active work plan for improving the QuickJS-suite score without confusing historical gaps with current code
key-files: scripts/quickjs-sweep.ts, src/engine/parser.milo, src/engine/eval.milo, src/engine/runtime.milo, src/engine/methods.milo, src/engine/bootstrap.milo, lib/engine-prelude.js, src/milojs-engine.milo
update-when: the sweep is rerun, a failure bucket changes, or a lane lands
last-verified: 2026-09-22 (re-verified after the Date dispatch commit: Interp.dateProtoPristine guards the direct call as arrayProtoPristine does, getMember no longer synthesises a bound method per date read, Date.prototype[@@toPrimitive] runs OrdinaryToPrimitive through the receiver, toJSON is generic under the internal name __dateToJSON, and the toPrimitive helpers lose their isDate shortcuts. Previous note: re-verified after WeakMap/WeakSet became their own natives: Builtin.WeakMap/WeakSet with BRAND_WEAKMAP/BRAND_WEAKSET, entries in the Map side table under JSObjExtra.weakKind (not isMap/isSet), the prelude class is gone, and buildNativeProto installs constructor first to match node's property order. Previous note: re-verified after the symbol primitive commit: JSValue gains Sym(id), symbols live in Interp.symDescs/symHasDesc/symRegistered plus a Symbol.for registry, well-known symbols are fixed ids WK_* registered first, and a symbol property key is spelled only by symKey/symIdOfKey (0xFF then the decimal id), so no string can collide with one; Symbol.for/keyFor are natives. Previous note: re-verified after the closure function-object commit: JSValue.Func carries a third field, an index of a real JSObj that is the closure's identity and its property bag, minted only by makeClosure; Interp.funcProtos, Interp.funcStatics and Scope.fnStatKeys/fnStatVals are gone, `.prototype` is an ordinary own property of that object, and JSObj.ctor is replaced by fnIdx/fnEnv; the §2 dispatch table is unchanged. Previous note: re-verified after the scoped-temp-root commit: evalArgs leaves its roots pushed and callMember/evalCall/evalNewArm/callOptional truncate st.tempRoots back to their entry depth; the eval scope is pushActive while it runs; slice and splice root their result across proxy traps; tools/gc-stress.sh gates it. §2 dispatch table unchanged; concat now spreads a proxy of an array (IsArray sees through the proxy). Previous note: re-verified after the class heritage commit f035b8d (ClassDef.superExpr: any LeftHandSideExpression is evaluated once at class creation, a non-constructor heritage is a TypeError, extends null gives a null-prototype C.prototype) and c8c0c78 (__jsonStringifyFast registered as an engine intrinsic); nothing this doc describes changes. Previous note: re-verified after a91f36c (every imported name listed explicitly for the current milo compiler) and 7b2b447 (ToNumber of a symbol throws at every coerced argument); import lists and coercion helpers, nothing this doc describes changes. Previous note: re-verified after top-level `this` and global-descriptor commit (unbound this answers the global object, CommonJS binds this to exports, markBuiltinGlobals fixes the builtin/var boundary for globalThis descriptors) and the JSON.stringify fast path; nothing this doc describes changes. Previous note: re-verified after the property-descriptor commit: ValidateAndApplyPropertyDescriptor now rejects a changed get/set on a non-configurable accessor, and the three define entry points share ObjectDefineProperties; the §2 dispatch table is unchanged. Previous note: re-verified after the host-std import ratchet: the only source change is eval.milo losing an unused std/fetch import that host.milo now declares itself; nothing this doc describes changes. Previous note: re-verified after the throwErr unification and the isJsSpace/isJsWs removal: every throwing/thrownValue/return-undefined triple in eval.milo now spells return throwErr(...), a textual substitution; nothing this doc describes changes. Previous note: re-verified after Map/Set prototype dispatch landed: the §2 table rows and prose for Map/Set are updated in this same edit; RegExp, Date, DataView and typed-array rows are unchanged. Previous note: re-verified after the timer unref and mkdir errno commits: host-side timer ref state and an fs builtin, outside the language surface this plan compares against QuickJS. Previous note: re-verified after the explicit &mut call-argument migration: every bare argument bound to a &mut parameter now reads '&mut x', a spelling change only; no behaviour this doc describes changes. Previous note: re-verified after mode B: sweeps held per case. Previous note: re-verified after the outer-slot flush fix: both sweeps held per case again. Previous note: re-verified after the literals-and-operators batch: both sweeps held exactly per case; the differential matrix caught the loose-eq coercion drift before any suite did. Previous note: re-verified after Op.CallMember: the quickjs sweep held 104/149 per case, and the differential matrix gained method-call shapes. Previous note: re-verified after the raw-f64 lane: quickjs-suite behavior is unchanged (the lane only runs where the boxed path computed the same numbers faster). Previous note: re-verified after the vm-audit flag in milojs-engine.milo: audit parses and compiles without executing, which touches no quickjs-suite behavior this doc plans against. Previous note: re-verified for the per-case pass list in the report; the plan reads buckets, which are unchanged. Previous note: re-checked against the per-OS interpreter stack: the native-stack budget this doc describes is unchanged in mechanism, only its size moved, and bug776's catchable RangeError still holds on both sizes)
-->

# milojs QuickJS-parity plan

Last measured: **<!--fact:qjs-pass-->104<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> cases
(<!--fact:qjs-pct-->69.8%<!--/fact-->)** against QuickJS `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->`,
from `docs/conformance/quickjs.json` — the committed report, not a number typed here. 58 files,
nine host-facility files skip-listed, `<!--fact:qjs-parsefail-->0<!--/fact-->` parse gaps.

**On the denominator, which has moved twice.** An earlier version of this file led with
"96/166 cases (57.8%) on 2026-07-30 against `fced162932e36eb3b2889bd30c8f127a2bf8cf34`", and
argued at length that the drop from a previous 93/149 was honest because the corpus had grown by
17 scored cases. That paragraph is deleted rather than reconciled, for a reason worth writing
down: **`fced1629` is not a commit in the QuickJS repository this checkout tracks** (`git
cat-file -t` cannot resolve it), so 96/166 cannot be reproduced by anyone, including whoever ran
it. A score whose corpus revision does not resolve is not evidence, and the argument built on top
of it was defending a denominator that no run can produce again.

The number above is reproducible: it names a revision that exists, it is compiled by
`tools/gen-facts.mjs` out of a report that records the milojs commit it was measured at, and
re-running the sweep either agrees with it or fails the gate. If the denominator moves again,
that is what has to move it.

That number is a development signal, not a compatibility claim. The QuickJS
suite mixes ECMAScript behavior with QuickJS host facilities, and the corpus is
not vendored. `docs/status.md` defines the product gates; this file defines the
measurement loop and the next engine lanes.

## Run the sweep

The suite expects a QuickJS checkout at `~/git/quickjs/tests` unless
`QUICKJS_TESTS` points elsewhere.

```bash
milo build src/milojs-engine.milo -o /tmp/milojs-engine
MILOJS_ENGINE=/tmp/milojs-engine bun scripts/quickjs-sweep.ts
MILOJS_ENGINE=/tmp/milojs-engine bun scripts/quickjs-sweep.ts -v
MILOJS_ENGINE=/tmp/milojs-engine bun scripts/quickjs-sweep.ts -f loop
```

The harness splits each upstream file by its trailing test calls and runs each
case independently. Files that exercise `qjs:std`, `qjs:os`, workers, or bjson
are host tests and remain explicitly skip-listed; do not count them as language
passes or silently delete them.

## What has landed

The current engine includes the major lanes that older versions of this plan
listed as missing:

- ESM import/export lowering over the CommonJS preload graph.
- Generator syntax and runtime generator execution.
- Arbitrary-precision BigInt literals, construction, arithmetic, comparison,
  shifts, and bitwise operations.
- Iterator protocol and iterator helpers, including array and Map/Set iterators.
- Proxy and Reflect.
- ArrayBuffer, DataView, resizable buffers, integer and floating typed arrays.
- Regex callbacks and splitting, lookahead/lookbehind, backreferences, and
  dot-all mode.
- Real sparse-array hole tracking.
- Object freeze/seal/preventExtensions behavior and common modern builtins.

Do not reopen one of these as a feature-sized lane from an old failure message.
First reduce a current failing case and identify the narrower semantic bug.

## Active lanes

### 1. Rebaseline and classify — done

Re-derived from `docs/conformance/quickjs.json` rather than from the deleted 2026-07-30 run,
and the numbers below are compiled from it so they cannot drift again:
**<!--fact:qjs-fail-->45<!--/fact--> failures in <!--fact:qjs-buckets-->17<!--/fact--> buckets**, of
which <!--fact:qjs-bucket-singles-->14<!--/fact--> are a single case each. Parse gaps:
`<!--fact:qjs-parsefail-->0<!--/fact-->`. Not wrong answers at all:
<!--fact:qjs-crashes-->2<!--/fact--> cases die on a signal (SIGTERM, i.e. the harness timeout), and
they are budgeted in `docs/conformance/defect-budget.json` rather than averaged into the failure
count.

The shape of that is the finding. The largest bucket is <!--fact:qjs-bucket-top-->24<!--/fact-->
cases whose reason string is `assertion failed: got |…|, expected |…|` — that is not one bug, it
is the harness saying it cannot tell them apart, because the values are elided. Ranking work by
bucket size would put it first and learn nothing. Reduce individual cases; the buckets are an
index, not a priority order. The verbose report is retained as review evidence outside Git per
`docs/conformance-reports.md`.

Recursive `Function.prototype.call`/`apply` now charges its adapter frame to the
native-stack budget. That changed `bug776.js` from a process `SIGSEGV` to its
expected catchable `RangeError`. Three cases were timing out. Large sparse array
lengths now remain implicit rather than materializing billions of holes, which
removed the `bug1468.js` timeout. The two remaining timeouts still need
reductions that distinguish engine loops from legitimate slow paths.

### 2. Real builtin prototype dispatch

Array, String, the Error family, Map/Set (2026-09-20), WeakMap/WeakSet and Date
(2026-09-22) dispatch through real prototype objects. RegExp, DataView, and typed arrays still have
whitelist-dispatched methods in parts of the property/call path. This causes overrides, extraction, identity,
and inheritance to disagree with JavaScript even when direct calls work.

**Measured 2026-08-19, because "still whitelist-dispatched" is vaguer than it needs to be.**
Assigning over the prototype method and calling it on an instance:

| receiver | `Object.getOwnPropertyNames(proto)` has the method | override honoured |
|---|---|---|
| `Map.prototype.has` | yes | yes (2026-09-20: `mapSetOverride` deopts the fast path; reads take the chain) |
| `Set.prototype.has` | yes | yes (same commit) |
| `WeakMap.prototype.get` | yes | yes (2026-09-22: its own native; no fast path at all, calls take the chain) |
| `WeakSet.prototype.has` | yes | yes (same commit) |
| `RegExp.prototype.test` | yes | **no** |
| `Date.prototype.getTime` | yes | yes (2026-09-22: `dateProtoPristine`, the Array guard; reads take the chain) |
| `DataView.prototype.getInt8` | yes | **no** |
| `Uint8Array.prototype.at` | **no** | no |

WeakMap and WeakSet were a prelude class wrapping a Map in an own `_m` property, so a patched
`Map.prototype.get` changed `WeakMap#get` and `Object.keys(wm)` answered `["_m"]`. They are now
`Builtin.WeakMap`/`WeakSet` with their own brand, keeping entries in the Map side table under
`JSObjExtra.weakKind`, which no `isMap` site sees. They take no guarded fast path: nothing in
callMember names them, so a call reads the method off the real chain and the brand check in
the bound-method call is the whole dispatch. Weak collection is not implemented (see
`docs/backlog.md`).

Date takes the Array pattern rather than the Map/Set one, because Date.prototype carries 47
methods and a per-call chain walk would end in a linear scan of them: `Interp.dateProtoPristine`
clears on any write to Date.prototype, and while it holds, callMember sends a date whose proto
is Date.prototype and which has no own property of that name straight to the native. The
per-read bound method is gone, so `d.getTime === Date.prototype.getTime`. The coupled methods
follow the spec's lookups too: `@@toPrimitive` runs OrdinaryToPrimitive through the receiver's
`valueOf`/`toString` (so an override changes `d - 0`) and is generic over objects; `toJSON` is
generic and calls `this.toISOString()`; `toGMTString` is the same function as `toUTCString`.

So the prototype OBJECT exists and is populated for five of the six original rows; for the three still
marked **no** what does not happen is consulting it. The property is there to be read and the dispatch ignores it, which is the worst
of the three possible states — `Object.getOwnPropertyNames` and a direct call both agree with
node, so nothing looks wrong until someone overrides. Note this is narrower than
`docs/status.md` gate 2's "every constructor has a real prototype", which is true as written and
reads as more finished than it is.

Take one receiver family per commit. Preserve the Array pattern: a guarded fast
path is valid only while the real prototype is pristine; writes permanently
deopt to ordinary prototype lookup. Map/Set took the `typedArrayOverride`
shape instead (`mapSetOverride` in methods.milo: a per-call chain walk from the
receiver to the builtin prototype, plus a pristine check on the builtin's own
entry), and dropped the per-read bound-method synthesis entirely since
`buildNativeProto` already stores every method: `m.get === Map.prototype.get`
holds and an unbound `m.get` call is the spec's TypeError. `super.m()` on a
native base resolves through the constructor's `prototype` property, and
`class X extends Map` fills its entries through `this.set` so an override on
`X.prototype` sees them (`mapSetFill` in eval.milo). Lock reads, calls, extracted methods,
overrides, computed access, and `Object.create(Prototype)` behavior.

String is first because it is common in real programs and its methods still span
primitive-receiver and prototype-dispatch paths.

### 3. Typed-array method semantics

Typed arrays have storage, constructors, indexing, views, and DataView codecs,
but their prototype method surface is incomplete. Implement current sweep
failures in clusters that share iteration/conversion rules rather than adding
names individually. Include detached-buffer, offset, clamping, float, and
species-sensitive cases where the suite reaches them.

### 4. RegExp and string integration

Reduce remaining cases around named capture groups, `groups`, `matchAll`,
Unicode behavior, replacement expansion, and zero-width iteration. The regex VM
is its own subsystem; lock each bug with a small differential fixture before
changing the upstream score.

### 5. Language semantics that need architecture

**Both items this lane listed have been built. Verified 2026-08-19 under `milojs-engine`:**

- Direct `eval` said it "cannot append parsed code while the evaluator holds an immutable
  `Prog`; it needs an explicit design rather than a builtin shim." It works: `eval("x+1")` reads
  a surrounding `let`, `eval("function ff(){...}")` declares a function the caller can then call,
  `eval("var zz = 9")` leaks `zz` into the enclosing scope, `eval("(() => n * 6)")` closes over a
  local, and `eval("eval('1+2')")` nests. What is left is narrower: `typeof this` inside
  `eval("'use strict'; ...")` answers `undefined` where node answers `object`, and the QuickJS
  corpus still fails `test_builtin.js:test_eval` and one `SyntaxError: Unexpected token in eval`.
  Those are cases, not architecture.
- Engine-side generators wanted "either activation support independent of the runtime or a
  documented engine capability boundary." The engine runs the program on a green task, so
  generators work on both binaries — see `docs/milojs-generators.md`.

**The one genuine architecture item left in this lane is a CONFLICT, not a gap.** This lane
wanted `Prog` mutable enough for direct `eval`; `docs/milojs-arena-safety.md` is building a
`BuildingProg -> FrozenProg` phase boundary with compile-fail fixtures for mutation through
`FrozenProg`. Both are listed as active work, neither cites the other, and whichever lands first
silently decides the other. Settle that before either one moves.

## Scoreboard discipline

For every lane:

1. Reduce the upstream failure to a local fixture.
2. Capture `.expected` from Node, never from MiloJS.
3. Implement the semantic fix.
4. Run both binaries' fixture suites and Milo invariant fixtures.
5. Run the complete QuickJS sweep, not only the selected file.
6. Update the score and failure buckets here and in `docs/status.md`.

The score may move down when the harness becomes more honest. Explain such a
change; never preserve a number with a skip or stub that reports false success.
