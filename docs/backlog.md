<!-- doc-meta
system: backlog
purpose: the open list. What is broken or missing, why it is not trivial, and what to do next
key-files: src/engine/eval.milo, src/engine/builtins.milo, src/engine/parser.milo, src/engine/methods.milo, src/engine/runtime.milo, src/engine/driver.milo, src/engine/bytecode.milo, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts, lib/http.js, bench/run.sh, bench/arith.js
update-when: an item lands (delete it), or a sweep/probe finds a new gap (add it)
last-verified: 2026-08-26 (re-verified for the sweeps emitting per-case pass lists; entries unaffected. Previous note: interpStackBytes added to driver.milo, and the darwin deep-recursion entry below records the half it could not fix; other entries re-checked unchanged. Previous note: re-checked against the evalUnArm change: the unary operator is now decided into a UnOp before the operand is evaluated, which fixes a dangling AST borrow and changes no behaviour this doc describes)
-->

# milojs backlog

## Ranked next, by measured case count

From the whole-corpus test262 sweep (`bun scripts/test262-sweep.ts`, no
`--sample`, ~48.7k cases, ~12 minutes). Re-rank by re-running it, not by
intuition: the 1500-case sample is too thin to rank causes.

1. **Temporal, ~2002 failures.** Largest single area, and node has no Temporal,
   so test262 is the only oracle. Clusters, from the failure list:
   - ISO string parsing rigour, ~208: annotations (calendar, time-zone,
     unknown, critical flags), the U+2212 minus, time separators, UTC offsets
     in date strings, range limits.
   - Option validation, ~115: `options-wrong-type`, `overflow-wrong-type`,
     `roundingmode-wrong-type`, `smallestunit-wrong-type`,
     `overflow-invalid-string`.
   - Observable operation order, ~106: `order-of-operations.js` and
     `options-read-before-algorithmic-validation.js` pin the exact sequence of
     property gets. largestUnit is read before smallestUnit, and that is part of
     the contract.
   - smallestUnit of year/month/week for a date-time difference, 50: needs
     RoundRelativeDuration, the one genuinely hard algorithm left here.
   - `leap-second.js`, 27: `:60` is accepted and clamped to 59.
   - `argument-number.js`, 26: a number argument must be a TypeError, not coerced.

   None of this needs new architecture. Temporal at 90% is worth about 4 points
   of the headline on its own.
2. **`built-ins/AsyncGeneratorFunction`, ~13% passing.** The constructor and its
   prototype/`@@toStringTag` chain are not modelled at all, separately from
   async generator objects working: `(async function*(){}).constructor.name` is
   `"Function"`, node says `"AsyncGeneratorFunction"`.
3. Not engine bugs, do not rank them as such: Atomics/SharedArrayBuffer and
   ShadowRealm (48) are host features, and `built-ins/Iterator`'s remainder is
   mostly stage-2 proposals (`zip`, `zipKeyed`, `concat`, `chunks`, `windows`)
   that node does not have either.

## Engine: deep recursion on darwin dies ~2.3k frames early

The interpreter task stack is sized per-OS (`interpStackBytes` in
`src/engine/driver.milo`): 128 MB on linux, where glibc faults stack pages
lazily, so the 10k `callDepthLimit` backstop is what bounds recursion on every
path. darwin keeps 16 MB, because Apple's `makecontext` writes through the whole
mapping: a do-nothing context on a 128 MB stack peaks at 135 MB RSS (20-line C
repro, 2026-08-26), so a big stack costs its full size in dirty pages on every
milojs process. Consequence: recursion that needs more than ~2.3k tree-walker
frames (~7 KB each) raises RangeError on darwin where linux and node keep going;
es-get-iterator's last 10 assertions are the measured case.

Fix lives in milo, not here: replace the system ucontext on darwin with the
scheduler's own context switch (the windows arm already has its own), then
delete the darwin branch of `interpStackBytes`. The alternative that does not
need milo — shrinking the ~7 KB per-frame cost — is the same work the bytecode
VM stage already owns.

## Engine: an abrupt completion from a Map iterator HANGS

`built-ins/Map/iterator-item-first-entry-returns-abrupt.js` is the one test262
crash in the budget, and it is a hang, not a segfault — the harness kills it with
SIGTERM and the sweep classifies a signal death as a crash. It reproduces
standalone, so it needs no corpus to work on:

```sh
cat ~/git/test262/harness/{assert,sta,compareArray}.js \
    ~/git/test262/test/built-ins/Map/iterator-item-first-entry-returns-abrupt.js > /tmp/case.js
timeout 8 .dev/mj-engine /tmp/case.js; echo $?      # 124
```

`new Map(iterable)` where the first entry's own iterator throws: the abrupt
completion is not unwinding the construction loop, so it spins. Two QuickJS cases
die the same way (also SIGTERM, also budgeted), and it is worth checking whether
they are this bug before treating them as three.

Why it is not a one-liner: the loop is inside the Map constructor's builtin arm,
which reads entries through the generic iteration path, and that path signals a
throw by setting `st.throwing` rather than by returning a completion — so the fix
is a missed `st.throwing` check, and finding WHICH one is the work. See the
section below.

## Exceptions propagate on a hand-checked flag, and nothing gates it

`st.throwing`/`st.thrownValue` on `Interp` is how a JS `throw` travels. It is not
a `Result` the type system makes you handle: every call site that can throw has to
remember to test the flag and bail. The count today:

| file | `throwing` reads |
|---|---:|
| `src/engine/eval.milo` | 398 |
| `src/engine/methods.milo` | 82 |
| `src/engine/builtins.milo` | 14 |
| `src/engine/driver.milo` | 7 |
| `src/engine/runtime.milo` | 6 |
| `src/engine/bytecode.milo` | 3 |

Miss one and execution continues in a throwing state. The symptom is a wrong
answer or a hang, never a crash — the Map case above is one, and it took a
test262 timeout to surface it. This is the largest invariant in the engine with
no gate under it, in a repo where shadowed symbols, layering, doc staleness,
arity, exit codes and AST-reference lifetimes all have one.

Not a one-liner because the honest fix is a type: make the throwing operations
return something the checker forces you to inspect, which is a refactor across
510 sites. A cheaper gate that would catch most of it: a lint that flags any
statement calling a known-throwing helper whose result is used without an
intervening `st.throwing` test. Build the lint first and see what it finds before
committing to the refactor — the point of the count above is that nobody knows
today how many of the 510 are missing checks rather than deliberate.

## http: no keep-alive, so every response closes its connection

`Connection: close` goes out on every response and the socket is destroyed after
it, so a client asking for `Connection: keep-alive` does not get it and a second
request on the same connection is never read. Multi-packet request bodies have
the same root cause: `Server.prototype._serveOnce` in `lib/http.js` reads one
request with a single blocking `__tcpRecv`, so one read is one request.

Reproduce: `test-http-keep-alive-max-requests.js`.

**Attempted 2026-08-19 and reverted.** The rewrite is the obvious one: accept,
wrap in the `net.Socket` (that part is already in place and stayed), then
assemble requests out of the socket's data stream, dispatch one at a time, and
keep the connection after `res.end()` when both sides agreed to. It works for
the simple cases and it is measurably worse overall — the http area went 79 to
76 and hangs went 56 to 66. The three that broke were
`test-http-1.0-keep-alive.js`, `test-http-default-encoding.js` and
`test-http-request-large-payload.js`, the last of which is precisely the
multi-packet body the change was meant to fix. The patch is not kept; `git log`
has this entry and the reasoning below.

Two things the attempt did get right and a retry should keep:

- Keep-alive is only possible when the response is SELF-DELIMITING. An HTTP/1.0
  client with a streamed body has neither a length nor chunked framing
  available, so the close is the delimiter and the connection cannot be kept
  alive however politely the client asked. Missing this hangs
  `test-http-wget.js`.
- The connection decision belongs at dispatch, once, read from what the client
  actually said: 1.1 keeps alive unless it says `close`, 1.0 only if it says
  `keep-alive`.

What to work out before retrying: where the extra hangs come from. The suspicion
is the handoff from the blocking `__tcpRecv` to the pump — a request whose bytes
are already buffered when the socket is adopted, versus one that arrives after —
but that was not established, and guessing again is how this attempt went.
Instrument the drain loop first.

## streams: no `_writev` batching, and the Readable state machine is missing

Two separate holes left after the state views landed.

**`_writev` batching.** `test-stream-writev.js` counts write calls and gets one
fewer than node. Corking now buffers for real and calls `_writev` with the held
chunks, but node's split between the first `_write` and the batched `_writev` is
not the one here. Reproduce: `test-stream-writev.js`, which reports `6 === 7`.

**The pull-based Readable state machine.** `_readableState` reports every field
this implementation genuinely maintains and deliberately omits the ones it does
not: `reading`, `needReadable`, `emittedReadable`, `resumeScheduled`,
`awaitDrainWriters`. Those are not properties that can be added to the view —
they are the bookkeeping of node's demand-driven read cycle, which this
implementation does not have (it pushes on `push()` and drains when flowing).
Tests reading them fail with a clear "cannot read property of undefined" rather
than against an invented value, which is the intended outcome until the read
cycle exists.

Reproduce: `test-stream-readable-event.js`, `test-stream-readable-needReadable.js`,
`test-stream-readable-emittedReadable.js`,
`test-stream-readable-resumeScheduled.js`,
`test-stream-readable-reading-readingMore.js`,
`test-stream-pipe-await-drain-manual-resume.js`.

Why it is not a one-line fix: it is the Readable rewrite, not a patch. `read(n)`
has to pull through `_read`, buffer to a high water mark, and emit 'readable'
against demand rather than on arrival.

## process: `kill` does not exist, and an unhandled rejection is not an uncaught exception

**`process.kill` is absent.** Adding a validating wrapper is easy and would be a
lie: there is no signal-sending native under it, so it would accept a pid and a
signal and do nothing. Reproduce: `test-process-kill-pid.js`, which also needs
`internalBinding` interception to observe what was sent, so it is not winnable by
adding the function alone.

**An unhandled promise rejection prints and continues** where node's default
routes it to `uncaughtException` and exits. `process.on('uncaughtException')`
now catches a throw from a timer and from a nextTick callback, but not one from
a promise reaction, which takes the rejection path instead.

Reproduce:
```js
process.on('uncaughtException', (e) => console.log('caught:', e.message));
Promise.resolve().then(() => { throw new Error('x'); });
```
node prints "caught: x", milojs prints "Unhandled promise rejection".

Why it is not a one-line fix: the two paths are separate by design here, and
joining them means deciding when a rejection is finally unhandled — node waits
until the microtask queue drains before declaring it, so an await added later in
the same tick must not trigger it.

## path: win32 device roots, and `join`/`relative`/`basename` corners

`matchesGlob`, `resolve("")`, the UNC device in `win32.resolve`, `extname("..")`,
`win32.normalize("C:")` and both `dirname` implementations are fixed; the area is
9/16 (was 3/16). What is left:

- **`\\.\` and `\\?\` DEVICE roots** are not recognized as roots:
  `win32.resolve("\\\\.\\PHYSICALDRIVE0")` gains a trailing separator, and
  `win32.normalize("\\\\.\\foo\\")` keeps one node drops. Same cause behind
  `test-path-win32-normalize-device-names.js` and `test-path-makelong.js`, which
  also wants forward slashes inside an already-namespaced path left alone.
- `win32.join("/", "..", "..")` answers `\\..\..\` where node answers `/`.
- `win32.relative` between two UNC paths under the same share answers `""`.
- `parse().root` and `parse().dir` normalize the separators they were given;
  node's parse SLICES the input, so `parse("file")` keeps `dir: ""` and the
  round-trip through `format` differs.
- `basename` disagrees on a trailing-separator case.

Reproduce: `test-path-resolve.js`, `test-path-normalize.js`,
`test-path-join.js`, `test-path-relative.js`, `test-path-parse-format.js`,
`test-path-basename.js`.

## Async: `next()` on an async generator drives the body, and can HANG

The only open item that can wedge the process. node returns a *pending* promise
immediately and runs the body afterwards; `genResumeAsync` parks the caller,
drives the body to its next yield, and returns an already-settled promise.
Values always match; interleaving differs whenever two async functions are in
flight. It deadlocks when a caller invokes `next()` WITHOUT awaiting, and the
body then awaits a promise that only settles after `next()` returns. Nothing is
runnable. QuickJS `bug1355.js` is exactly this shape.

```js
let resolve; const p = new Promise(r => resolve = r);
async function* g(){ await p; yield 1; }
const it = g(); const fut = it.next(); resolve(42);   // hangs (verified 2026-08-19)
```

The fix: `next()` registers a pending promise, unparks the body task, and
returns without parking, letting the body settle that promise at its yield.
Needs a per-generator FIFO of pending requests (node queues concurrent `next()`
calls) and `runEventLoop` must count a live async generator body as work.

**Attempted 2026-08-15 and reverted. Read this before retrying.** The queue
worked: `(generator, promise, mode, arg)` in `Interp`, marked by `collect` since
nothing else roots the promise or the send value; `asyncGenRequest` enqueues and
returns pending without parking; `asyncGenYield` settles the served request and
picks up the next or parks; `asyncGenFinish` drains. `bug1355.js` stopped
hanging. Two real fixes fell out and are worth redoing: for-await's IteratorClose
and `yield*` delegation both drove the inner generator with the SYNCHRONOUS
`genResume`, which parks the caller against a queue only that caller can feed.

What killed it was the event loop. Yielding to a runnable generator body before
`runOneTimer` starves the timer that would settle the await the body is parked
on. Moving the yield after timers fixed that livelock and left a
NONDETERMINISTIC hang in ordinary sequential code (the same script produced 2,
16, or all 18 lines across runs), which is worse than the one pathological shape
it set out to fix. The race was never identified. Start by making the body's
runnability EXPLICIT rather than inferring it from "a request is queued": the
event loop cannot distinguish "body is runnable" from "body is parked on a
promise nothing has settled yet", and spins on the difference.

## Async: `await` of an already-settled promise resumes inline

No microtask tick, so an async function whose awaits all settle synchronously
runs to completion before returning. `tests/promises.js` pins the one line this
moves ("then 42", first here and seventh under node); every other line and value
in that fixture matches node exactly. This is why `tests/promises.js` is a
registered DIVERGENCE in `tests/.node-oracle-exempt`.

## Embedding: a dropped rejection returns STATUS_OK and prints to host stderr

All 17 `eprint` sites were swept and driven from a C consumer of `libmilojs.a`.
One is wrong:

| site | embedded behaviour | verdict |
|---|---|---|
| parser diagnostics (7) | silent, `evalSourceValue` sets `quiet: true` | correct |
| uncaught throw | silent, returned as `STATUS_JS_EXCEPTION` | correct |
| `console.error` | writes to host stderr | correct, that is the program writing |
| `[gc]` stats | opt-in flag | correct |
| unhandled promise rejection | **writes to host stderr, returns STATUS_OK** | wrong |

For the CLI this is right: node prints and exits nonzero. For a library the
embedder has no way to learn a rejection was dropped, and suppressing the print
alone makes it worse (silent instead of misdirected).

It is an ABI decision, so it is not being made unilaterally. **Option 1 is the
one to build**; the CLI keeps printing exactly as it does, because it IS the host.

1. **Poll API.** `milojs_unhandled_count` / `milojs_unhandled_copy(index)`,
   drained by the host. Costs public surface, matches how the exception channel
   already works.
2. **Fold into the eval status.** No new surface, but wrong in general: a later
   eval can still attach a handler, so the rejection is not final at that point.
3. **Host callback** at context creation. Most flexible, largest surface, needs
   a rule for what the callback may do re-entrantly.

## Strings: the UTF-16 model is lossy for lone surrogates

milojs strings are UTF-8, which cannot encode an unpaired surrogate, so two
operations lose data silently rather than erroring:

| expression | milojs | node |
|---|---|---|
| `String.fromCharCode(0xD800).charCodeAt(0)` | 65533 (U+FFFD) | 55296 |
| `JSON.parse('"\ud800"').charCodeAt(0)` | 65533 | 55296 |
| `"\u{1F600}".slice(0,1).length` | 2 (whole char) | 1 (the high half) |

A program doing surrogate arithmetic, or round-tripping JSON containing
`\ud800`, gets a different string back and no indication. The fix is a
representation that can hold unpaired surrogates (WTF-8, or UTF-16 units with a
UTF-8 fast path). That is a string-layer decision, not a patch.

`isWellFormed`/`toWellFormed` already SCAN rather than answering `true`
unconditionally. The answers are identical today because nothing can produce an
unpaired surrogate; the point is that the scan keeps working if the
representation changes.

## Proxy: trap COUNTS differ on 22 of 32 operations

Every VALUE in the proxy differential matches node. The sequences do not: node
runs the exact [[Get]]/[[HasProperty]] steps each spec algorithm prescribes and
milojs takes shortcuts (`slice` 6 traps vs node's 9, `reverse` 12 vs 24). Only
observable through a logging handler, which is exactly what a Proxy is for.

## Modules: bindings are snapshots

Verified 2026-08-19 against node. A mutated export does not update an importer
that already read it: after `bump()` sets `n = 2` in the dependency, the importer
still reads 1, and so does a later `import()` namespace of the same module.

## Strict mode: `f.caller` and `arguments.callee`

`f.caller` inside strict code answers `undefined`; node throws TypeError. Needs a
per-function accessor that knows its own strictness. Same family as the strict
rules still unimplemented: assignment to an undeclared name, duplicate parameter
names, octal literals.

## node:test: no `snapshot`, deliberately

`require('node:test').snapshot` is the last missing export of that module (14 of
15 present). Node's is `{setDefaultSnapshotSerializers, setResolveSnapshotPath}`,
two setters that configure `t.assert.snapshot()`. Exporting the pair without the
assertion behind it would raise the export count and do nothing, which is the one
thing this repo's compat table exists to prevent.

Real support means resolving `<testfile>.snapshot`, serializing with the
configured serializers, comparing, and rewriting under
`--test-update-snapshots`. Worth doing when something needs it; note that it
cannot be gated today. The only node test that covers it,
`test-runner-snapshot-tests.js`, requires `internal/test_runner/snapshot` under
`--expose-internals`, so it is unwinnable whatever gets built, and a repo fixture
cannot lock it either: node's TAP output carries per-test durations, so a
`node:test` file is not byte-comparable against node the way every other fixture
is.

## Timers: no `unref`

Deliberately absent rather than stubbed. A no-op `unref` would let a program that
unrefs a long interval to allow exit HANG instead, and a hang is worse than the
TypeError an absent method already raises. Real support needs a timer flag the
event loop honours.

## RegExp: three validation gaps left open on purpose

`[\d-z]` under the `u` flag and `[a-]` under `v` are accepted where node throws
(verified 2026-08-19), as are duplicate named groups in one alternative.
Accepting a pattern node rejects is the milder failure than rejecting one it
accepts, so these rank below anything that changes a match result. Found by
generated differential comparison, with both suites green.

## Number: `toString(radix)` digits

`(1.3).toString(7)` is `1.2046204620462046205` here and `1.204620462046204621`
under node: QuickJS/JSC shortest-round-trip digits rather than node's.
`tests/radixToString.js` is a QuickJS capture, the one place in the suite where
node is deliberately not the oracle, and it is a registered DIVERGENCE for that
reason.

## Errors: stack frames are repo-relative and carry no line:column

`console.log(new Error("boom"))` prints the message plus a frame per function,
naming each source file. node prints ABSOLUTE paths with `line:column` and its
own module-loader frames, which milojs has no business inventing. Frames stay
repo-relative on purpose: absolute paths would make `tests/errorInspect.js`
machine-specific and uncommittable. Registered as a DIVERGENCE; the open half is
line:column, not the paths.

## Perf: the two shapes that would actually pay

`bench/run.sh` reads **<!--fact:bench-best-->57.6x<!--/fact--> to <!--fact:bench-worst-->1907.7x<!--/fact-->**
off <!--fact:bench-peer-->bun 1.3.10<!--/fact-->, median <!--fact:bench-median-->410x<!--/fact--> across
<!--fact:bench-count-->13<!--/fact--> benches. Those come from `docs/conformance/bench.json` now
rather than from a range someone remembered — the prose here said "300-2600x", which bracketed
the truth on both sides. Best is `<!--fact:bench-best-name-->arith<!--/fact-->`, worst is
`<!--fact:bench-worst-name-->callFn<!--/fact-->`, and the spread between them is the finding: the
cost is not uniform, so "milojs is ~400x slower" is not a thing to optimise against.

A `sample` profile of `bench/arith.js` (pure arithmetic, no property access, no strings) puts
roughly a third of samples in malloc/free/`drop`/`cloneValue` and only a tenth in scope-lookup
string compares. The gap is per-node dispatch plus allocator traffic on owned values, not one
mechanism — which is consistent with `arith` being the CHEAPEST bench: it is the one that
allocates least.

```sh
tools/dev.sh                                    # build .dev/mj-engine
.dev/mj-engine bench/arith.js & sample $! 6 1 -mayDie
```

Worth building:

- **Intern property keys to an integer id.** With a scalar key there is no string
  to clone, the single struct store in `objSet` stays, and call sites stop
  cloning. The win is the ALLOCATION, not the lookup: `propFew` vs `propMany`
  prices ~27 extra string compares per read at only ~120 ms per million reads.
- **Lexical addressing, or interning scope identity**, to remove the name
  compares from scope lookup entirely.

Do NOT retry these, they were measured and rejected:

- **Borrowing `key` in `objSet`/`setMember`** (the same change that won 5-10% in
  `scopeAssign`): +1.5% on `propWrite`, +3.5% on `propWriteNew`. A borrowed key
  cannot be moved into a struct literal, so the overwrite path assigns four
  fields instead of storing one `Prop`, and `&mut` is second-class in Milo to the
  point of being ungrammatical in a `let` (`let p = &mut h.ps[0]` is a parse
  error), so the element reference cannot be hoisted.
- **Extracting ObjLit/SetMember to their own dispatcher frames.** Reached only
  through the fallback, so extraction adds a real call to a hot node: objChurn
  regressed 3-5%. Extraction pays only where the node is not hot or already made
  the call.
- **A discriminator tag on `Binding`** (`(len << 8) | first byte` to skip the
  `memcmp`): noise, -1.3% to +5.7%, objChurn worst. Milo's string `==` already
  short-circuits on length, so the tag only helps a same-length miss, while the
  `memcmp` samples are mostly HITS.

## Parked: es-get-iterator overflows in tape's nested-test machinery

Stops after 76 assertions with RangeError, with 67 assertions behind it. The
`callDepthLimit`-was-104 fix (now ~10,400, matching node) did not close this one.
Six sittings have each only SUBTRACTED hypotheses, recorded here as state rather
than as progress:

- `object-inspect` does not recurse on any value that section uses (boxed
  symbols, bigints, numbers, functions, regexes), with and without an added
  `Symbol.iterator`.
- `getIterator` answers undefined for all twelve non-iterables it tests.
- tape's nested scheduling is not it: one level of `t.test` in a `forEach` twelve
  times is fine; TWO levels (the shape `fakeIterator` produces) is fine, and a
  stack probe immediately after reports 494 of 500 frames free, so the nesting
  leaks no depth.
- Every value in that section, through spread, `inspect` and `deepEqual`
  individually: correct.

The synchronous phase runs to completion (every marker fires); the overflow is in
the DEFERRED sub-test run, at the value after `{}`. **Next attempt: bisect by
deleting values from `nonIterables` until it passes.** That identifies the value
directly instead of reasoning about which one it might be.

## Probe before implementing

Sweep failures reading `X is not a function` are usually a method on an unusual
RECEIVER, not a missing method: `concat`, `sort`, `apply`, `toString` and
`escape` all work on ordinary receivers. Check whether a method is
prototype-dispatched or whitelisted before adding it to the prelude.

Two more traps worth remembering:

- **`scripts/test262-sweep.ts` has no `-f`.** It parses `--sample`, `--dir`,
  `--limit` and `--json` only, and a stray `-f built-ins/Object` is IGNORED and
  runs the whole corpus.
- **Diff failure SETS between sweeps, not just totals.** Two of four regressions
  in one round were invisible to the sample and to every gate; only the set diff
  found them.
