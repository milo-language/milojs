<!-- doc-meta
system: status
purpose: canonical current capability, evidence, and next-milestone dashboard for milojs
key-files: src/milojs-engine.milo, src/milojs.milo, tests/run.sh, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: a product gate lands, a conformance sweep is rerun, or the supported host surface changes
last-verified: 2026-08-17 (property escapes, numeric regex escapes, runtime strict mode, null prototypes, iterator helpers on generators; the failing-area table re-measured)
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

About <!--fact:loc-total-->47.9k<!--/fact--> lines of Milo across `src/` and `lib/`, from source text to running
program, with no V8, JavaScriptCore, or C JavaScript engine underneath.

## Evidence

Both sweeps re-run 2026-08-15 against milojs `573b2fb`, built with the Milo
compiler at `d6adecc5`. Corpora are local checkouts rather than vendored, so the
revisions are recorded here and the two scores are informative but not yet a
reproducible release artifact.

| measure | result | corpus |
|---|---:|---|
| deterministic test262 sample (<!--fact:t262-sample-->1500<!--/fact--> selected, <!--fact:t262-skipped-->30<!--/fact--> skipped) | **<!--fact:t262-pass-->1016<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> = <!--fact:t262-pct-->69.1%<!--/fact-->** | test262 `<!--fact:t262-corpus-->b363f29d<!--/fact-->`, seed `<!--fact:t262-seed-->0x2f6e2b1<!--/fact-->` |
| QuickJS `tests/` | **<!--fact:qjs-pass-->104<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> = <!--fact:qjs-pct-->69.8%<!--/fact-->** | quickjs `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->`, 58 files |
| locked engine fixtures (`tests/*.js`) | <!--fact:fixtures-engine-->214<!--/fact--> | byte-exact differential output vs node |
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

**test262 moved 34.6% to <!--fact:t262-pct-->69.1%<!--/fact--> over 2026-08-15**, from one structural finding
repeated across the whole builtin surface: constructors that had no `prototype`
object at all. See the backlog for the per-change attribution, including the two
places where the harness rather than the engine was at fault, and the one area
(`built-ins/Boolean`) that legitimately went down.

Where the remaining failures are, by absolute count in the sample:

| area | failing | note |
|---|---:|---|
| `language/statements` + `language/expressions` | 138 | class members, generator parameter binding, declaration edges |
| `built-ins/Temporal` | 69 | implemented but partial; failures are ISO-8601 parsing and range validation, 1-3 per cause |
| `built-ins/Array/prototype` | 37 | species creation, coercion ordering |
| `built-ins/Object` | 44 | property-descriptor fidelity |
| `built-ins/TypedArray` | 17 | resizable buffers, species |
| `annexB` + `dynamic-import` + `with` | 27 | legacy eval scoping, and two unimplemented features |

Temporal is no longer "not implemented at all" — it is implemented and partial,
and its 69 remaining failures are spread ~1-3 per cause across string parsing and
range checks rather than concentrated behind one gap. That makes it grind rather
than a lever, which is the opposite of how it read when it was absent.

The reverse also holds and is worth stating: `built-ins/RegExp` was 49 failures
and is now the area with the largest single WIN behind it, because `\p{...}` was
one addressable feature rather than a spread. Measured on its own with
`--dir built-ins/RegExp/property-escapes`: 0% to **86.0%** (527/613).

The top two failure buckets are now assertion shapes rather than crashes:
48 cases of "Expected a TypeError to be thrown but no exception was thrown at
all" and 31 of the same for `Test262Error`. Both are dominated by destructuring
(`*/dstr/*` across 15 directories) and by generator PARAMETER binding, which this
engine still performs lazily: the parser desugars patterns and defaults into a
body prologue, so `function* f([[x]] = [null]) {}` does not throw until the first
`next()`, where the spec throws at the call. That one mechanism is the largest
identified remaining lever.

`TypeError: cannot read property '…' of undefined` — previously the top bucket at
154 cases, the signature of a harness read failing before any test ran — is no
longer in the top two.

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

- **`BigInt64Array` / `BigUint64Array` do not exist** — the largest single
  bucket at 538 test262 cases. `taElem` returns `f64` and every typed-array
  method is written against that, so this needs a parallel `JSValue`-returning
  element path, not a new width. `NATIVE_TA_BASE` must also move off 79 first.
- **No duplicate-declaration check** — `const x = 1; const x = 2;` in one scope
  is accepted where node raises a `SyntaxError`.
- **No direct `eval`** — limited to a bare identifier in scope.
- **`Temporal`, `Atomics`, `Float16Array`** are absent.
- **`await` of an already-settled promise resumes inline** rather than after a
  microtask tick.
- Property descriptors: `name`/`length` read correctly but are not own
  properties on function values (~42 cases suite-wide), because JS functions and
  natives have no own-property bag.
- `Date` is UTC-only on purpose. The local getters used to decompose in the host
  timezone while the setters used UTC, so `d.setHours(d.getHours())` shifted the
  date. Everything is UTC now, which makes milojs behave as node under `TZ=UTC`;
  a correct local setter family needs `mktime`, which std does not expose.
  Anyone adding a timezone database must do getters and setters together.
- `toLocale*` is en-US only and ignores its arguments; `Intl` is not modelled.
- `@@match`/`@@replace`/`@@split` delegate to the String methods, the reverse of
  the spec's direction. Correct while nothing overrides them, wrong for a
  subclass that redefines them.

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
4. `BigInt64Array` / `BigUint64Array` — the largest single addressable bucket at
   538 cases.
5. Make the async-generator body's runnability explicit, then retry the request
   queue. It is the only known hang.
6. Implement the smallest complete C embedding vertical slice.
7. Grow conformance and runtime application gates in separate, measured lanes.
