<!-- doc-meta
system: backlog
purpose: the open list. What is broken or missing, why it is not trivial, and what to do next
key-files: src/engine/eval.milo, src/engine/builtins.milo, src/engine/parser.milo, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: an item lands (delete it), or a sweep/probe finds a new gap (add it)
last-verified: 2026-08-19, every item below re-probed against .dev/mj-engine and node; six entries that had gone stale were deleted rather than carried
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

## http: the server cannot tell that a client went away

`req.on('aborted')` and `req.on('close')` never fire on the SERVER's request
object when a client disconnects mid-response, so node's abort tests wait for an
event that cannot arrive and are killed by the harness. This is the largest
remaining cluster of hangs in the http area.

Reproduce: `test-http-client-abort.js`, `test-http-client-aborted-event.js`,
`test-http-server-close-destroy-timeout.js`.

Why it is not a one-line fix: `Server.prototype._serveOnce` in `lib/http.js`
accepts a connection, reads the whole request with a single `__tcpRecv`, and
dispatches. The accepted connection is a raw id, never wrapped in a
`net.Socket`, so there is nothing that emits 'close' and nothing watching for
one. Serving a request is not an event stream on the server side the way it is
on the client side, where `sendOverSocket` does use a real Socket. Closing this
means giving the server the same connection model as the client, which also
unblocks keep-alive and request bodies that arrive in more than one packet.

Related and cheaper, same file: `req.setTimeout`, `res.setTimeout` and
`server.setTimeout` are still no-ops on the server side. The client's versions
now work and can be copied.

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

## Modules: bindings are snapshots, and a computed specifier cannot resolve

Both verified 2026-08-19 against node.

- **Not live bindings.** A mutated export does not update an importer that
  already read it: after `bump()` sets `n = 2` in the dependency, the importer
  still reads 1, and so does a later `import()` namespace of the same module.
- **`import(spec)` with a computed specifier fails**, same as a computed
  `require`: `import("./oth" + "er.mjs")` rejects with `Cannot find module`
  because the preload scan (`scanRequires` in `src/runtime/modules.milo`) runs on
  tokens and cannot see it, so the module is never registered. It works only if
  something static already pulled that module in.

## Strict mode: `f.caller` and `arguments.callee`

`f.caller` inside strict code answers `undefined`; node throws TypeError. Needs a
per-function accessor that knows its own strictness. Same family as the strict
rules still unimplemented: assignment to an undeclared name, duplicate parameter
names, octal literals.

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

`bench/run.sh` reads 300-2600x off bun. A `sample` profile of `bench/arith.js`
(pure arithmetic, no property access, no strings) puts roughly a third of samples
in malloc/free/`drop`/`cloneValue` and only a tenth in scope-lookup string
compares. The gap is per-node dispatch plus allocator traffic on owned values,
not one mechanism.

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
