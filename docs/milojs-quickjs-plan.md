<!-- doc-meta
system: milojs
purpose: active work plan for improving the QuickJS-suite score without confusing historical gaps with current code
key-files: scripts/quickjs-sweep.ts, src/engine/parser.milo, src/engine/eval.milo, src/engine/runtime.milo, lib/engine-prelude.js
update-when: the sweep is rerun, a failure bucket changes, or a lane lands
last-verified: 2026-07-30
-->

# milojs QuickJS-parity plan

Last measured: **96/166 cases (57.8%)** on 2026-07-30 against QuickJS
`fced162932e36eb3b2889bd30c8f127a2bf8cf34`.

The previous 93/149 (62.4%) result used an older, smaller corpus. The passing
count increased by three while the corpus added 17 scored cases, so the lower
percentage is not an engine regression.

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

The 2026-07-30 full sweep reports 70 failures. Exact repeated buckets account
for 47: 27 assertion mismatches, 4 undefined-property reads, 4 engine/runtime
generator-factor cases, 3 missing `concat` dispatches, 3 calls of a non-function
value, 2 missing `BigInt64Array` cases, 2 module-fixture `exports` failures, and
2 timeouts. The remaining 23 are distinct one-case buckets spanning
parser/evaluator semantics and missing or divergent builtins. The verbose report
is retained as review evidence outside Git per `docs/conformance-reports.md`.

Recursive `Function.prototype.call`/`apply` now charges its adapter frame to the
native-stack budget. That changed `bug776.js` from a process `SIGSEGV` to its
expected catchable `RangeError`. Three cases were timing out. Large sparse array
lengths now remain implicit rather than materializing billions of holes, which
removed the `bug1468.js` timeout. The two remaining timeouts still need
reductions that distinguish engine loops from legitimate slow paths.

### 2. Real builtin prototype dispatch

Array, String, and the Error family now use real prototype objects. Map/Set,
RegExp, Date, DataView, and typed arrays still have whitelist-dispatched methods
in parts of the property/call path. This causes overrides, extraction, identity,
and inheritance to disagree with JavaScript even when direct calls work.

Take one receiver family per commit. Preserve the Array pattern: a guarded fast
path is valid only while the real prototype is pristine; writes permanently
deopt to ordinary prototype lookup. Lock reads, calls, extracted methods,
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

Direct `eval` cannot append parsed code while the evaluator holds an immutable
`Prog`; it needs an explicit design rather than a builtin shim. Engine-side
generators similarly need either activation support independent of the runtime or
a documented engine capability boundary. Keep these visible, but do not distort
the evaluator for a small score increase.

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
