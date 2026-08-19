<!-- doc-meta
system: status
purpose: canonical current capability, evidence, and next-milestone dashboard for milojs
key-files: src/milojs-engine.milo, src/milojs.milo, tests/run.sh, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: a product gate lands, a conformance sweep is rerun, or the supported host surface changes
last-verified: 2026-08-18 (native id enum, node-compat sweep, and the socket read that was freezing the event loop) (property escapes, numeric regex escapes, runtime strict mode, null prototypes, iterator helpers on generators; the failing-area table re-measured)
-->

# milojs status

This is the canonical current-state dashboard. The roadmap preserves design and
implementation history; the backlog carries detailed work items and the
per-change conformance attribution. When an older narrative conflicts with this
page, verify the source and tests, then update this page.

## Product status

MiloJS is an experimental JavaScript engine and Node-compatible runtime. It is
not yet a drop-in replacement for QuickJS, Node, Deno, or Bun.

The project deliberately has two deliverables:

- `milojs-engine`: raw JavaScript with no Node host bindings. The target is a
  small, embeddable QuickJS-class engine with published conformance results.
- `milojs`: the engine plus a module loader, event loop, filesystem/network host
  bindings, Node-compatible JavaScript modules, and Node-API addon loading. The
  compatibility target is Node; Deno and Bun are useful comparisons, not
  additional API contracts.

Engine maturity comes first. Runtime compatibility cannot be credible while the
language engine and embedding contract are unstable.

About <!--fact:loc-total-->60.2k<!--/fact--> lines of Milo across `src/` and `lib/`, from source text to running
program, with no V8, JavaScriptCore, or C JavaScript engine underneath.

## Evidence

Both sweeps re-run 2026-08-15 against milojs `573b2fb`, built with the Milo
compiler at `d6adecc5`. Corpora are local checkouts rather than vendored, so the
revisions are recorded here and the two scores are informative but not yet a
reproducible release artifact.

| measure | result | corpus |
|---|---:|---|
| deterministic test262 sample (<!--fact:t262-sample-->1500<!--/fact--> selected, <!--fact:t262-skipped-->30<!--/fact--> skipped) | **<!--fact:t262-pass-->1146<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> = <!--fact:t262-pct-->78.0%<!--/fact-->** | test262 `<!--fact:t262-corpus-->b363f29d<!--/fact-->`, seed `<!--fact:t262-seed-->0x2f6e2b1<!--/fact-->` |
| QuickJS `tests/` | **<!--fact:qjs-pass-->101<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> = <!--fact:qjs-pct-->67.8%<!--/fact-->** | quickjs `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->`, 58 files |
| test262 failures that are PARSE failures | <!--fact:t262-parsefail-->41<!--/fact--> of <!--fact:t262-fail-->324<!--/fact--> | <!--fact:t262-parsefail-pct-->12.7%<!--/fact--> of the gap is missing syntax; the rest is semantics |
| QuickJS cases that never ran (parse gaps) | <!--fact:qjs-parsefail-->0<!--/fact--> | of those that ran, <!--fact:qjs-ran-pct-->67.8%<!--/fact--> of <!--fact:qjs-ran-->149<!--/fact--> pass |
| locked engine fixtures (`tests/*.js`) | <!--fact:fixtures-engine-->240<!--/fact--> | byte-exact differential output vs node |
| locked runtime fixtures (`tests/runtime/*.js`) | <!--fact:fixtures-runtime-->35<!--/fact--> | module, async, fetch, HTTP, sqlite, host behavior |
| Milo invariant fixtures (`tests/milo/`, `tests/milo-errors/`) | <!--fact:fixtures-milo-->3<!--/fact--> + <!--fact:fixtures-milo-errors-->8<!--/fact--> | scheduler/context and GC-root invariants |
| ESM / Node-API / embedding fixtures | 2 / 2 / 1 | lowering, addon callbacks, C ABI |

Fixture counts are not conformance percentages.

### A real application, end to end — 2026-08-15

Suites are not enough on their own: two of the three defects below were invisible
to test262 and to every fixture here, and turned up in the first ten minutes of
pointing milojs at a production Node app.

`tahoeroads` (express 4 + Prisma + tRPC + compression + cookie-parser, a real
deployed backend) now **boots under `milojs`, binds its port and serves bytes
identical to node** — `/`, `/health`, `/sitemap.xml`, `/robots.txt` and the
404 page compared as one 14,239-byte capture, no diff.

Reproduce (needs the app checkout and its `node_modules`):

```sh
cd <app>/backend && JWT_SECRET=x <path>/mj-runtime dist/index.js &
curl -s localhost:3009/health
```

Three defects stood between "cannot load" and that, all now fixed and locked:

1. **`require` inside a closure resolved against the wrong module.** The resolver
   used a dynamic stack that is popped when a module body ends, so body-parser's
   lazy `require('./lib/types/json')` resolved against whoever triggered it —
   express — giving `node_modules/express/lib/lib/types/json`. **express 4 would
   not load at all.** No test262 case covers module resolution.
2. **`\S`, `\D`, `\W` inside a character class became the literal letters.**
   `[\s\S]` meant "whitespace or the letter S", so `[\s\S]*` matched the empty
   string. The app rewrites page metadata with `/<title>[\s\S]*?<\/title>/` and
   silently served the untouched template. Worth **+1** on test262 and the
   difference between a wrong page and a right one.
3. A trailing comma in a call argument list was a parse error (fixed separately,
   same day) — fatal on any prettier-formatted source.

Not every remaining difference is milojs's: `/api/v2/roads` hangs under node too
(it needs a live upstream), and `analytics/middleware` keeps both runtimes alive
because it installs a `setInterval` at module scope.

test262 stands at <!--fact:t262-pass-->1146<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> = **<!--fact:t262-pct-->78.0%<!--/fact-->** on the deterministic sample. The
backlog carries the per-change attribution.

Where the remaining failures are, compiled from the committed report rather than
typed in, because a hand-kept version of this table went stale the moment any
sweep moved:

<!--fact-block:t262-areas-->
| area | failing | passing |
|---|---:|---:|
| `language/statements` | 53 | 229/282 |
| `language/expressions` | 45 | 289/334 |
| `built-ins/Object` | 32 | 95/127 |
| `built-ins/Array` | 25 | 66/91 |
| `built-ins/RegExp` | 19 | 54/73 |
| `built-ins/Temporal` | 18 | 113/131 |
| `built-ins/String` | 12 | 27/39 |
| `built-ins/TypedArray` | 12 | 26/38 |
<!--/fact-block-->

Reading it: the two `language/` rows are one area split in the corpus, and
together they are the largest remaining block. `built-ins/Temporal` is the
largest single area in the corpus by file count, so its rate moves the headline
more than its failure count suggests.

### Native stack status

Gate 0 is green on the normal 8 MB Linux process stack. Splitting hot recursive
nodes from the full expression dispatcher reduced `evalExpr`'s native frame from
about 250 KB to 824 bytes; binary evaluation uses about 5.7 KB. The unchanged
closure and catchable-recursion fixtures pass without a stack override. The
engine and embedding default permits 100 ordinary recursive calls and guards at
104; the runtime retains a 500-frame limit on its green task. The earlier 108
guard proved too close to the native ceiling under stack-layout and ASLR
variation.

### Arena safety status

MiloJS still stores auxiliary AST, scope, and object references as raw `i64`
indices. Expression, statement, block, call-argument, literal, declaration, and
switch descriptor slots use distinct ID types, with absence represented by
`Option<Id>` and retained compile-fail fixtures. No recyclable engine arena has
migrated yet. The staged migration is specified in
`docs/milojs-arena-safety.md`. Its upstream blocker is resolved: Milo `9a0bfa4e`
provides release-checked live-handle snapshots, stale/free rejection, slot
retirement at generation exhaustion, and the method-oriented `Arena<T>` API
needed by a mark-sweep collector. Function, class, and literal-table IDs remain
before the AST phase is complete.

## Shipped engine surface

- Tree-walking evaluator with lexical closures, classes, generators, async
  functions, promises, exceptions, modules, and common modern syntax.
- **Both binaries run the program on a green task**, so generators and async
  activations work in the engine as well as the runtime. The `tests/` vs
  `tests/runtime/` split is now only about the node layer — process/fs/http/fetch
  — not about which language features work.
- Stable-slot mark-sweep GC for scopes and objects, including suspended async
  and generator activation roots. These slots are not generational handles yet.
- Objects, arrays, prototype chains, Proxy, symbols, Map/Set, Date, RegExp,
  ArrayBuffer/DataView, integer typed arrays, and arbitrary-precision BigInt.
- **Every built-in constructor now has a real prototype object**, built by a
  shared `buildNativeProto`, with instances linked to it — including the buffer
  family behind a `%TypedArray%` intrinsic, so `Object.getPrototypeOf(Int8Array)`
  resolves and `TypedArray.prototype.map.call(ta, fn)` works. Built-ins carry own
  `name` and `length` with the spec's descriptors, and assignment to a built-in
  `prototype` respects writability.
- Receiver brand checks on the buffer family: name dispatch stays generic for
  `Array.prototype`, where ES says it is, and throws a TypeError for
  `%TypedArray%`/`ArrayBuffer`/`DataView`, as node does. The brand survives
  `bind()`.
- Generator completions: `gen.throw()` / `gen.return()`, IteratorClose on a
  for-of abandoned by break/return/throw, and `yield*` forwarding completions to
  the inner iterator (which also gave `yield*` two-way `next(v)` threading).
- Async generators and `for await`, preferring `Symbol.asyncIterator` and
  awaiting each value over a plain sync iterable.
- Detached ArrayBuffer views behave as the spec says — zero length, `undefined`
  at every index, dropped writes, TypeError from every prototype method.
- Common builtins implemented partly in Milo and partly in the embedded
  `lib/engine-prelude.js` specification layer.
- **RegExp Unicode property escapes**: `\p{...}` and `\P{...}`, at the top level
  and inside a character class, including `Script`/`Script_Extensions`, every
  `General_Category` value, the binary properties, and all 1,682 spellings the
  corpus uses. Resolved to code point ranges at pattern-COMPILE time from
  `src/uniprops.txt` (generated, 103KB), so matching costs what `[a-z]` costs. An
  unrecognised name is the early SyntaxError the spec requires.
- **Numeric regex escapes**: `\xHH`, `\uHHHH`, `\u{H...}` and `\cX`, as atoms and
  as character-class range endpoints. None of these existed — `/\x41/` was the
  letter x followed by 41 — which also meant a mechanically generated pattern
  (`RegExp.escape`'s output among them) could not be read back.
- **Strict mode is tracked at run time.** A failed property write — frozen
  target, non-extensible target, non-writable data property, accessor with no
  setter — throws a TypeError in strict code and is dropped in sloppy code, per
  activation, from `FuncDef.isStrict`.
- **A null prototype is distinct from an absent one.** `Object.create(null)`,
  `setPrototypeOf(o, null)` and `__proto__ = null` produce an object that inherits
  nothing; a plain `{}` inherits `Object.prototype`, including anything a program
  adds to it.
- **The iterator helpers reach generators**: a generator object now has the
  spec's prototype chain, so `gen().map(f).take(2).toArray()` works alongside
  `[1].values().map(f)`.
- ES2025 odds and ends: `RegExp.escape`, `Promise.try`, `Error.isError`,
  `Math.asinh`/`acosh`/`atanh`, and `Math.log1p`/`expm1` that keep their
  significant digits for small arguments.
- Object-to-string conversion runs a user-defined `toString` from every path that
  can re-enter the interpreter; tagged templates carry the un-escaped `raw`
  chunks; `JSON.parse` rejects malformed input with a `SyntaxError`.
- `console.log` / `util.inspect` reproduce node's defaults (depth 2, breakLength
  80, compact 3) rather than bun's shape.
- Large sparse array lengths use an implicit logical tail and numeric property
  entries for far-out elements; assigning a multi-billion length does not
  allocate or loop per hole.

### Known engine limits

Every bullet here carries a marker comment naming its probe id, and is re-probed against the
engine by `tools/check-gaps.mjs`, which runs in `tools/precommit.sh`. Closing a
limit makes that gate FAIL until the bullet is deleted, and adding a bullet
without a probe fails too. This list had rotted to six wrong entries out of ten
before it was made executable — prose about what is missing rots faster than any
other prose in a repo, because closing a gap never touches the file claiming it
is open.

- **`Float16Array` is absent.** <!--gap:float16-->
- **`BigInt64Array` / `BigUint64Array` have no `from`/`of`.** <!--gap:bigint64-from-->
  The types themselves exist and store and wrap 64-bit values correctly; it is
  the two static constructors that are still missing.
- `toLocale*` is en-US only and ignores its arguments; `Intl` is not modelled.
  <!--gap:intl-->
- `@@match`/`@@replace`/`@@split` delegate to the String methods, the reverse of
  the spec's direction. <!--gap:regexp-symbols--> Correct while nothing
  overrides them, wrong for a subclass that redefines them.

Closed since this list was last written by hand, and kept here only as a record
of how far it had drifted: `BigInt64Array`/`BigUint64Array` existing at all,
duplicate-declaration `SyntaxError`s, direct `eval` of arbitrary expressions,
`Temporal` (now at 60.7% of its test262 suite), own `name`/`length`/`prototype`
on function values, and `await` of a settled promise resuming after a microtask
tick rather than inline.

### The one shape that can hang

`next()` on an async generator drives the body instead of scheduling it. Node
returns a pending promise immediately and runs the body afterwards; milojs parks
the caller, drives the body to its next yield, and returns an already-settled
promise. Values are always identical, but interleaving differs whenever two
async functions are in flight — and it deadlocks when a caller invokes `next()`
*without* awaiting it and the body then awaits a promise that only settles after
`next()` returns. QuickJS `bug1355.js` is exactly this.

A request-queue fix was attempted on 2026-08-15 and reverted. The queue worked;
the event loop is what killed it, with a nondeterministic hang in ordinary
sequential code that was strictly worse than the one pathological shape it
fixed. Read the backlog entry before trying again — the note there says where to
start (make the body's runnability explicit instead of inferring it from "a
request is queued").

## Shipped runtime surface

- CommonJS loading and a parse-time ESM compatibility lowering: default, named,
  namespace, side-effect, and renamed imports, `export ... from`, `export *`, and
  dynamic `import()` of a literal specifier. Bindings are snapshots rather than
  ESM live bindings.
- Event loop, microtasks, timers, async suspension, HTTP serving, outbound
  `fetch`, filesystem APIs, Buffer, streams, and a growing set of Node modules.
- `node:sqlite` (`DatabaseSync`/`StatementSync`) over libsqlite3 via Milo's
  `std/sqlite`: `exec`, `prepare`, `run`/`get`/`all`/`iterate`/`columns`,
  positional and named parameters, foreign keys on by default, and Node's
  `ERR_SQLITE_ERROR`/`ERR_INVALID_ARG_TYPE` codes. A differential fixture locks
  the output byte-for-byte against Node. Only the `node:` specifier resolves, as
  in Node, so the unrelated `sqlite` npm package is not shadowed. Results are JS
  numbers rather than BigInt, so `setReadBigInts(true)` and rowids past 2^53 are
  rejected rather than silently wrong; blobs come back as text.
- Node-API addon loading with promises, references, wrapping, classes, and
  threadsafe functions.

This is an application-oriented compatibility slice, not general Node
compatibility. `http.request`/`http.get` are exported but never complete: a
client request against our own in-process server hangs instead of failing, which
is worse than an absent export and should be treated as a client-side gap, not a
shipped API. TLS serving, child processes, computed module discovery, and
significant package-facing edges remain. Ten of <!--fact:napi-entry-points-->84<!--/fact--> Node-API entry points are
honest stubs; external-Buffer finalization remains from the Buffer family. A
compiled-addon differential test locks native callbacks and shared Buffer
mutation into JavaScript.

## Product gates

### Gate 0: green and measurable — **RED as of 2026-08-15**

Satisfied 2026-07-30, and regressed the same day the prototype sweep began.

- **The release pipeline has failed on every push since `0f167c5`.** The
  `linux-arm64` job aborts on the runtime smoke test — `console.log("hello from
  milojs")` — with `free(): invalid pointer` and exit 134. `linux-x64` and
  `darwin-arm64` build and smoke clean. The engine binary passes; only the
  runtime binary aborts, which is the discriminator worth starting from.
  The published rolling tarballs are consequently stuck at the 16:53 build of
  2026-08-15 while `main` moves on.
- Leading hypothesis, unproven: the release job installs Milo's rolling `latest`
  compiler, which refreshed to `d6adecc5` — *main is codegen'd as a green task
  wherever spawn is reachable* — 23 minutes before the first failure. The runtime
  has the event loop, so spawn is reachable there and not in the engine. Confirm
  by building milojs HEAD against the preceding compiler before looking anywhere
  else.
- Milo's own CI has **no linux-arm64 runner** (macOS-arm64, linux-x64,
  windows-x64 only), so this release job is the only thing exercising that
  target's codegen. That coverage hole is the reason the failure surfaced here
  instead of upstream.
- All engine, runtime, Milo invariant, symbol, docs, and contract guards pass on
  the CI workflow itself.
- Compiler compatibility is recorded rather than inferred from a rolling tag.
- Recursive fixtures pass on the platform's normal stack; a larger test-only
  stack is not an acceptable compatibility mechanism.

### Gate 1: embeddable engine preview

- A real `libmilojs` C ABI builds with opaque context/value handles; retained
  objects survive forced GC and release invalidates their handles.
- An embedder can evaluate source, inspect exceptions, exchange primitive
  values, access object properties, and release handles. Native-function
  registration is still missing.
- A C ABI test builds and links outside the MiloJS implementation on Linux;
  macOS coverage remains.
- Pinned test262 and QuickJS reports are checked in and reproducible. **Not
  done** — the corpora are still local checkouts and the sweeps are hand-run.

The initial ABI is explicitly single-context because async/generator and
Node-API re-entry currently use process-global interpreter state. The migration
to isolated contexts is specified in `docs/milojs-embedding.md`.

### Gate 2: credible QuickJS alternative

- Core `language/` and non-Intl builtins have explicit conformance targets and
  a regression ratchet.
- Remaining fake prototype dispatch is removed before bytecode freezes it into
  a second execution engine. **Substantially done** — every constructor has a
  real prototype and the buffer family brand-checks its receiver. What is left is
  own-property bags on function values.
- Memory limits, interruption, stack limits, and deterministic teardown are
  exposed through the embedding API.
- Raw arena indices are replaced by typed AST IDs and generational object/scope
  handles; evaluation consumes frozen program state and stale handles are
  detected in release builds.
- Benchmarks publish startup, execution, allocation, and peak-memory results.

### Gate 3: Node runtime preview

- A real Express application serves routes end to end without application-
  specific package stubs.
- HTTP client/server, TLS, subprocesses, filesystem, streams, module resolution,
  errors, and shutdown behavior have integration coverage.
- Node-API callback and Buffer families are implemented, and unsupported entry
  points return errors rather than false success.
- A checked-in module and package compatibility matrix defines the supported
  surface.

### Gate 4: performance architecture

Decide on bytecode from measurements, not chronology. A bytecode VM is justified
when tree-walker dispatch, native stack depth, or suspension complexity blocks a
published gate. Keep the tree walker as a differential oracle if the VM lands.

The tree walker keeps the implementation understandable but is substantially
slower than a production bytecode VM or JIT.

## Immediate order

1. **Restore Gate 0**: fix the linux-arm64 runtime abort, and get a linux-arm64
   runner into Milo's own CI so the next one is caught upstream.
2. Replace the hand-run conformance summaries with generated, checked-in reports
   over pinned corpora — this is the last item blocking Gate 1.
3. Probe the 154-case `cannot read property of undefined` bucket. Two of the
   three largest wins so far were one missing object each, not a feature.
4. Temporal, the largest addressable bucket now that BigInt64Array exists: 60.7%
   of 4603 cases, and the remaining clusters are sized in `docs/backlog.md`
   (ISO-string edge cases, observable operation order, option validation).
5. Make the async-generator body's runnability explicit, then retry the request
   queue. It is the only known hang.
6. Implement the smallest complete C embedding vertical slice.
7. Grow conformance and runtime application gates in separate, measured lanes.
