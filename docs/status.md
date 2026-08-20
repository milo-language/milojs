<!-- doc-meta
system: status
purpose: current conformance numbers, product gate state, and what is next
key-files: docs/conformance/node-compat.json, docs/node-compat.md, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts, scripts/node-compat-sweep.ts
update-when: a sweep is rerun or a product gate changes state
last-verified: 2026-08-19
-->

# milojs status

Numbers are compiled from `docs/conformance/*.json` by `tools/gen-facts.mjs`.
Open gaps are listed in [docs/backlog.md](backlog.md); per-module detail in
[docs/node-compat.md](node-compat.md).

## Conformance

| suite | measures | score |
|---|---|---:|
| test262 (<!--fact:t262-sample-->1500<!--/fact-->-case deterministic sample, seed `<!--fact:t262-seed-->0x2f6e2b1<!--/fact-->`) | engine | **<!--fact:t262-pct-->79.5%<!--/fact-->** <!--fact:t262-pass-->1169<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> |
| QuickJS `tests/` | engine | **<!--fact:qjs-pct-->69.8%<!--/fact-->** <!--fact:qjs-pass-->104<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> |
| Node `test/parallel` | runtime | **<!--fact:node-pct-all-->23.4%<!--/fact-->** <!--fact:node-pass-->790<!--/fact-->/<!--fact:node-total-->3373<!--/fact--> |
| Node `test/parallel` | peer: <!--fact:node-peer-name-->bun 1.3.10<!--/fact--> | **<!--fact:node-peer-pct-all-->40.8%<!--/fact-->** <!--fact:node-peer-pass-->1377<!--/fact-->/<!--fact:node-peer-total-->3373<!--/fact--> |

Corpora: test262 `<!--fact:t262-corpus-->b363f29d<!--/fact-->`, quickjs `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->`.

Node denominator is EVERY selected case. <!--fact:node-skipped-->936<!--/fact--> of <!--fact:node-available-->3373<!--/fact--> call
`common.skip()`, <!--fact:node-excluded-->606<!--/fact--> more are node-internal and excluded. Most skips read
`missing crypto`, and they stay in the denominator on purpose: scoring against
what ran forgives whatever the runtime cannot attempt, so landing crypto would
turn 606 silent skips into loud failures and the headline would FALL while the
runtime got strictly better. Against what ran it is <!--fact:node-pct-->32.4%<!--/fact-->
(<!--fact:node-pass-->790<!--/fact-->/<!--fact:node-ran-->2437<!--/fact-->); that form is for tracking milojs against itself,
never against another engine, which skips a different amount.

Parse gaps: <!--fact:t262-parsefail-->23<!--/fact--> of <!--fact:t262-fail-->301<!--/fact--> test262 failures (<!--fact:t262-parsefail-pct-->7.6%<!--/fact-->) are syntax; the rest are
semantics. QuickJS parse gaps: <!--fact:qjs-parsefail-->0<!--/fact-->.

### test262 failures by area

<!--fact-block:t262-areas-->
| area | failing | passing |
|---|---:|---:|
| `language/expressions` | 47 | 287/334 |
| `language/statements` | 40 | 242/282 |
| `built-ins/Object` | 32 | 95/127 |
| `built-ins/Array` | 22 | 69/91 |
| `built-ins/RegExp` | 19 | 54/73 |
| `built-ins/Temporal` | 18 | 113/131 |
| `built-ins/String` | 11 | 28/39 |
| `built-ins/TypedArray` | 9 | 29/38 |
<!--/fact-block-->

### Node compatibility by module

**[docs/node-compat.md](node-compat.md)**: generated, one row per module,
banded on that module's node test pass rate, with the export diff beside it as
the worklist. <!--fact:node-modules-shimmed-->52<!--/fact--> modules shimmed. The totals live there
rather than here so there is one copy of them.

## Fixtures

| set | count |
|---|---:|
| engine (`tests/*.js`) | <!--fact:fixtures-engine-->269<!--/fact--> |
| runtime (`tests/runtime/*.js`) | <!--fact:fixtures-runtime-->59<!--/fact--> |
| Milo invariants | <!--fact:fixtures-milo-->3<!--/fact--> + <!--fact:fixtures-milo-errors-->8<!--/fact--> |
| node-oracle exemptions | <!--fact:fixtures-node-exempt-->7<!--/fact--> |

All are byte-exact differential output against node. Fixture counts are not
conformance percentages.

## Size

<!--fact:loc-milo-->47.9k<!--/fact--> lines of Milo, <!--fact:loc-js-->17.1k<!--/fact--> of JavaScript, <!--fact:loc-total-->65.0k<!--/fact--> total. No V8,
JavaScriptCore, or C JavaScript engine underneath. Layering: <!--fact:layering-exempt-edges-->4<!--/fact--> registered
engine to runtime edges, <!--fact:layering-host-globals-->0<!--/fact--> host natives in the engine bootstrap.
Node-API entry points: <!--fact:napi-entry-points-->84<!--/fact-->, ten of them stubs.

## Known engine limits

Each carries a probe id re-checked by `tools/check-gaps.mjs`; closing one makes
that gate fail until the bullet is deleted.

- `Float16Array` is absent. <!--gap:float16-->
- `BigInt64Array`/`BigUint64Array` have no `from`/`of`. <!--gap:bigint64-from-->
- `toLocale*` is en-US only and ignores its arguments; no `Intl`. <!--gap:intl-->
- `@@match`/`@@replace`/`@@split` delegate to the String methods, the reverse of
  the spec's direction; a RegExp subclass overriding one is not consulted.
  <!--gap:regexp-symbols-->

## Known runtime limits

- `next()` on an async generator drives the body instead of scheduling it.
  Values always match node; interleaving differs, and it deadlocks when a caller
  invokes `next()` without awaiting and the body then awaits. QuickJS
  `bug1355.js` is this shape. A queue fix was tried and reverted; see the
  backlog.
- `ClientRequest.prototype.setTimeout` is a no-op, so no `timeout` event ever
  fires on a client request.
- `require()` of a computed specifier resolves against the preloaded graph only,
  so a specifier that appears nowhere as a literal is not found.
- No `worker_threads.Worker`, no TLS serving, no `Intl`, no `crypto` beyond 7 of
  69 exports.

## Product gates

| gate | state |
|---|---|
| 0, green and measurable | **RED**. `linux-arm64` release job aborts on the runtime smoke test with `free(): invalid pointer`, exit 134, since `0f167c5`. Engine binary clean. Rolling tarballs stuck at 2026-08-15. |
| 1, embeddable engine preview | partial. C ABI builds, handles survive forced GC, no native-function registration. Reports are now pinned and committed. |
| 2, credible QuickJS alternative | partial. Every constructor has a real prototype; raw arena indices remain. |
| 3, Node runtime preview | partial. A real express 4 app boots and serves byte-identical output. See `docs/node-compat.md` for the surface. |
| 4, performance architecture | decided and underway. Bytecode VM owns its call frames; recursion depth 2156 to 10000. Tree walker stays as fallback and differential oracle. |

## Next

1. Restore Gate 0: the `linux-arm64` runtime abort, and a linux-arm64 runner in
   Milo's own CI.
2. `crypto`. It is 688 of the 930 node skips, the largest single unlock in the
   suite.
3. `http` (71/371) and `fs` (80/219), the two largest scored areas.
4. Temporal, the largest addressable test262 bucket.
5. Make the async-generator body's runnability explicit, then retry the request
   queue. It is the only known hang.
