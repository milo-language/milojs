<!-- doc-meta
system: milojs
purpose: active work plan for improving the QuickJS-suite score without confusing historical gaps with current code
key-files: scripts/quickjs-sweep.ts, src/engine/parser.milo, src/engine/eval.milo, src/engine/runtime.milo, lib/engine-prelude.js, src/milojs-engine.milo
update-when: the sweep is rerun, a failure bucket changes, or a lane lands
last-verified: 2026-08-26 (re-verified for the per-case pass list in the report; the plan reads buckets, which are unchanged. Previous note: re-checked against the per-OS interpreter stack: the native-stack budget this doc describes is unchanged in mechanism, only its size moved, and bug776's catchable RangeError still holds on both sizes)
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

Array, String, and the Error family now use real prototype objects. Map/Set,
RegExp, Date, DataView, and typed arrays still have whitelist-dispatched methods
in parts of the property/call path. This causes overrides, extraction, identity,
and inheritance to disagree with JavaScript even when direct calls work.

**Measured 2026-08-19, because "still whitelist-dispatched" is vaguer than it needs to be.**
Assigning over the prototype method and calling it on an instance:

| receiver | `Object.getOwnPropertyNames(proto)` has the method | override honoured |
|---|---|---|
| `Map.prototype.has` | yes | **no** |
| `Set.prototype.has` | yes | **no** |
| `RegExp.prototype.test` | yes | **no** |
| `Date.prototype.getTime` | yes | **no** |
| `DataView.prototype.getInt8` | yes | **no** |
| `Uint8Array.prototype.at` | **no** | no |

So the prototype OBJECT exists and is populated for five of the six; what does not happen is
consulting it. The property is there to be read and the dispatch ignores it, which is the worst
of the three possible states — `Object.getOwnPropertyNames` and a direct call both agree with
node, so nothing looks wrong until someone overrides. Note this is narrower than
`docs/status.md` gate 2's "every constructor has a real prototype", which is true as written and
reads as more finished than it is.

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
