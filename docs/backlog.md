<!-- doc-meta
system: backlog
purpose: what to work on next, with measured conformance attribution per change
key-files: src/engine/eval.milo, src/engine/builtins.milo, src/engine/parser.milo, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: an item lands, a gap is discovered, or a sweep re-attributes a score
last-verified: 2026-08-18 (re-read after the native id enum landed; the NATIVE_* names in the history below are the constants it replaced)
-->

# milojs backlog

## Dead-code sweep: 13 removals, and a sweep that scored a missing binary

Routine #4 (dead-code removal) over `src/**/*.milo` (24 files after the
engine/runtime split). Ten uncalled functions, two write-only struct fields, one
enum variant nothing constructs:

- `napiReadHandle`, `napiHandleCount`, `napiReset` (`src/runtime/napi.milo`)
- `markVia` (`src/engine/runtime.milo`)
- `runChildToCompletion`, `yieldAtAwait`, `isIdentifierText` (`src/engine/eval.milo`)
- `firstNonAscii`, `mjJsonEscape` (`src/engine/builtins.milo`)
- `reIsSpace` (`src/engine/regex.milo`)
- `Regex.source`, `Regex.flags` -- written at compile, never read. The
  JS-visible `.source`/`.flags` are served from the object's own props, so the
  struct copies were two dead strings per compiled regex.
- `Builtin.ArrayCtor` (`src/engine/value.milo`)

`yieldAtAwait` was the abandoned park-based await-yield approach; the doc that
names it describes it as the rejected path, so the prose stands. AGENTS.md cited
`mjJsonEscape` as the `mj`-prefix convention example and now cites `mjJsonParse`.

**Method note.** The first two scans were worthless: they globbed `src/*.milo`,
which after the split matches 3 files. A scan that reports "0 dead" because it
looked at 12% of the tree is worse than no scan. Any repo-wide scan written
before a restructure needs its glob re-checked after one.

**The gate hole this turned up.** `scripts/quickjs-sweep.ts` defaulted to
`/tmp/milojs-engine`, a path nothing builds. With no binary there, every case
was recorded as `timeout/crash` and the sweep wrote a clean-looking
`docs/conformance/quickjs.json` reading 0/149 -- a total conformance collapse
presented as a legitimate score. `test262-sweep.ts` had had the existence guard
since it was written; it was never copied over, and the three sweeps defaulted
to three different paths (`/tmp/milojs-engine`, `/tmp/mj-eng`, `.dev/mj-runtime`).
quickjs-sweep now defaults to `.dev/mj-engine` (what `tools/dev.sh` actually
produces) and exits 2 without writing JSON when it is absent.

**This bug shipped twice.** It is already in this file, further down: test262-sweep
read a nonexistent `/tmp/mj-eng` and reported 1347 crashes, was fixed, and
quickjs-sweep carried the identical defect the whole time because the fix went to
the one instance rather than the pattern. A third hand-fix would have been the
wrong answer, so the invariant is now a gate: `tools/check-sweeps.mjs` points
every `scripts/*-sweep.ts` at a missing binary and requires a nonzero exit with
no JSON written. The check is behavioural, so a guard placed after the scoring
loop still fails it, and a new sweep fails the coverage check until it is
registered. Verified with teeth: removing the quickjs guard makes the gate fail.
Defaults are unified on `.dev/mj-engine` / `.dev/mj-runtime`, what `tools/dev.sh`
actually builds; the three different `/tmp` defaults were what made the trap easy
to step in.

A conformance number that can be produced by a setup mistake is not a
measurement. Every sweep must fail loudly rather than score zero.

Gates after removal: dev.sh 6/6, precommit clean, GC-stress 280/280, fuzz 200
seeds clean, QuickJS 102/149 with 0 parse failures (unchanged).

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

## Class methods do not capture a `for (let ...)` binding

Found while adding `tests/forLetCaptureShapes.js`. A method body reads the loop
variable's FINAL value instead of its per-iteration one. Both class forms are
affected, and node disagrees with milojs on both:

```js
const out = [];
for (let k = 0; k < 2; k++) { const C = class { m(){ return k; } }; out.push(() => new C().m()); }
console.log(out.map(f => f()).join(","));   // node 0,1   milojs 1,1
```

Plain functions and arrows in the same position are correct, so this is specific
to how a class body's methods are bound to the enclosing scope, not to the
per-iteration copy itself: the copy happens (the arrow around it captures fine),
but the method does not close over `bodyScope`. PRE-EXISTING, and unrelated to
the per-iteration-scope optimisation below: an engine built from the commit
before it prints `1,1` too. Not yet covered by a fixture, because a fixture has
to match node and this one cannot yet.

## Dup unifier: the duplicate that drifted was arrGet vs arrGetDyn

Scanned all 672 functions in `src/` for identical and near-identical bodies. Eight
exact duplicates, 267 pairs between 80% and 99% similar. Most are legitimately
parallel (getter/setter, bool/number, the napi int width variants, which differ
only in their PARAMETER types), and `napi_has_property` vs `napi_has_own_property`
correctly differ in exactly the one call that matters (`objHasInChain` vs
`objHas`).

The pair that had drifted was `makeCbArgs` / `makeCbArgsDyn`, and following it
found the real bug one level down. Every Array.prototype method does a real
[[Get]] per index, so an own ACCESSOR on an index has to be observed:

```js
var a = [1, 2];
Object.defineProperty(a, 0, { get(){ return 99; } });
a.map(x => x)        // milojs [1,2], node [99,2]
```

The element is STILL in the dense element storage after defineProperty, so
`arrGetDyn`'s fast path returned the value the slot held BEFORE the getter was
installed. A getter reached through the PROTOTYPE already worked, which is what
made it hard to see: the chain walk was right, the own-accessor case was not.
Guarded on `props.len() > 0`, so an ordinary array pays one length check.

`makeCbArgs` itself turned out to have ZERO callers, so it went too (routine 4
falling out of routine 3).

**Known remaining gap, with a number:** `methods.milo` has 28 raw `arrGet` reads
against 9 `arrGetDyn`. `find`, `findLast` and `slice` are among the raw ones and
still miss an own index accessor. Converting all 28 is not mechanical: some are
internal scratch work where a re-entrant getter would be wrong, and each one that
becomes dynamic can run user code mid-loop. It wants its own pass with the
re-entrancy question answered per site.

## Crash fuzzer: two bugs no suite or sweep had found

`tools/fuzz.sh` generates random programs that allocate, capture, nest and discard,
and runs them under `MILOJS_GC_THRESHOLD=1` so a collection happens at essentially
every safepoint. It compares against node on the SHAPE of the outcome only, never
on output text: a generated program is usually invalid somehow, and node's error
banner is the last line of every failing run, which made an early version report
40 of 60 "differing" while finding nothing. The three signals that matter are a
crash or hang, milojs accepting what node rejects, and milojs rejecting what node
accepts.

220 seeds found two real bugs, neither caught by test262, QuickJS, or any of the
six differential sweeps.

**A symbol leaked its internal representation.** Symbols are modelled as tagged
strings, so `"x" + Symbol("s")` took the ordinary concatenation path and produced
`"x@@sym:s:3"`. ToString and ToNumber of a symbol both throw; only `String(sym)`
and `sym.toString()` are allowed. Guarded at the binary-operator coercion (both
sites), at the unary numeric operators, and inside `join`, which was answering
undefined. Equality still compares without converting.

**`(null).toString()` answered "null".** Property ACCESS on null already threw, but
the primitive fast path for toString/valueOf/toFixed asked only "not an object and
not a function", which null and undefined both satisfy, so it answered directly.

`tests/symbolAndNullishCoercion.js` pins both, including the forms that must keep
working (`String(sym)`, `sym.toString()`, symbol-as-key, optional chaining,
`String(null)`, and toString on real primitives).

Both are worth noting as a class: they are cases where the ENGINE's internal
representation choice (a symbol is a string, a nullish value is not an object) is
visible through a path that never asked what the value really was.

## Gate audit: every CI check, does it still FAIL when it should

Ten gates, each given a defect it is supposed to catch, with the real exit code
captured (piping to `tail` reports the PIPE's status, which made two gates look
broken when they were not). Nine were sound: lint-symbols, check-arity,
gen-unicase --check, check-readme, verify-expected --structure, gen-facts --check,
check-docs, verify-contracts, check-docs-exec.

check-arity is worth calling out because its input format changed under it: the
arity tables became `…ArityData()` strings, and the checker was updated with them.
Perturbing an integer in the NEW format still fails correctly, which is the thing a
format change most often silently breaks.

**check-gaps had a hole.** It handles three of the four combinations of
(gap still real?) x (documented?) and let the fourth fall through silently: a gap
that is FIXED and whose bullet is already gone leaves a probe that can never fire
again. Worse, the summary counted `GAPS.length`, so those dead entries were
reported among the limits "still real".

Two were sitting there: `atomics` (implemented) and `date-utc-only` (fixed when
local time landed, bullet removed in the same session). So the gate was quietly
checking four of its six entries while announcing six. Both entries deleted, the
fourth case now reports DEAD, and the summary counts what is actually documented.
Re-audited in all four directions afterwards.

Method note for the next sweep: perturb, run the gate capturing `$?` with NO pipe,
then restore. Restoring with `git checkout -- <file>` reverts the FIX too when the
gate being audited is the file you just fixed.

## structuredClone, a class-naming bug it exposed, and a toFixed regression it caught

`structuredClone` was missing entirely. Implemented in the prelude as a deep copy
that preserves the reference GRAPH -- a cycle stays a cycle, and two properties
pointing at one object still point at one object afterwards -- which is what
separates it from a JSON round-trip. Prototypes are dropped, getters are evaluated,
and a function or symbol at any depth is a DataCloneError.

**It exposed a much wider bug.** Comparing the thrown error against node showed
milojs calling `DOMException` "constructor". The cause is not DOMException: a class
that declares a constructor took its NAME from that member, so
`class B { constructor(){} }` had `B.name === "constructor"`. Most classes declare
one. The class VALUE is the constructor's FuncDef, so its `name` field is what
`C.name` and `new C().constructor.name` report; the parser now writes the class
name there. An anonymous class still gets the empty name, so the existing inference
for `const E = class {}` is untouched.

**And it caught a regression of mine.** The QuickJS sweep dropped one case, and
bisecting showed it was NOT this change: an earlier `toFixed` fix short-circuited
above 2^53 to `numToStr`, but `toFixed` and `toString` DIVERGE there.
`(1000000000000000128).toString()` is "1000000000000000100", the shortest form that
round-trips, while `.toFixed(0)` must be "1000000000000000128", the exact value of
the double. `bnFromF64` is no help -- it wraps `numToStr`. `exactIntDecimal` now
halves the double until it fits an i64, where the cast is exact, and multiplies the
powers of two back with bigint, which is exact past i64 as well:
`(2**64).toFixed(0)` is right. `tests/numberFormatAndCycles.js` pins the divergence
so it cannot silently come back.

## `await` never yields, and one failed attempt at fixing it

An async/Promise/generator sweep found exactly one difference in 19 cases, and it
is a real one. `tests/promises.js` already records it as a DIVERGENCE, but narrowly
("await of an ALREADY-SETTLED promise resumes inline"); the effect is broader than
that wording suggests. An async function runs to COMPLETION before its caller's
next statement:

```js
(async function(){ o.push("a1"); await Promise.resolve(); o.push("a2"); })();
o.push("sync");
// node   a1, sync, a2
// milojs a1, a2, sync
```

**Mechanism.** `parkOnPromise` returns early for an already-settled promise
("parking would be permanent"), and the settled path in `awaitValue` calls
`awaitYieldMicrotasks`, which DRAINS the queue but never calls
`releaseCreatorOnce`. Releasing the creator is what makes the async call return to
its caller, so on the settled path it never returns early at all. A non-promise
await (`await null`) does not even reach that path.

**Attempted and reverted, but the mechanism is now fully mapped.** Three pieces are
needed together, and the first two are correct and verified:

1. Route a settled (or non-thenable) await through a fresh PENDING promise settled
   by a queued microtask, then `parkOnPromise` on it. Parking is what calls
   `releaseCreatorOnce`, which is the step that hands control back to the caller.
   Tracing confirmed the earlier "the task never woke" reading was WRONG: the wake
   fires and the task does resume, just later than it should.
2. In `runEventLoop`, move the woken-activation branch ABOVE `runDueTimer`. A
   resumed async function belongs to the microtask checkpoint, not the timer phase,
   and running due timers first put an `await` continuation after a `setTimeout(0)`
   queued later.
3. In `drainMicrotasks`, yield to a woken activation between queue entries, because
   in the spec the resumed function IS the microtask and must run before the next
   one. Without this a `.then` queued after an `await` still ran first.

With all three, the four focused ordering cases match node exactly, including the
full `a1, sync, a2, t1, a3` interleaving that motivated this.

**Why it is still reverted: piece 3 hangs.** Yielding from inside a drain that was
itself re-entered from an activation deadlocks the two activations; guarding it to
the main task fixes the `async function*` + `for await` case, but a combination of
pending phase-1 async state plus a later timer callback still wedges, and
`tests/run.sh` times out. A hang is worse than an ordering divergence, so this does
not ship until piece 3 is safe.

The remaining question is narrow: how to let a woken activation run to its next
suspension point during a microtask drain WITHOUT re-entering the drain from that
activation. A one-shot re-entrancy flag on the drain, or draining only from the
loop and never from an await, are the two obvious shapes.
`docs/milojs-async-suspension.md` is the map.

## A string is iterable, and the Set constructor did not know

31 Map/Set/Symbol/Proxy/Reflect/descriptor combinations against node found exactly
one difference, which is a good sign for that surface, and following it turned up
a second bug next to it.

**`new Set("aab")` was EMPTY.** `iterableToArray` returns any non-object unchanged,
so the constructor never saw the characters. `spreadInto` already knew how to walk
a string, which is why `[..."ab"]` and `for (c of "ab")` worked while the
constructor did not; the string case now routes through the same walk.

**`new Map(["ab"])` answered an empty map** where node raises a TypeError: a
non-object entry was skipped rather than rejected. A SHORT pair is still not an
error, so `new Map([["a"]])` keeps the key with an undefined value.

`tests/setMapIterableSources.js` covers both plus the sources that already worked
(array, Set, Map, generator, typed array, null), so a future change to
`iterableToArray` has one place that exercises all of them.

Everything else on that surface already matched: NaN and -0 as Map keys,
insertion order across delete-then-reinsert, WeakMap, Symbol identity and
`Symbol.for` interning, `Symbol.toPrimitive` and `toStringTag`, the Proxy traps for
get/set/has/ownKeys/deleteProperty, and the property-descriptor family.

## console.log marks cycles instead of inventing nesting

The last item from the cycle sweep. milojs printed a depth-limited EXPANSION of a
cyclic value, `{ x: 1, self: { x: 1, self: [Object] } }`, which reads as real
nesting that is not there. node marks the cycle: `<ref *1> { x: 1, self:
[Circular *1] }`.

Two passes, because the `<ref *N>` marker belongs on the object referred BACK to,
and which object that is only becomes known once the whole graph has been walked.
Pass one collects the cycle targets in discovery order, which is the order node
numbers them; pass two formats, printing `[Circular *N]` at a back edge and the
prefix where the target is first written out. `inspectObj` is split into a wrapper
and a body so the stack is pushed and popped exactly once however the several
return paths inside it leave.

Map and Set entries are NOT props or elems, they live in the side table, so pass
one has to walk `mapKeys`/`mapVals` separately. Without that a Map cycle printed
`[Circular *0]` with no matching `<ref *1>` -- the back-edge detection worked, but
the numbering had never seen the object.

`tests/inspectCircular.js` covers it, including the case that a naive visited-set
gets wrong: the same object appearing twice as SIBLINGS is not a cycle and must
still print in full, twice.

## Hunting the cycle-bug CLASS rather than waiting for the next one

Three cycle bugs had turned up separately (the parser's expression nesting,
`Array.join`, `JSON.stringify`), which is enough to treat "recursion over user data
with no visited set" as a pattern and go looking. Sixteen operations that recurse
were tested against a self-referencing object, a self-referencing array, and a
two-object cycle.

**One more was broken: `flat`.** Its requested depth is capped at a million, which
is fine as a NUMBER but not as native recursion: a cyclic array reached that cap,
blew the stack, and the process exited 0 having printed nothing. node has no cycle
check either -- it hits its own stack limit and raises a catchable RangeError -- so
the fix is a depth bound that reproduces that, not a visited set that would make
milojs succeed where node throws. 4000 levels, far past anything real.

Everything else in the class was already safe: `concat`, `includes`, `sort`,
`Object.assign`, spread, `Object.keys`, `Map`/`Set` membership, and the reviver
walk in `JSON.parse`.

`tests/cyclicStructures.js` pins the whole survey, so the next operation added to
this family has somewhere obvious to be checked.

**Known divergence, not fixed: `console.log` of a cyclic value.** milojs prints a
depth-limited expansion, `{ x: 1, self: { x: 1, self: [Object] } }`, where node
marks the cycle: `<ref *1> { x: 1, self: [Circular *1] }`. Printing a fake nesting
is worse than saying so, but matching node byte-for-byte means implementing its
`<ref *N>` numbering, which has to be threaded through inspectArr/inspectObj/
inspectMapSet along with the seen-set. Worth doing; not a patch.

`structuredClone` is also absent (it handles cycles by design).

## Number and JSON: a second hang, an i64 wrap, parseInt, and a third cycle

515 Number/JSON/Object combinations against node. Four bugs.

**`(Infinity).toPrecision(1)` HUNG.** `numToPrecision` and `numToFixed` guarded NaN
but not Infinity, and their normalisation loops divide and multiply by ten, where
Infinity/10 is still Infinity. `numToExponential` and `numToRadix` already carried
the check; these two did not.

**`toFixed` wrapped an i64.** It scales by 10^digits, which overflows above 2^53:
`(9007199254740992).toFixed(6)` gave "9223372036854.775807". At and above 2^53
every double IS an integer, so the fraction is zeros and the integer form is the
answer. A separate 1e21 fallback covers the case the spec hands to ToString.

**`parseInt` accepted a decimal point.** `parseInt("0.5")` answered 0.5 and
`parseInt(".5")` answered 0.5, where node gives 0 and NaN. The dot travels with the
exponent: parseFloat and ToNumber accept both, parseInt accepts neither, and the
existing `allowExp` flag already distinguished exactly those two callers.

**JSON.stringify recursed on a cycle** until the call-depth guard fired, giving
RangeError where the spec requires TypeError. The fix went in the PRELUDE, not the
native: `JSON.stringify` is overridden there to support replacer/space/toJSON,
which a native cannot do because natives cannot call user code. The Milo-side
writer is never reached for objects, so a fix there did nothing (and double-ran the
serialiser). Third cycle bug of the campaign, after Array.join and the earlier
parser recursion.

Three differences remain, all last-digit float precision at the extremes:
`(1e21).toString(36)`, `(1e-7).toString(36)` and `parseFloat("1e-7")` round-trip.
Closing them means a correct shortest-round-trip algorithm (Ryu or Grisu) rather
than the repeated multiply/divide walk, which is a project rather than a patch.

## Array.prototype.join: nested separator, and a cycle that killed the process

754 Array method/argument combinations against node, same technique as the regex
and String sweeps. Two bugs, both in `join`, and the second is the more serious.

**The separator leaked into nested arrays.** It applies only at the level it was
given: a nested array is converted by ToString, which is its own `toString`, which
is `join()` with the DEFAULT comma. milojs recursed with the outer separator, so
`[1,[2,3]].join("-")` was `"1-2-3"` where node gives `"1-2,3"`. Nine of the nine
differences were this.

**An indirect cycle killed the process silently.** The guard compared the element
against the immediate receiver, which catches `a.push(a)` but not `a.push([a])`.
The two-array cycle recursed until the native stack died, and the process exited
**0 having printed nothing** — the worst failure shape available, since a caller
sees success. It now tracks every array currently being joined and pops on the way
out, so the same array appearing twice at ONE level is still rendered twice rather
than being mistaken for a cycle.

Note the differential sweep did not find the cycle bug: it came from following the
first bug into the recursion. `tests/arrayJoinNesting.js` covers both, and the
pre-fix engine prints four of its ten lines and then dies.

All 754 combinations now match node. Array is otherwise clean, including holes,
`sort` stability, `length` assignment, and the copying methods.

## `"".repeat(Infinity)` hung the engine, and what String differential testing found

Same technique as the regex sweep, 2340 String method/argument combinations against
node. It found one HANG and three structural gaps.

**Fixed: the hang.** `repeat`'s guard bounded the PRODUCT of count and string
length, and that check is skipped when the string is empty, so an infinite count
fell through to a loop appending nothing several quintillion times. The spec makes
a negative or infinite count a RangeError on its own, independent of the string.
An empty string also short-circuits, so a huge FINITE count answers "" instead of
spinning. NaN is not an error: ToIntegerOrInfinity makes it 0.
`tests/stringRepeatCount.js` covers it; the pre-fix engine hangs on that fixture
rather than failing it.

The remaining 37 differences are three known-shaped gaps, none of them small:

**Lone surrogates cannot be produced.** A supplementary character is TWO UTF-16
code units and JS indexes by code unit, so `"\u{1F600}x".charAt(0)` must return the
high surrogate alone. milojs returns the whole codepoint and then "" at index 1;
`slice`, `substring`, `substr` and `at` all follow. Representing an unpaired
surrogate needs WTF-8, since it is not valid UTF-8 and Milo strings are UTF-8
buffers. This is the SAME representation change the quadratic `charCodeAt` needs,
so the two should land together.

**`localeCompare` is code-point order, not collation.** node uses ICU, where the
primary weight is case- and diacritic-insensitive, so `"a".localeCompare("NaN")` is
-1 (a before n) where a code-point comparison says 1 ('a' is 97, 'N' is 78). 20 of
the 37 differences are this.

**`normalize` is a pass-through.** NFD does not decompose and NFC does not compose.
The tables are generatable the way `tools/gen-unicase.mjs` already generates the
case mappings from node's own ICU, which is the obvious route.

## Four regex bugs, found by differential testing rather than by a suite

The remaining regex items on this list were all VALIDATION (rejecting patterns
that should be errors), which does not affect working code. Differential-testing
927 pattern/flag/input/API combinations against node found four that do, none of
which either conformance suite had caught:

- **The sticky flag `y` was never implemented.** `flagY` did not exist, so `/a/y`
  searched forward like a plain regex and `lastIndex` never moved. It now anchors:
  `regexExec` searches from `start`, so a match found anywhere later is discarded.
- **`test` ran its own bare search from 0.** It is `exec(s) !== null` per spec, so
  it must share the lastIndex handling; it did not, which meant a GLOBAL regex
  never advanced lastIndex through `test()` either. The two share one path now.
- **`split` with a regex separator dropped its limit.** The string-separator form
  already honoured it. The limit is checked after each push INCLUDING capture
  groups, because a capture can be the element that reaches it.
- **`` $` `` and `$'` were passed through literally** in a replacement.

Plus one from the first sweep: inside a character class `\b` is BACKSPACE, not the
word-boundary assertion, so `[\b]` matched the letter 'b'. Fixed with a
class-specific escape mapping, since the shared one is also used outside classes
where `\b` must stay an assertion.

All 927 combinations now match node. `tests/regexpStickySplitReplace.js` pins the
cases.

Worth noting how these were found: both suites were green on regex behaviour
here, and the bugs only surfaced from generated differential comparison. The
still-open validation gaps (`[\d-z]` under the u flag, `[a-]` under v, duplicate
named groups in one alternative) stay open on purpose, being the milder failure.

## Local time exists now: the engine had no timezone at all

`getTimezoneOffset()` returned 0 and every "local" accessor decomposed in UTC, so
local time WAS UTC engine-wide. The old comment said milojs "carries no timezone
database", but std's `DateTime.fromEpochLocal` is the host's real localtime, DST
included, so the database was there the whole time.

Two helpers carry it: `localOffsetSecAt(epochSec)` decomposes locally and
recomposes as if UTC to get the offset AT that instant (this machine answers
-28800 in winter and -25200 in summer), and `utcFromLocalSec` inverts it. The
inverse is circular, since the offset depends on the instant it is being used to
find, so it guesses with the offset at the naive value and re-reads the offset at
the guess. Inside a DST transition the spec allows either side.

Everything had to move together, because splitting only some of it is what makes
`d.setHours(d.getHours())` shift the date:

- the local get* family decomposes with `fromEpochLocal`, the getUTC* family does not
- the local set* family reads AND writes local fields, recomposing through `utcFromLocalSec`
- `toString`/`toDateString`/`toTimeString` render local with the real numeric offset
- a date-TIME with no zone designator parses as LOCAL, while a date-ONLY form stays UTC
- explicit `+HH:MM` / `-HH:MM` offsets are applied; they used to be IGNORED entirely

**`new Date(y, m, d, h, mi, s, ms)` was not implemented at all.** The field form
fell through to the milliseconds path, so `new Date(2020, 4, 17)` produced 2020 ms
past the epoch. It is now the field constructor, and its arguments are local.

`tests/dateLocalTime.js` is deliberately TIMEZONE-INDEPENDENT: it checks
RELATIONSHIPS (the local/UTC field gap equals getTimezoneOffset, the field
constructor round-trips, set-then-get is identity, the no-Z parse differs from the
Z parse by exactly the offset) rather than absolute local values, which would pin
it to whichever machine node ran on. Verified byte-identical to node under
America/Los_Angeles, UTC and Asia/Tokyo, with the same output in all three.

Remaining implementation-defined divergence: `toString` names the zone
`(UTC-07:00)` where node says `(Pacific Daylight Time)`. The numeric offset is
right; naming it needs a tz-NAME lookup that std does not expose.

## A class escape as a range bound rejected valid patterns

`[a-\d]` threw. A class escape is a SET, not a code point, so it cannot be a range
bound: Annex B makes the `-` literal there and keeps the class valid, while the u
flag makes it an early error. milojs read the BACKSLASH itself as the upper bound,
which is code point 92 and below most literals, so the class was rejected as a
reversed range. This is the harmful direction, a valid pattern failing to compile.

`tests/regexpClassEscapeRange.js` pins it, both flag modes, plus the reversed
ranges that must still be rejected.

Still too LENIENT, and left alone for now because accepting an invalid pattern is
the milder failure: `[\d-z]` and `[\w-\s]` should be early errors under the u
flag (the LOW side is the escape, handled in a different branch), `[a-]` should be
one under the v flag, and a duplicate named group in the same alternative
(`(?<a>x)(?<a>y)`) should be a SyntaxError while one across alternatives
(`(?<a>x)|(?<a>y)`) stays legal.

## Date had no TimeClip, and could not read or write an extended year

Three bugs at the ends of the representable range, found from one QuickJS
assertion.

**No TimeClip anywhere.** A time value outside +/-8.64e15 ms is not representable
and becomes NaN. milojs clamped nothing, so `new Date(9e15)`,
`Date.UTC(275760, 8, 14)` and `d.setFullYear(400000)` all produced a Date that
answers impossible milliseconds instead of Invalid Date. `timeClip` now guards the
four paths that write `dateMs`, and also truncates a fractional millisecond toward
zero the way ToIntegerOrInfinity does.

**Extended years could not be parsed.** The ISO year is either four digits or a
SIGN plus six (`+275760`, `-271820`), which is how the spec reaches those ends.
`parseIsoDate` assumed four digits and read every field at an absolute offset, so
every extended-year string was NaN. It now computes the year first and works from
an offset. `-000000` is rejected, as the spec requires.

**Extended years could not be printed.** `toISOString` wrote the year with
`i64ToStr`, so a NEGATIVE year got its sign by accident but a large positive one
came out bare: `275760-09-13T00:00:00.000Z`, which parses back as NaN. Found by
the round-trip case in the fixture, not by the original test.

`tests/dateRangeAndIso.js` covers all three against node.

**Not fixed, and larger than it looks: milojs has no local timezone.**
`getTimezoneOffset()` is always 0, so local time is UTC engine-wide. One visible
consequence is that a date-TIME string with no offset (`2020-05-17T10:20:30`) is
local time per spec and milojs reads it as UTC. The fixture uses only forms
carrying an explicit `Z`, because anything else would compare against the machine
node runs on.

## Comma operator in a computed key and a for-in head, and `using` in a for init

The last of the test262 parse-failure buckets, and all four causes are the same
mistake in different places: an Expression position parsed with `parseExpr`, which
deliberately stops at a comma.

- **A computed key takes a full Expression.** `a[0, 1, 2]` evaluates the sequence
  and indexes by the LAST value. Both index-parsing sites now use `parseCommaSeq`.
- **for-IN's object is an Expression**, so `for (x in null, obj)` is legal.
  for-OF's is an AssignmentExpression and still stops at the comma, so the two are
  handled differently on purpose.
- **`using` is legal in a C-style for init.** `for (using x = res; cond; step)`
  holds the resource for the whole loop; the `Stmt.For` arm now disposes its loop
  scope on exit, next to where the per-iteration scope is already handled.

The three together make `for (using of of [0, 1, 2])` parse, which is the
contextual-keyword pileup test262 uses to check that `using` has not been turned
into a reserved word: `using` is the loop variable, the first `of` is the keyword,
and the second is an array indexed by a sequence.

`tests/sequenceAndUsingHeads.js` covers all of it, including the nested
outer/inner `using` case whose disposal order is
`body, inner_y, inner_x, after-loop, outer_y, outer_x`.

## Binding patterns in a catch parameter and a C-style for init

Two of the three parse-failure buckets in the test262 sample, ~18 cases, and two
different causes.

**`catch ([a, b])` could not be represented.** `Stmt.Try` stores the catch
parameter as a NAME, so a pattern has nowhere to go. Desugared rather than given a
new AST shape, the same move the for-of head already uses: bind the caught value
to a temp and prepend the unpacking declaration to the catch block. `var` in the
catch body still hoists past the block that adds, which the fixture checks.

**`for (const {x:[y]} = o; ...)` was a parser assumption.** A pattern at the head
of a `for` was taken to mean for-in/of, so after parsing the pattern the code
called `parseExpr` unconditionally and choked on the `=`. It now rewinds to the
head and falls through to the C-style path, which already knew how to parse a
destructuring declaration.

`tests/destructuringHeads.js` covers both, plus the for-in/of pattern heads that
had to keep working.

Sweep 101/149 to 102/149; the test262 effect lands on the next sample run.

## `delete null.a` silently succeeded

`delete base.k` on a nullish base returned true and deleted nothing, where the
spec's ToObject step throws a TypeError before any deletion is attempted. Both the
`.k` and `[k]` forms were affected.

The fix has to yield to an already-pending exception, which the first version did
not: `delete super.a` raises a ReferenceError while evaluating the base, and a
blanket TypeError masked it. `tests/deleteOperator.js` covers both, plus the cases
that must keep working (a non-configurable property answering false, an absent
index on a string answering true).

## AsyncDisposableStack, and what the test262 gap is actually made of

`AsyncDisposableStack` was missing entirely, which is 75 test262 cases from one
absent global. Added as the async sibling of the existing `DisposableStack`:
`disposeAsync` returns a promise and awaits each disposer IN TURN, so release
order stays the reverse of acquisition and a slow disposer does not overlap the
next. Resources are collected through `[Symbol.asyncDispose]`, falling back to
`[Symbol.dispose]` for a resource that is only synchronously disposable. A
throwing disposer does not stop the remaining ones and its error still surfaces.
`tests/asyncDisposableStack.js` pins eleven behaviours against node.

**Both test262 sweeps now report their parse split**, the same way the QuickJS one
does, and the answer is different in a way that changes what to work on:

| | scored | pass | parse failures |
|---|---:|---:|---:|
| whole corpus (48735 selected) | 47896 | 36720 (76.7%) | 1172 of 11176 failures (10.5%) |
| published 1500 sample | 1470 | 1144 (77.8%) | 41 of 326 failures (12.6%) |

So roughly 90% of the test262 gap is SEMANTIC, not syntax. That is the opposite of
QuickJS, where a single missing syntax feature took a whole file of 28 cases with
it, and it means the two suites want different work: quickjs rewarded parser
features, test262 will not.

The whole-corpus and 1500-sample rates agreeing to within 1.1 points is also the
first independent check that the committed sample is representative.

## Numeric arguments were coerced without running user `valueOf`

`toNum` cannot re-enter the interpreter, so wherever a built-in coerced an
argument with it, an OBJECT argument silently became 0 (or NaN for a float
target) and the call did the wrong thing without erroring:

```js
new Int32Array([1,2,3]).with(0, {valueOf(){return 7}})[0]   // 0, node 7
[1,2,3].with({valueOf(){return 1}}, 9)                      // 9,2,3, node 1,9,3
[5,6,7].at({valueOf(){return 2}})                           // 5, node 7
new Int32Array([1,2,3]).fill({valueOf(){return 8}})         // 0,0,0, node 8,8,8
```

36 argument coercions in `eval.milo` now use `toNumProg`, which can. The other 24
matches are in functions with no `prog`/`st` in scope (they coerce a receiver or a
radix, not a user-supplied numeric argument) and are left alone.

`TypedArray.prototype.with` needed more than the coercion, and is what
quickjs `bug492.js` is about: converting RUNS user code, which can detach or
resize the buffer underneath the call. Both arguments are now converted first,
the length is snapshotted before conversion, and afterwards the index is
revalidated against BOTH the snapshot and the length as it stands. A partial
shrink is not an error, and the elements that no longer exist read as zero rather
than as stale bytes from the old allocation.

Known quickjs/node disagreement, left as node's answer: detaching during
conversion throws RangeError in node, while `bug492.js` asserts TypeError. node is
this repo's oracle, so that one assertion in bug492 still fails.

`tests/toNumberRunsValueOf.js` pins sixteen of these against node, including the
left-to-right conversion ORDER, which is separately observable.

Sweep 98/149 to 101/149.

## `using` declarations, and the parse gap that was hiding 28 cases

ES2026 explicit resource management is implemented far enough that
`test_language.js` PARSES for the first time, which is what actually mattered: one
missing syntax feature was taking all 28 of that file's cases with it, and they
are the entire reason the sweep looked like it had regressed.

What landed:

- `using x = expr` and `await using x = expr` as declarations, and
  `for (using x of it)` as a loop head (a fourth for-head bind kind: per-iteration
  like `let`, plus disposal at the end of each pass). `using` stays CONTEXTUAL, so
  it remains usable as an ordinary variable name.
- Validation at declaration, which is where the spec puts it: null and undefined
  register nothing, anything else must be an object whose `[Symbol.dispose]` (or
  `[Symbol.asyncDispose]` first, for `await using`) is callable, and the method is
  read exactly ONCE and kept, so a later delete cannot change what runs. A
  throwing getter propagates from the declaration and the body never runs.
- Disposal in reverse order when the scope exits by ANY route. The hook is
  `runDisposals`, called from every place a lexical scope ends: a block, a function
  body, and the try/catch/finally scopes. That last one is easy to miss, and did
  get missed at first: `using` inside a `try` that throws did not release, because
  a try block is not a `Stmt.Block`.
- A pending exception is carried across disposal the way `finally` carries one,
  and a disposer that throws while an error is pending WRAPS it in a
  `SuppressedError`, which is new here too. The engine builds it through
  `__mjSuppress`, captured at prelude load, so reassigning the global or
  `SuppressedError.prototype.constructor` cannot redirect the wrapping.
- `Scope` gained the resource list, and `markScope` marks it: a held resource is
  reachable only from there once its binding is shadowed, and without marking it
  could be collected before its disposer ran.

**Sweep: parse failures are now ZERO**, and the score is 98/149 (65.8%) with every
case actually executing. Against the 109/149 that stood before any of this, the
difference is not a regression: 11 of those were cases that never ran and were
credited anyway.

Known deviation: an async disposer's promise is awaited via `awaitValue` when the
result is thenable, which sequences correctly inside an async function but has not
been checked against the spec's ordering for `await using` at the top level.

## RegExp.escape escaped 18 code points wrongly, and string indexing is quadratic

**Fixed: the escape set.** `RegExp.escape` handled the SyntaxCharacters and the
control escapes but NONE of the ES2025 "other punctuators", nor the space:
` ! " # % & \' , - : ; < = > @ ` ~` all came out literal where the spec requires
`\xNN`. A literal `-` is the dangerous one, since spliced into a character class
it reads as a range. U+00A0 was also emitted as `\u00a0` where below 256 the spec
spells it `\xa0`. Found by diffing every code point against node;
`tests/regexpEscape.js` keeps doing that over 0..0x300.

**Not fixed: `charCodeAt(i)` is O(i), so any scan of a string is quadratic.**
This is what actually makes quickjs's `bug1571.js` and `test_builtin.js:test_rope`
time out, and it is not the accumulator problem the RegExp.escape comment already
solved. Measured on an ALL-ASCII string, where a UTF-16 index equals a byte
offset:

| scan | milojs | node |
|---|---:|---:|
| `charCodeAt` over 10k | 93 ms | 1 ms |
| `charCodeAt` over 40k | 1668 ms | 1 ms |
| `RegExp.escape` of 10k | 155 ms | 0 ms |
| `RegExp.escape` of 100k | 12686 ms | 0 ms |

`utf16Locate` already takes an ASCII fast path, but it reaches it by calling
`firstNonAsciiUpTo(s, idx + 1)`, which rescans from byte 0 on EVERY access. 4x the
length costs 18x the time. The fix is not a better scan, it is somewhere to cache
the answer: a JS string needs a representation carrying its byte length, its
UTF-16 length and an ASCII flag, rather than being a bare Milo `string`. That is
the same representation change rope support needs, so the two should land
together. Loop accumulation (`s += "ab"` 40k times, 263 ms against node's 1 ms) is
the other half of it.

## A syntax error now exits 1, and the sweep counts parse gaps separately

Two changes that belong together, because the first is only publishable with the
second.

**A parse error must not run the program and must not exit 0.** Neither
`runSource` nor the engine entry checked `p.errored` after `parseProgram`, so a
broken script printed its diagnostic to stderr and then executed the half-parsed
wreckage with status 0. node exits 1 and runs nothing. This is the kind of bug a
CI pipeline never notices, because the pipeline is what reads the exit code.

**The sweep now separates "could not parse" from "ran and answered wrong."**
Counting them together is what made this fix look like a 30-point regression the
first two times it was measured: ONE missing syntax feature takes every case in
its file with it, so `using x = {}` alone accounts for all 28 remaining cases in
`test_language.js`. The sweep now reports both numbers, and `qjs-parsefail`,
`qjs-ran` and `qjs-ran-pct` publish them:

```
quickjs-sweep: 81/149 cases pass (54.4%) across 58 files
  28 of those never RAN: the engine could not parse the source. Of the 121 that ran, 81 pass (66.9%).
```

The headline drops from the previously published 73.8% because that figure was
crediting cases whose source the parser had REJECTED: the engine ran the
truncated remainder and, when it happened not to throw, the harness scored it a
pass. Nothing about the engine got worse. What changed is that the measurement
stopped lying, and it now says which half of the gap is a feature and which is a
bug.

Republishing requires a sweep from a CLEAN tree (`tools/gen-facts.mjs` refuses a
report measured on a dirty checkout), so the report lands in its own commit after
this one.

## for-in enumerated shadowed and duplicate names

Two rules of the prototype-chain walk were missing, both visible as wrong output:

- A name already emitted must not repeat. `Object.create({p:1})` with an own
  `p` enumerated `p,p`.
- A NON-enumerable own property still SHADOWS an enumerable one of the same name
  further up the chain, so it has to be recorded even though it is never itself
  emitted. This is the QuickJS case: an own non-enumerable `x` over an inherited
  enumerable `x` enumerated `1,y,x` where node gives `1,y`.

Both come from the same omission, a set of names seen so far, now threaded
through the walk. Dense array indices are deliberately NOT seeded into it:
nothing on `Array.prototype` is an enumerable index, and seeding every index
would make `for (i in bigArray)` quadratic.

`tests/forInEnumeration.js` pins eight shapes against node, including chain
ordering, an all-non-enumerable object, and a null prototype.

**`test_loop.js` now passes in full** (exit 0, no output). It began this session
failing to parse at line 121.

## break and continue were swallowed by `finally` (HANG)

`execTry` captured what try/catch left pending so it could re-raise it after the
finally block, but it only captured `Flow.Ret` and the throw state. `Flow.Break`
and `Flow.Continue` fell through to the trailing `return Flow.Normal`, so

```js
for (;;) { try { break; } finally {} }   // never left the loop
```

hung the engine. Found because `test_loop.js` only started reaching
`test_try_catch5` once its parse gaps closed; the sweep had been killing it with
SIGTERM. Both are now carried across the finally, and a finally that itself
completes abruptly still REPLACES the pending completion, which is checked before
the saved values are restored.

`tests/finallyControlFlow.js` pins ten cases against node, including the
precedence ones: a `continue` in the finally overriding a `break` in the try, a
`return` in the finally overriding a `return` in the try, labeled break out of a
nested loop, and break/continue issued from a catch clause. The pre-fix engine
hangs on that fixture rather than failing it.

## for-in/for-of heads: binding kind and non-identifier targets

`Stmt.ForIn` stored only a NAME, which lost two things at once.

**Binding kind.** Every form got a fresh per-iteration binding, so
`for (var j in o) {}` left `j` undefined after the loop where node reports the
last key, and `for (var w of [1,2])` gave closures separate values where node
shares one. The variants now carry a kind: 0 bare (assign an existing or global
variable), 1 `var` (one hoisted function-scoped binding), 2 `let`/`const` (fresh
per iteration). Only kind 2 calls `scopeDefine` on the iteration scope; 0 and 1
call `scopeAssign` against the enclosing scope, and kind 1 also hoists.

**Non-identifier targets.** `for (a.x in o)`, `for (a.y of it)` and
`for (arr[0] in o)` did not parse at all: only a bare identifier was recognised,
and the failure took the C-style path down with it. The head is now parsed with
`parsePostfix`, which stops before `in` (where `parseExpr` would take it as a
relational operator), then desugared to the temp form the destructuring head
already used: `for (a.x in o) BODY` becomes `for (__t in o) { a.x = __t; BODY }`.

**Annex B `for (var k = 2 in o)`.** Legal in sloppy code and used by
`test_loop.js`. This needed the grammar's NoIn variant, now a `noIn` flag on
PState that gates the binary `in` operator, because `parseExpr` was otherwise
parsing `2 in o` as a relational expression and then finding `)` where it wanted
`;`. The initializer really runs; it is only invisible when a first key
overwrites it.

`tests/forInOfBinding.js` pins all of it against node.

**test_loop.js now parses completely**, and the two cases it loses are real
engine bugs that the parse failure had been hiding, not regressions:

- `test_for_in` enumerates `1,y,x` where node gives `1,y`. A property deleted
  during enumeration is still being visited.
- `test_try_catch5` HANGS (the sweep kills it). Not yet diagnosed.

The sweep reads 95/149 against 109 before this work started. Every case lost is
one that previously never executed; see the entry below for why that number is
measuring truncation rather than the engine, and why the report has not been
regenerated.

## Three parser/lexer gaps closed, and why the QuickJS number went DOWN

All three came out of the 45 QuickJS cases recorded below as never having parsed.
Each is verified byte-for-byte against node by
`tests/parserContextualAndNumbers.js`.

1. **`get` / `set` / `async` / `static` as class member names.** They are
   contextual keywords; the parser committed to an accessor or modifier on seeing
   the word and then failed on the `=`, so `class P { get; set = () => 1; }` did
   not parse. Guarded by `classWordIsFieldName`: the word is a NAME when the next
   token ends the member (`;`, `}`) or starts an initializer (`=`), and for
   `static` also when it is `(`.
2. **A sequence expression in a template hole.** `` `aaa${a, b}ccc` ``.
   `parseExpr` deliberately stops at a comma, so the hole now uses
   `parseCommaSeq`, which is what already backs `(a, b)` and for-init.
3. **Legacy octal literals.** Two bugs in one: `0777` evaluated as 777 rather
   than 511 because the digits went through the decimal path, and the `.` in
   `01.a` was eaten as a decimal point instead of being a property read. A
   leading zero containing an 8 or 9 (`08`, `09`) is decimal and stays so.

**The sweep went 109/149 to 97/149, and that is an ARTIFACT, not a regression.**
All 12 lost cases are in `test_language.js` and all 12 report the same single
unimplemented feature, `using x = {}` (ES2026 explicit resource management). The
mechanism: the harness runs a file once per test case, and after the FIRST parse
error the rest of the file is wreckage. Fixing gaps 1-3 moved that first error
from line 366 to roughly line 700, so more of the file now parses, more test
functions are defined and actually RUN, and whether the truncated remainder
happens to throw at runtime is what the sweep is really measuring for this file.
It is not measuring the engine.

The report in `docs/conformance/quickjs.json` was deliberately NOT regenerated for
this commit, so the published 73.8% is untouched. Republishing 65.1% would record
a decline that did not happen, and the honest number cannot be produced until
`using` lands and the `p.errored` check below goes in together with it.

## Deep expression nesting: crash fixed, and two things it uncovered

**Fixed.** The recursive-descent parser had no depth bound. Nested `[[[...]]]`
bus-errored (exit 138) at about 5330 levels; node raises a catchable error
instead. `parseExpr` is now a depth-guarded wrapper around `parseExprInner`, with
`PARSE_DEPTH_LIMIT` at 4000. Measured limits on the same machine, for why 4000:

| | milojs | node |
|---|---|---|
| parse only | 5330 | 3621 |
| parse and evaluate | 5330 | 2791 |

so the guard sits above everything node accepts and below where this parser
faults. `tests/deepNesting.js` covers it and matches node byte for byte; the
pre-fix engine printed NOTHING for that fixture and exited 0.

One trap in the guard itself: the first version returned a placeholder without
consuming input, which left the unconsumed brackets in front of every enclosing
loop and turned the crash into an infinite HANG. It now jumps `p.pos` to EOF,
which is the single move that unwinds every parse loop at once.

**Uncovered 1: a syntax error exits 0 and runs anyway.** Neither `runSource`
(driver.milo) nor the engine entry checks `p.errored` after `parseProgram`, so a
broken script prints its parse error to stderr and then executes the half-parsed
program with exit status 0. node exits 1 and runs nothing. NOT FIXED HERE, on
purpose: see below.

**Uncovered 2: the QuickJS score counts 45 cases that never parsed.** Adding the
`p.errored` check above drops the sweep from 109/149 (73.2%) to 64/149 (43.0%).
Those 45 cases are not new failures; they are cases where the parser rejected the
source and the engine ran the wreckage anyway and still printed the right answer.
All 45 come from two real gaps, in two files:

- `test_language.js` (28 cases): a class field NAMED with a contextual keyword,
  `get = () => 123`. The parser commits to a getter method on seeing `get` and
  then finds `=>`. Same for `set` and `async`.
- `test_loop.js` (17 cases): `for (a.x in obj)`, a for-in whose target is a
  member expression. `Stmt.ForIn(string, ExprId, StmtId)` stores a NAME, so the
  AST cannot represent this at all; fixing it means widening the target to an
  lvalue expression, as `Stmt.For` already has.

Order matters here: fix those two gaps FIRST, then land the `p.errored` check, so
the honest number goes up rather than down. Landing the check alone would publish
a 30-point drop that is a measurement correction, not a regression, and would
report the engine as worse when nothing about it changed.

## Dispatcher frame size, and the two things that measured

`evalExprFallback` reserved about 11.9 KB of stack per call
(`sub sp, sp, #0x2, lsl #12` plus `#0xdf0`) against `evalExpr`'s ~800 bytes, because
a function reserves the sum of every arm's locals. Every `x = ...`, `x++`, `o.x`
and `o[k]` reached it. Two changes followed, and they paid in different currencies.

**Speed, from routing hot nodes around it.** Assign/Update, then Member/Index,
moved to the front dispatcher as small helpers. Measured against a pinned
baseline: propFew -27%, localRead -22%, arith -19%, and every other bench
between -5% and -19%.

One trap worth keeping: binding the arm payloads in the front dispatcher
(`Expr.Member(objIdx, name) => ...`) grew `evalExpr`'s own frame from 128 to 736
bytes, which EVERY expression then paid, and non-property benches regressed ~2%.
Matching with `_` and re-matching inside the helper keeps the front frame at 128
and the regression disappears.

**Nesting depth, from shrinking the frame itself.** Lifting the three largest
remaining arms out (Bin, Un, New) took the fallback from 9264 to ~2.9 KB. Wall
time is a wash, but the maximum nested-expression depth roughly TRIPLES:

```sh
# deepest `[[[...1...]]]` that still runs
1767 before, 5281 after
```

ObjLit and SetMember were tried in the same pass and REVERTED. Unlike Bin/Un/New
they are reached only through the fallback, so extracting them added a real call
to a hot node: objChurn regressed 3-5% for no further depth. Extraction pays only
where the node either is not hot or already made the call.

**Still open: deep nesting CRASHES rather than throwing.** At the limit the engine
dies with SIGBUS (exit 138), before and after; node raises a catchable error. The
change moves the cliff out 3x, it does not add a guard. A depth check on the
expression recursion is the real fix.

**Also rejected: a discriminator tag on `Binding`.** Storing `(len << 8) | first
byte` beside each name to skip the `memcmp` in scope scans measured as noise
(-1.3% to +5.7%, objChurn worst). The reason is that Milo's string `==` ALREADY
short-circuits on length, so the tag only helps a same-length miss, while the
`memcmp` samples in a profile are mostly HITS, which no pre-filter can avoid.
Making scope identity an integer (interning) or removing the lookup (lexical
addressing) are the shapes that would work.

## Interpreter allocation churn: what a profile says, and one dead end

A `sample`-based profile of `bench/arith.js` (pure arithmetic, no property access,
no strings) attributes roughly a third of samples to malloc/free/`drop`/`cloneValue`
and only about a tenth to the string compares in scope lookup. The gap to bun in
`bench/run.sh` is not one mechanism; it is per-node dispatch plus allocator
traffic on owned values. (That gap reads 300-2600x since the harness stopped
clamping bun's sub-millisecond times to 1 ms; the 30-400x figures this entry was
first written against were the clamp, not the engine.) Reproduce with:

```sh
tools/dev.sh                                    # build .dev/mj-engine
.dev/mj-engine bench/arith.js & sample $! 6 1 -mayDie
```

**Landed:** `scopeAssign` took its `name` by value, so every caller cloned the
identifier string, and the hit path replaced the whole `Binding` (dropping the old
name and moving an identical one back in). Borrowing the name and writing only the
`value` field is worth 5-10% on every bench in `bench/`.

**Tried and rejected: the same change to `objSet`/`setMember`.** Borrowing `key`
forces the overwrite path to assign fields individually rather than store one
`Prop`, because a borrowed key cannot be moved into a struct literal. That is
SLOWER: measured +1.5% on `propWrite` and +3.5% on `propWriteNew`. The cause is
that `&mut` is second-class in Milo to the point of being ungrammatical in a `let`

```milo
let p = &mut h.ps[0]    // error: unexpected token 'mut'
```

so there is no way to hoist a reference to the element, and each field write
re-walks `st.objects[obj].props[i]`. One struct store beats four field stores.
Do not retry this shape as written.

The version that would work is interning property keys to an integer id: with a
scalar key there is no string to clone, the single struct store stays, and the
call sites stop cloning. Note the win is the ALLOCATION, not the lookup, since
`propFew` vs `propMany` prices ~27 extra string compares per read at only ~120 ms
per million reads. `bench/propWrite.js` and `bench/propWriteNew.js` were added to
cover the write path, which the suite previously did not exercise at all.

## Measured conformance

Both sweeps need a local corpus (`TEST262=`, `~/git/quickjs/tests`), so these are
run by hand rather than in CI:

| sweep | score | measured |
|---|---:|---|
| test262, <!--fact:t262-sample-->1500<!--/fact-->-case deterministic sample | <!--fact:t262-pass-->1169<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact--> = **<!--fact:t262-pct-->79.5%<!--/fact-->** | 2026-08-15 |
| QuickJS `tests/` at `<!--fact:qjs-corpus-->ef7a3a74<!--/fact-->` | <!--fact:qjs-pass-->102<!--/fact-->/<!--fact:qjs-total-->149<!--/fact--> = **<!--fact:qjs-pct-->68.5%<!--/fact-->** | 2026-08-15 |

Movement on 2026-08-15: the engine now runs the program on a green task, so
generators work there (they threw "generators require the milojs runtime"
before). test262 508→539 (34.6%→36.7%) and QuickJS 95→97 (63.8%→65.1%). Only
31 of the 104 generator-blocked cases converted; the rest need `gen.throw()` /
`gen.return()` and async generators, none of which exist yet.

Denominators move between runs as cases start or stop being scored — compare
the numerator and the fraction from the same table row, not across rows. The
`96/166` and `473/1476` rows this replaced were 2026-07-24/30 measurements.

### The whole-corpus sweep, and what it says to work on next — 2026-08-16

The published headline is the 1500-case sample; the sweep also runs unfiltered
(`bun scripts/test262-sweep.ts` with no `--sample`, ~48.7k cases, about 12
minutes). Doing that once was worth more than any single fix this round, because
the sample is too thin to rank causes. Grouping the whole corpus by failure
REASON turned three vague symptom clusters into single defects:

| bucket | cases | what it actually was |
|---|---:|---|
| `m`/`name`/`length` descriptor should be configurable | 726 | `delete` on a FUNCTION property was a silent no-op that still answered true, so the harness's `isConfigurable()` probe (delete, then check hasOwnProperty) failed on every class static method and every built-in |
| `asyncTest called without async flag` | 262 | a top-level binding was not an own property of globalThis, so `hasOwnProperty(globalThis, "$DONE")` denied it and the async harness refused to run |
| `Built-in objects must be extensible` | 128 | `Object.isExtensible` used `objHandle`, which answers -1 for a function, so every built-in reported itself non-extensible |

Whole corpus over the round: **28511 → 29726 of 47896 (59.5% → 62.1%)**, no
newly failing case at any step. Sample: 856 → 910 of 1470.

Two lessons worth keeping:

- **`-f` does not exist.** `scripts/test262-sweep.ts` parses `--sample`,
  `--dir`, `--limit` and `--json` only; a stray `-f built-ins/Object` was
  ignored and ran the whole corpus. That accident is what produced this table,
  but `docs/conformance-reports.md` still advertises `-f` and should not.
- Two of the four regressions this round were invisible to the sample and to
  every gate; only diffing failure SETS between sweeps found them.

### Ranked next, by measured case count (whole corpus, 2026-08-16)

1. **Temporal is the largest single area**: 2671 failures, 35% passing. The
   biggest pieces are plain missing methods, each with its own test directory:
   `Duration.prototype.round` (77), `Duration.prototype.total` (52),
   `toZonedDateTime` (41, across PlainDate/PlainDateTime), `withPlainTime` (34,
   PlainDateTime/ZonedDateTime), plus `withCalendar`, `toPlainYearMonth`,
   `toPlainMonthDay` and a `constructor` property on every Temporal prototype.
   Node has no Temporal, so test262 is the only oracle here.
2. **`with` is not implemented** — 222 cases fail with `with is not defined`.
   Needs an object-backed scope in the identifier lookup path.
3. **annexB String HTML methods** (`anchor`, `big`, `blink`, …) are absent —
   ~45 cases, and cheap: they are one-line JS each.
4. **`Function.prototype` has no own `name`/`length`** (it is `""`/`0` in node,
   and `delete f.name` must fall through to it).
5. Atomics/SharedArrayBuffer (380, 0%) and ShadowRealm (48) are host features,
   not engine bugs; `built-ins/Iterator`'s remaining failures are mostly stage-2
   proposals (`zip`, `zipKeyed`, `concat`, `chunks`, `windows`) that node does
   not have either.

### Duplicate declarations are now an early error — 2026-08-16

`let x; let x;` and `let x; var x;` are SyntaxErrors before anything runs, as in
node. `checkDupDecls` in the parser walks the statement list of a block (and of
the program) and rejects a name declared twice when either declaration is
lexical; a `var` or function declaration redeclared by itself is left alone,
which is what keeps sloppy-mode `function f(){} function f(){}` legal. Only the
statements at one level are examined, so two sibling `for (let i…)` loops do not
collide.

**It did not move the score, and that was measurable in advance**: test262's
redeclaration tests are `negative: {phase: parse}` cases that call
`$DONOTEVALUATE()`, and the sweep counts any throw as a pass for a parse-phase
negative — so all 64 switch-scope cases and their siblings already "passed" by
throwing a ReferenceError for the missing helper. Correctness gained, number
unmoved. Locked by `tests/duplicateDeclarations.js`.

### The buffer family got real prototypes — 2026-08-15

`Int8Array.prototype`, `ArrayBuffer.prototype` and `DataView.prototype` were all
**undefined**: typed arrays were pure name dispatch, with the methods existing
only as a whitelist checked on the property path. Nothing in this repo noticed,
because milojs's own fixtures only ever call methods on instances.

test262 notices immediately. `testTypedArray.js` opens with
`var TypedArray = Object.getPrototypeOf(Int8Array)` and reads
`TypedArray.prototype` for nearly every assertion, and its resizable-buffer
section starts with `if (ArrayBuffer.prototype.resize)`. Both read a property of
undefined, so **all 1446 cases threw before running a line of their own** — the
`built-ins/TypedArray` 0% in the old table was one missing object, not 1446 bugs.

Now built the way Array.prototype already was: a `%TypedArray%` intrinsic whose
`prototype` carries every shared method as an UNBOUND bound-method (so the call
site's receiver wins and `TypedArray.prototype.map.call(ta, fn)` resolves), each
concrete constructor's `prototype` chaining to it, and the native's property bag
`proto` pointing at `%TypedArray%` — which is what makes
`Object.getPrototypeOf(Int8Array)` return it. Plus `BYTES_PER_ELEMENT`, `name`,
`constructor`, and `@@toStringTag` for the whole family.

| area | before | after |
|---|---:|---:|
| `built-ins/TypedArray` | 0/1446 = 0% | **149/1446 = 10.3%** |
| `built-ins/TypedArrayConstructors` | 29/738 = 3.9% | **134/738 = 18.2%** |
| `built-ins/DataView` | 137/561 = 24.4% | **153/561 = 27.3%** |
| `built-ins/ArrayBuffer` | 43/221 = 19.5% | 43/221 = 19.5% |

Locked by `tests/typedArrayPrototypes.js`.

### Every remaining constructor got a prototype — 2026-08-15

A probe over all 21 built-in constructors found **seven with no prototype object
at all**: Number, Boolean, Symbol, BigInt, Map, Set and Promise. Same gap as the
buffer family, Date and RegExp, so this sweep finishes the pattern — every
constructor now has one, built by a shared `buildNativeProto`, with Map/Set/
Promise instances linked to theirs.

Promise needed its own step: its global binding is a plain OBJECT, not a
`JSValue.Native`, so a prototype hung off the `NATIVE_PROMISE` bag is
unreachable from it. The link is made in `setupRemainingProtos`, which runs
after `setupGlobals` has built that object — attaching it earlier silently did
nothing, because `st.promiseProtoObj` was still -1.

Two more bugs came out of it:

- **A primitive receiver reaching a built-in method value** fell through to the
  generic object tag: `Number.prototype.toString.call(255, 16)` returned
  `"[object Number]"` instead of `"ff"`, and likewise for Boolean and BigInt.
- **Assignment to a native constructor's property ignored writability.** The
  `JSValue.Native` branch of SetMember called `objSet` unconditionally, so
  `Boolean.prototype = x` replaced it even though a built-in `prototype` is
  `{writable: false, enumerable: false, configurable: false}`. Found because
  test262's `verifyNotWritable` assigns and re-reads rather than trusting the
  descriptor — the descriptor was already right.

| area | before | after |
|---|---:|---:|
| `built-ins/Number` | 160/340 = 47.1% | **184/340 = 54.1%** |
| `built-ins/Boolean` | 24/51 = 47.1% | 22/51 = 43.1% |

Whole-suite 1500-sample 655 → 660. Locked by `tests/builtinPrototypes.js`.

**Boolean went DOWN by 2, and that is real.** Four cases that used to fail on
"prototype is undefined" now fail on stricter checks, against one newly passing.
The two still outstanding need `isConstructor` semantics —
`new Boolean.prototype.toString()` must throw a TypeError, and built-in methods
are not constructors here. Related and also unfixed: `Number.prototype` and
`Boolean.prototype` should be a Number/Boolean OBJECT wrapping 0/false, not a
plain object, so `Boolean.prototype.toString()` should return `"false"`.

**Sweep timing note:** `built-ins/Map` and `built-ins/Set` take far longer than
their case counts suggest — the sweep allows 10s per case, so a directory with
many slow or hanging cases stalls for many minutes. Neither was measured this
round. Worth finding the slow case before relying on those numbers.

### RegExp — 2026-08-15

`RegExp.prototype` did not exist. Same shape of gap as the buffer family and
Date, and by now a recognisable pattern: **a constructor with no prototype
object.** Instances carried `source`, `flags`, `global` and `lastIndex` and
nothing else — `.ignoreCase`, `.multiline`, `.sticky`, `.unicode`, `.dotAll`,
`.hasIndices`, `.unicodeSets` all read `undefined`, and `undefined` is not
`false`.

Now built: a real prototype with `exec`/`test`/`toString`/`compile`, the flag
family as accessors (registered under an internal `__reGet_*` name so an
instance's own data property still wins on a normal read — this engine resolves
flags on the instance, the spec puts them on the prototype, and both can hold),
`Symbol.match`/`matchAll`/`replace`/`search`/`split` — which did not exist as
symbols at all — and instances linked to it.

Three separate pre-existing bugs surfaced while building it:

- **`/ab/gi.toString()` returned `undefined`.** `toString` was listed in
  `isRegexMethodName` but `regexMethod` had no branch for it.
- **`RegExp.prototype.compile` did not exist.**
- **`String.prototype.match.call(s, /re/)` returned `undefined`** while
  `s.match(/re/)` worked, and `String.prototype.split.call(s, /,/)` returned the
  string unsplit. The regex-taking String operations lived only on `evalExpr`'s
  method-call path; `callBuiltinByName` goes straight to `stringMethod`, which
  knows nothing about regexes. Both paths now share `stringRegexOp`. This is the
  same class of bug as the uncurry-this one — a second dispatch path that never
  learned what the first one knows.

| area | before | after |
|---|---:|---:|
| `built-ins/RegExp` | 605/1879 = 32.2% | **724/1879 = 38.5%** |

+119 cases. Whole-suite 1500-sample 653 → 655. Locked by
`tests/regexpSurface.js`.

The `@@match`/`@@replace`/`@@split` implementations delegate to the String
methods, which is the reverse of the spec's direction (String delegates to the
symbol). That is fine while nothing overrides them, and wrong for a user subclass
that redefines `@@match` — worth inverting if subclassed regexes ever matter.

### Date — 2026-08-15

`Date.prototype` carried 20 of node's 47 methods. Most of the gap was not
missing behaviour: the whole `set*` / `setUTC*` family was already implemented
inside `dateMethod` and simply never listed on the prototype. Added the rest of
the list, plus `toTimeString`, `toGMTString`, `getYear`, `setYear`,
`toUTCString` in its real RFC 7231 form, and `toLocale*` in node's default
en-US shape (all of these previously returned the ISO string).

**Date also disagreed with itself.** The local getters decomposed in the HOST
timezone (`DateTime.fromEpochLocal`), while the setters decomposed in UTC and
`getTimezoneOffset` reported 0. So `d.setHours(d.getHours())` shifted the date
by the host offset, and `getHours()` returned 3 where `getUTCHours()` returned
10. Everything is UTC now, which makes milojs behave as node run under
`TZ=UTC`. That is a deliberate simplification, not a fix in disguise: std
exposes `localtime_r` but no `mktime`, so a correct LOCAL setter family is not
expressible today — and a half-local Date is worse than a consistent UTC one.
Anyone adding a timezone database must do the getters and setters together.

Also: built-in CONSTRUCTORS had no own `name`/`length` (`Date.length` was
undefined) — they are bound with `scopeDefine` rather than hung off a namespace
object, so the `nameNativesOf` pass never reached them. There is now a
`builtinCtorArity` table, generated from node like the other two. `Date.parse`
is the one static whose name collides across namespaces (`JSON.parse` is 2), so
it is set explicitly after the namespace pass.

| area | before | after |
|---|---:|---:|
| `built-ins/Date` | 137/594 = 23.1% | **209/594 = 35.2%** |

Whole-suite 1500-sample 649 → 653. Locked by `tests/dateSurface.js`, which
asserts only the TZ-independent surface — the local-time forms cannot be pinned,
since node's output for them depends on where the capture ran.

`toLocale*` is en-US only and ignores any argument; real `Intl` support is not
modelled.

### The uncurry-this idiom, and `name`/`length` on built-ins — 2026-08-15

**The single highest-leverage bug found so far.**
`Function.prototype.call.bind(f)` — the uncurry-this idiom, which turns a method
into a standalone function taking the receiver as its first argument — returned
`undefined` whenever `f` was a BUILT-IN. A plain JS function worked, which is
why it went unnoticed. The uncurried call arrives at `callBuiltinByName` as
receiver = the built-in, name = `"call"`, and nothing handled that case.

test262's `propertyHelper.js` opens with
`var __hasOwnProperty = Function.prototype.call.bind(Object.prototype.hasOwnProperty)`
and four more like it, so **every `verifyProperty` test in the suite failed
before it looked at any property** — which is why the "name/length should be an
own property" buckets refused to move in the previous attempt no matter how
correct the descriptors were made.

Alongside it, built-ins now carry own `name` AND `length` with the spec's
`{writable: false, enumerable: false, configurable: true}`. The arity tables
(`builtinArity`, `builtinStaticArity` in `src/engine/eval.milo`) are **generated from
node** — it is the oracle for this too. Two tables, because the same name can
differ: `Object.keys` is 1 while `Array.prototype.keys` is 0. Across every
prototype only three names disagree internally — `constructor` (excluded),
`toString` (Number's is 1, everything else 0) and `set` (Map's is 2,
%TypedArray%'s is 1); the commoner value wins for those two. To regenerate,
walk the prototypes and constructors in node reading
`Object.getOwnPropertyDescriptor(p, k).value.length`.

Date instances also now link `Date.prototype` (`Object.getPrototypeOf(new Date())`
was not `Date.prototype`).

| area | before | after |
|---|---:|---:|
| `built-ins/Object` | 1350/3411 = 39.6% | **1649/3411 = 48.3%** |
| `built-ins/Array` | 1672/3082 = 54.3% | **1783/3082 = 57.9%** |
| `built-ins/TypedArray` | 248/1446 = 17.2% | **339/1446 = 23.4%** |
| `built-ins/String` | 468/1223 = 38.3% | **560/1223 = 45.8%** |
| `built-ins/Date` | 87/594 = 14.6% | **137/594 = 23.1%** |

**+644 cases** across those five. Whole-suite 1500-sample 615 → 649
(41.8% → 44.1%). Locked by `tests/builtinFunctionShape.js`.

`Date.prototype` still has 20 of node's 47 methods — the whole `setX`,
`getUTCX` and `setUTCX` families are missing, which is most of what is left in
`built-ins/Date`.

### The rest of %TypedArray%.prototype, and detached views — 2026-08-15

Added the methods that were simply missing: `copyWithin`, `lastIndexOf`,
`keys`/`values`/`entries`, `toReversed`, `toSorted`, `toLocaleString`, and
`[Symbol.iterator]`.

More interesting: **detachment was tracked on the ArrayBuffer but no view ever
consulted it.** After `buffer.transfer()` a view still reported its old
`length`, still `fill`ed, and still read its stale bytes. Views now behave as
the spec says — zero for `length`/`byteLength`/`byteOffset`, `undefined` at
every index, a dropped write, and a TypeError from every prototype method.

**And a harness bug that was inflating the failure count.**
`scripts/test262-sweep.ts` never provided `$262`, the host object test262
expects a *runner* to supply. Every detached-buffer case died on
`$262 is not defined` before asking the engine anything, and was counted as an
engine failure. The sweep now injects it, with `detachArrayBuffer` going through
`ArrayBuffer.prototype.transfer`.

Attribution, measured by running the new sweep against the PREVIOUS engine:

| area | before | harness only | + engine work |
|---|---:|---:|---:|
| `built-ins/TypedArray` | 191/1446 = 13.2% | 200 = 13.8% | **248/1446 = 17.2%** |
| `built-ins/DataView` | 186/561 = 33.2% | 225 = 40.1% | 225/561 = 40.1% |
| `built-ins/ArrayBuffer` | 58/221 = 26.2% | — | 63/221 = 28.5% |

So DataView's **entire** +39 is the harness fix — the engine contributed
nothing there, and that number was previously understated rather than wrong.
TypedArray is +9 harness and **+48 engine**. Whole-suite 1500-sample 608 → 615.
Locked by `tests/typedArrayMethods2.js`.

**Still the top TypedArray blocker: `BigInt64Array`/`BigUint64Array`, 544
cases.** Now scoped properly: `taLoad`/`taStore`/`taElem`/`taSetElem` are all
`f64`-typed, and f64 cannot hold a 64-bit integer exactly, so this is not a new
`TA_*` kind plus a width — it needs a parallel `JSValue`-returning element path
threaded through all ~30 prototype methods. Also note `NATIVE_TA_BASE` is 79
with ids 79..87 used and 88 taken by `NATIVE_HTTP_FETCH`, so the base has to
move to a free range before two more kinds can be added.

### Static accessors, and static inheritance — 2026-08-15

`static get` / `static set` did not work **at all**. A class's statics live in a
per-function object, and every path that touched it used the non-invoking
`getMember`/`objSet`/`setMember` — so a getter was returned as a data property
(i.e. never called, reading `undefined`) and a setter was silently overwritten
by the assigned value. Instance accessors were fine, which is why this survived:
nothing in this repo uses a static one.

Fixed on all four paths — read, method-call, write, and the compound-assignment
lvalue reads — by moving to `getMemberDyn` / `setMemberDyn`. Three related bugs
came out of the fixture while writing it:

- **Statics were not inherited.** `class D extends B {}` linked only the
  instance prototype; `D.staticOfB` was undefined. The statics object now
  chains to the base's.
- **An own static named `call`/`apply`/`bind` lost to `Function.prototype`.**
  `class C { static call() {} }` then `C.call()` ran `Function.prototype.call`
  and returned undefined. An own static now wins; a class without one still
  gets `Function.prototype`'s.
- **`C.#priv++` on a static private field did not increment**, for the same
  accessor-blind lvalue read.

| area | before | after |
|---|---:|---:|
| `language/statements/class` | 1680/4361 = 38.5% | **1926/4361 = 44.2%** |
| `language/expressions/class` | 1560/4052 = 38.5% | **1806/4052 = 44.6%** |

+492 cases. Whole-suite 1500-sample 588 → 608 (40.0% → 41.4%). Locked by
`tests/staticAccessors.js`.

### Built-in function `name` — 2026-08-15, correct but did NOT move the number

Every bound-method built-in now carries an own `name` with the spec's
`{writable: false, enumerable: false, configurable: true}`, matching node's
descriptor exactly, and each native reachable as a method of a namespace
(`Math`, `JSON`, `Object`, `Array`, `String`, `Date`, `Promise`) gets its name
from the key it is registered under — a per-namespace pass, since a native's
properties live in a shared per-id bag with nowhere to put a name at the ~145
individual registration sites. 39 prelude function expressions written as
`X.y = function (…)` were also given names.

The test262 `name should be an own property` bucket did **not** move (19 before
and after). The sampled cases target function values that have no own-property
bag at all — `Object.getOwnPropertyNames(Math.cosh)` returns `[]` here versus
`["length","name"]` in node — so `name` reads correctly but is not an own
property. Making JS functions and natives carry real property bags is the
prerequisite, and it also gates the `length.js` half, which additionally needs a
per-method arity table. Kept because it is a genuine fidelity improvement and
costs nothing; recorded here so nobody re-measures it expecting a win.

### Receiver brand checks — 2026-08-15

Built-in methods are dispatched by NAME here, which is correct for
`Array.prototype` (genuinely generic in ES) and wrong for the buffer family
(node throws a TypeError when `this` is the wrong kind). So
`Int8Array.prototype.join.call([1, 2], '-')` returned `"1-2"` instead of
throwing, and `ArrayBuffer.prototype.slice.call({})` returned an object.

A bound method built for `%TypedArray%` / `ArrayBuffer` / `DataView` now records
a `boundBrand` and checks the receiver before dispatching — at both call sites
(plain invocation and `.call`/`.apply`), and the brand survives `bind()`. Also
added `ArrayBuffer.isView`.

| area | before | after |
|---|---:|---:|
| `built-ins/DataView` | 153/561 = 27.3% | **186/561 = 33.2%** |
| `built-ins/ArrayBuffer` | 43/221 = 19.5% | **58/221 = 26.2%** |
| `built-ins/TypedArray` | 149/1446 = 10.3% | **191/1446 = 13.2%** |

Locked by `tests/bufferBrandChecks.js`. Still missing on ArrayBuffer:
`Symbol.species`, and `name`/`length` on native constructors generally
(`ArrayBuffer.name` is undefined) — the latter is the "should be an own
property" bucket, ~42 cases suite-wide across all builtins.

**Next in this cluster, in order of size:**
1. **`BigInt64Array` / `BigUint64Array` do not exist** — now the top bucket in
   `built-ins/TypedArray` at **538 cases**. Needs two new `TA_*` kinds at width
   8 and, more invasively, element access that yields a `JSValue.BigInt` rather
   than an f64: `taElem` returns f64 today and every typed-array method is
   written against that.
2. `ArrayBuffer` did not move at all (19.5%) — its own prototype exists now, but
   `maxByteLength`/`resizable`/`detached` accessors and the options-bag
   constructor are still missing.
3. Property descriptors: `length`/`name` "should be an own property" is ~42
   cases suite-wide, across all builtins, not just this cluster.

Weakest areas (before this change): `built-ins/TypedArray` 0%, `ArrayBuffer` 0%, `Atomics` 0%,
`language/eval-code` 0%, `Temporal` 1%, `TypedArrayConstructors` 5%, `Map` 14%.
Strongest: `language/block-scope` 100%, `literals` 77%, `identifiers` 75%.

### Open, in rough value order

- **`gen.throw()` / `gen.return()`** — DONE 2026-08-15. `genResume(o, args,
  mode, st)` drives the parked body for all three completions; `genYield` reads
  the mode at its resume point. `return(v)` unwinds on the throw machinery with
  a separate per-task `genReturning` flag (in `ExecCtx`, so it is saved and
  restored across a park like `throwing`): `execTryBody` will not let a `catch`
  intercept it, `execTry` carries it across `finally`, and `genFinish` turns it
  back into a normal completion. Also implemented alongside it:
  - **IteratorClose** — for-of abandoned by break/return/a throw out of the body
    now calls the iterator's `return()`, which is what runs a generator's
    `finally`. An error from `return()` is discarded if the loop was already
    unwinding, as in node.
  - **`yield*` forwards completions inward** — throw()/return() reaching a
    delegating generator go to the INNER iterator first, so its catch/finally
    runs and whatever it does continues outward. Both the generator and the
    hand-rolled-iterator delegation paths. This also gave `yield*` two-way
    `next(v)` threading, which it never had.

  Measured on test262 (whole-suite 1500-sample moved only 539→540 — it is thin
  here, so these are the directories that matter):
  `built-ins/GeneratorPrototype` **26.2% → 75.4%**,
  `language/expressions/yield` **41.3% → 57.1%**,
  `language/statements/for-of` **50.5% → 51.4%**. QuickJS 97→98/149.
  `language/statements/generators` did not move (48.9%), and is where the
  remaining generator work is. Locked by `tests/generatorCompletions.js`.

- **No duplicate-declaration check** — DONE 2026-08-16, see the section above.
- **Async generators** — DONE 2026-08-15 (with one open limitation, below).
  `async function*` is now a generator first: `callFunction` builds the
  generator object BEFORE the activation-spawn branch, which used to swallow it
  and hand back a promise. The body still awaits, because it runs on its own
  green task and that is all `parkOnPromise` needs. `next`/`throw`/`return` wrap
  each step in a promise (`genResumeAsync`), and the async return-wrapping in
  `callFunction` is skipped for a generator body — it was turning `return v`
  into `{value: Promise, done: true}` and hiding a throw from `genFinish`.
  `for await (… of …)` parses (a bool on `Stmt.ForOf`) and prefers
  `Symbol.asyncIterator`; over a plain sync iterable it awaits each VALUE
  instead, per CreateAsyncFromSyncIterator. The ~200-line `await`
  implementation was factored out of the Unary branch into `awaitValue` so
  for-await reuses it rather than growing a second copy.

  test262, before → after:
  `language/statements/for-await-of` **47.9% → 91.0%** (+532 cases),
  `language/expressions/async-generator` **14.1% → 43.3%** (+182),
  `language/statements/async-generator` **11.3% → 40.5%** (+88),
  `built-ins/AsyncGeneratorPrototype` **0% → 41.7%** (+20).
  Whole-suite 1500-sample 540 → 577 (36.7% → 39.3%).
  Locked by `tests/asyncGenerators.js`.

- **OPEN, and the one thing that can HANG: `next()` on an async generator drives
  the body instead of scheduling it.** node returns a *pending* promise
  immediately and runs the body afterwards; `genResumeAsync` parks the caller,
  drives the body to its next yield, and returns an already-settled promise.
  Values are always identical, but interleaving differs whenever two async
  functions are in flight — and it deadlocks in one shape: a caller that invokes
  `next()` WITHOUT awaiting it, where the body then awaits a promise that only
  settles after `next()` returns. Nothing is runnable and the process hangs.
  QuickJS `bug1355.js` is exactly this (it was a parse error before async
  generators existed, so nothing that previously worked regressed).

  The fix is to stop driving the body from the caller: `next()` should register
  a pending promise, unpark the body task, and return without parking, letting
  the body settle that promise when it reaches its yield. That needs a per-
  generator queue of pending requests, since node queues concurrent `next()`
  calls, and `runEventLoop` must count a live async generator body as work.

  **This was attempted on 2026-08-15 and reverted — read this before trying
  again.** The queue itself worked: a FIFO of (generator, promise, mode, arg)
  in `Interp` (marked by `collect`, since nothing else roots the promise or the
  send value), `asyncGenRequest` enqueueing and returning a pending promise
  without parking, `asyncGenYield` settling the served request and either
  picking up the next queued one or parking, and `asyncGenFinish` draining the
  rest. `bug1355.js` stopped hanging and the simple cases passed. Two further
  fixes were needed and made: for-await's IteratorClose and `yield*` delegation
  both drove the inner generator with the SYNCHRONOUS `genResume`, which parks
  the caller against a queue only that caller can feed — both must go through
  the async request and await the promise.

  What killed it was the event loop. Yielding to a runnable generator body
  before `runOneTimer` starves the timer that would settle the await the body
  is parked on. Moving the yield after timers fixed that specific livelock but
  left a NONDETERMINISTIC hang in ordinary sequential code — the same script
  produced 2, 16, or all 18 lines across runs — which is strictly worse than
  the one pathological shape it set out to fix. The remaining race was not
  identified. Whoever picks this up should start by making the body's
  runnability explicit rather than inferring it from "a request is queued":
  the event loop cannot currently distinguish "body is runnable" from "body is
  parked on a promise nothing has settled yet", and spins on the difference.

- **`built-ins/AsyncGeneratorFunction` is unmoved at 13%** — the
  `AsyncGeneratorFunction` constructor and the prototype/`@@toStringTag` chain
  are not modelled at all, separately from the objects working.
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
`src/runtime/modules.milo`), because it runs on tokens before the parser has desugared
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
2. **`TypedArray.prototype.subarray` returns an empty view — DONE 2026-08-15.**
   Not a subarray bug: `a.subarray(1)` passed `undefined` as the end index and
   every built-in with a defaulted argument treated an explicit `undefined` as
   "0", not as "absent". See "Explicit `undefined` meant absent" below.
3. **`[1, , 3].flat()` keeps the hole** (length 3, node gives 2) — one symptom
   of a representation gap, see "Array holes are not modelled" below.
4. **`"ß".toUpperCase()` answers `"ß"` — DONE 2026-08-15**, and the entry
   understated it: the gap was not one special case but every script. See
   "Case mapping was ASCII and Latin-1 only" below.

## Smaller known gaps


## Explicit `undefined` meant absent — DONE 2026-08-15

Every built-in with a defaulted argument checked presence as `args.len() > i`
alone, so `arr.slice(1, undefined)` took `undefined` through `toNum` to `0` and
returned `[]` where node returns `[2,3,4]`. That is the shape a forwarded
optional parameter produces, so it is common in ordinary code, not a corner.
Nine methods diverged: `Array.prototype.slice`/`fill`/`copyWithin`/`join`/
`flat`, `String.prototype.substr`/`padStart`/`padEnd`, and
`%TypedArray%.prototype.subarray`/`slice`/`fill`/`join`.

Fixed centrally: `argPresent(args, i)` in `src/engine/builtins.milo` is the presence
test, and `argNum` uses it — which covers every `String.prototype` site at once.
The array and typed-array branches in `src/engine/eval.milo` call it directly.

Two neighbouring bugs came out of the same probe:

- **`String.prototype.substring` was implemented as `slice`.** It has its own
  clamping — a negative index goes to 0 rather than counting from the end, and
  out-of-order ends are swapped — so `"abcdef".substring(2, 1)` answered `""`
  where node answers `"b"`, and `.substring(-2)` answered `"ef"` where node
  answers the whole string. Four of eight probed argument shapes were wrong.
- **`Array.prototype.lastIndexOf` ignored `fromIndex` entirely.**
  `[1,2,3,2].lastIndexOf(2, 0)` answered 3; it must answer -1.

test262 1500-sample 660 → 662. Directory scores after the fix (no before-number:
the milo compiler at `d6adecc5` cannot build this repo at HEAD, see below, so a
baseline binary could not be produced): `built-ins/String/prototype/substring`
31/46, `built-ins/Array/prototype/lastIndexOf` 144/198,
`built-ins/Array/prototype/fill` 9/22, `built-ins/Array/prototype/copyWithin`
19/39, `built-ins/TypedArray/prototype/subarray` 11/67. Locked by
`tests/undefinedOptionalArgs.js`.

## Case mapping was ASCII and Latin-1 only — DONE 2026-08-15

`upperCp`/`lowerCp` were two `if` chains covering `a-z` and the Latin-1
Supplement, with a comment calling wider scripts "a documented limit". The limit
was that **every non-Latin script passed through unchanged**:

```
"привет".toUpperCase()  // "привет"
"αβγ".toUpperCase()     // "αβγ"
"čšž".toUpperCase()     // "čšž"
```

Now generated rather than hand-written: `tools/gen-unicase.mjs` asks node's own
ICU for the mapping of all 0x110000 code points and emits `src/engine/unicase.milo` —
199 uppercase and 186 lowercase ranges as a balanced if-tree (milo has no static
array initialiser, and a comparison tree is O(log n) with nothing to allocate or
lazily initialise), plus the 102 mappings that GROW the string (ß → SS, ﬁ → FI,
the Greek iota-subscript family), which no code-point delta can express.

Verified exhaustively, not by sampling: a script printing every code point whose
case differs, run through both engines, is byte-identical to node across all
2981 lines. Re-run the generator after a node upgrade.

`toLocaleUpperCase`/`toLocaleLowerCase` were fixed alongside — both had an arity
entry in `builtinArity` and no dispatch anywhere, so both answered `undefined`.
They are the locale-independent mappings here; there is no locale data in this
engine and node only diverges for tr/az/lt.

| area | before | after |
|---|---:|---:|
| `built-ins/String/prototype/toUpperCase` | 13/26 = 50.0% | **15/26 = 57.7%** |
| `built-ins/String/prototype/toLowerCase` | 13/30 = 43.3% | **15/30 = 50.0%** |
| `built-ins/String/prototype/toLocaleUpperCase` | 1/26 = 3.8% | **15/26 = 57.7%** |
| `built-ins/String/prototype/toLocaleLowerCase` | 1/28 = 3.6% | **15/28 = 53.6%** |

Locked by `tests/unicodeCaseMapping.js`.

## Array holes were modelled but never consulted — DONE 2026-08-15

The earlier entry here called this a representation gap and listed `Object.keys`
as one of the divergences. **Both were wrong.** `JSObj` has had a `holes` index
list all along, and `in`, `Object.keys`, `hasOwnProperty` and `delete` all
consult it correctly — `Object.keys([1,,3])` was already `["0","2"]`. The real
gap was that every ITERATION method ignored it. Twelve divergences, one cause:

| expression | was | node |
|---|---|---|
| `[1,,3].flat()` / `.flatMap(x=>[x])` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].filter(() => true)` | `[1,undefined,3]` | `[1,3]` |
| `[1,,3].forEach` callback count | 3 | 2 |
| `1 in [1,,3].map(x => x)` | `true` | `false` |
| `[1,,3].some(x => x === undefined)` | `true` | `false` |
| `[1,,3].every(x => x !== undefined)` | `false` | `true` |
| `[1,,3].reduce` callback count | 3 | 2 |
| `[1,,3].indexOf(undefined)` | 1 | -1 |
| `1 in [1,,3].slice()` / `.concat([4])` | `true` | `false` |
| `[3,,1].sort()` hole position | index 1 | index 2 |

Fixed at each site rather than centrally, because the correct treatment differs
per method and the spec is not uniform about it: some/every/forEach/filter/
reduce/reduceRight/indexOf/flat/flatMap SKIP a hole (they are specified over
present indices), map/slice/concat PRESERVE one (a new `arrPushMaybeHole`), and
find/findIndex/includes deliberately do NOT skip — they read through a hole as
undefined, so they were already right and were left alone.

`sort` needed a rewrite rather than a guard. It sorted `elems` in place under a
holes list that names INDICES, so the recorded holes ended up pointing at
whichever elements had moved into those slots; and the spec sinks `undefined`
below every defined value and a hole below that, which does not fall out of
comparing `"undefined"` as a string (`["z", undefined, "a"].sort()` is
`["a", "z", undefined]`, not `["a", "undefined", "z"]`). It now lifts the
present defined values out, sorts those, and lays undefined and then the holes
back down as a tail.

`built-ins/Array` 1814/3082 → **1819/3082**. Locked by `tests/arrayHoles.js`.

## Class static blocks did not parse — DONE 2026-08-15

`static { ... }` (ES2022) was not handled by the class-body parser at all, and a
parse error is fatal: one static block anywhere killed the WHOLE file, not just
the class. Modelled as a static field with an empty name whose initializer is a
function; the class builder calls it with `this` bound to the class and stores
nothing, which gets the interleaving with static fields right for free (they run
in one declaration-ordered pass). `language/statements/class` 2011/4361 →
**2024/4361**. Locked by `tests/classStaticBlocks.js`.

## Native addons: how far a real one gets, and the wall — 2026-08-15

Chasing `chat`, `todo`, `milo-list` and `smith` to a running state. **`chat` now
runs and serves bytes identical to node.** The other three reach the addon and
stop at a boundary that is not milojs's to move.

Shipped on the way:

- **`tls` did not exist — DONE.** `ws` opens with `const tls = require('tls')`,
  so a WebSocket server could not load at all. `lib/tls.js` provides the surface
  read at require time (`TLSSocket`, `Server`, `createSecureContext`,
  `rootCertificates`, the DEFAULT_* constants) and throws a message naming the
  gap for anything that needs to negotiate a session. `checkServerIdentity` is
  implemented rather than stubbed, since it is pure string work over a
  certificate the caller supplies.
- **`Error.prepareStackTrace` and CallSite objects — DONE.** V8's structured
  stack-trace API. `bindings` sets `prepareStackTrace`, calls
  `captureStackTrace`, and walks frames for the first file that is not its own,
  to locate an addon relative to its CALLER. With no frames it read `undefined`
  and threw. `FuncDef` now records the file it was parsed from, `Interp` carries
  an `fnFileStack` pushed and popped around every call (by wrapping
  `callFunction` rather than editing its many early returns), and the prelude
  turns those into CallSite objects. The shim's own frames are dropped off the
  front, as node drops the capture frame.
- **`require` as a VALUE — DONE.** It was handled only at the call site by name,
  so `typeof require` was `"undefined"`. Every addon loader is built on
  `const requireFunc = ... : require`. Each module scope now binds its own
  `require` carrying its own directory, which is node's model.
- **`__filename` and `__dirname` were RELATIVE — DONE.** node guarantees
  absolute, and packages join candidate paths onto them: a relative one sent
  every candidate to the wrong directory. Resolution still keys on the
  registry's relative form (`relativizeToCwd`), so the two stay in step.
- **A missing addon now reports as not-found — DONE.** `bindings` probes a list
  of paths and rethrows anything that does not read as not-found, so
  "dlopen failed" stopped the search at the first candidate.
- **`dlopen` failures now carry `dlerror()`.** Without it the reason for a failed
  link is invisible, and that reason is the whole story.

**The wall, and it is not ours.** With all of the above, `bindings` locates the
right file and milojs dlopens it. It fails with:

```
symbol not found in flat namespace '__ZN2v811HandleScope16DeleteExtensionsEPNS_7IsolateE'
```

That is `v8::HandleScope::DeleteExtensions`. better-sqlite3 11.10.0's prebuilt
links the **V8 C++ API**, not Node-API: `nm -u` on it shows **49 `v8::` symbols
and zero `napi_` symbols**. milojs has no V8, so this binary cannot load here no
matter how complete the Node-API surface becomes. The three apps need either a
better-sqlite3 rebuilt against Node-API or a sqlite package that is napi-native.
Worth knowing before any further Node-API work is justified by "it will make
better-sqlite3 run", because it will not.

Locked by `tests/runtime/stackTracesAndPaths.js`.

## Past get-intrinsic: the `in` operator, and the host surface — 2026-08-15

The four apps blocked inside get-intrinsic are past it. Three separate gaps, each
uncovered by fixing the one before it:

- **`in` answered false for a NATIVE or a FUNCTION right-hand side — DONE.**
  `"prototype" in String` was false while `String.prototype` read fine, because
  both copies of the operator (it existed twice) matched only `JSValue.Obj` and
  fell through to `false`. get-intrinsic walks `%String.prototype.indexOf%` with
  exactly that test, so every package depending on it died on "base intrinsic for
  %String.prototype.indexOf% exists, but the property is not available". Now one
  `evalInOperator` handles objects, natives (through the property bag) and
  functions (through their statics, plus the members every function carries), and
  a primitive right-hand side is a TypeError rather than false, which is what the
  spec says.
- **`fs` was missing what a promisify target needs — DONE.** better-sqlite3 opens
  with `promisify(fs.access)`, and `util.promisify` rejects a non-function, so a
  missing member was not a missing feature, it was a module that would not load.
  Added `access`, `open`, `close`, `realpath`, `chmod`, `chown`, `utimes`,
  `appendFile`, `exists`, `rmdir`, `fstatSync` and `fs.constants`, each with its
  sync and callback form, plus four more `fs.promises` members.
- **`process.versions`, `process.release` and `process.config` did not exist —
  DONE.** A native addon reads `versions.modules` (the Node-API ABI number) to
  pick its prebuilt binary and dereferences it unconditionally, so the absence
  was a TypeError before the module finished loading.

Locked by `tests/runtime/inOperatorAndHostSurface.js`. tahoeroads still serves
bytes identical to node with zero parse errors.

**Where the four apps stand now, and it is a different kind of wall.** All four
get much further and stop on something structural rather than a shim:

- `chat` needs the `tls` builtin module, which is not implemented.
- `todo`, `milo-list` and `smith` all load **better-sqlite3, a native addon**.
  It fails before the addon is even reached: `bindings` discovers its caller's
  filename through **`Error.prepareStackTrace` plus `Error.captureStackTrace`**,
  V8's structured stack-trace API, where a callback receives CallSite objects and
  reads `.getFileName()`. milojs never calls `prepareStackTrace`, so the filename
  comes back undefined and `fileName.indexOf('file://')` throws. Supporting it
  means synthesising CallSite objects from the interpreter's call stack: a real
  feature, not a shim, and the gate in front of every `bindings`-based addon.

## Four more real applications, and the npm floor — 2026-08-15

Four other node apps in the same tree (`chat`, `todo`, `milo-list`, `smith`) all
died in the same place, and none of it was app code: **`node_modules/get-intrinsic/index.js`,
whose first line is `var undefined;`**. get-intrinsic sits under a large fraction
of npm, so this was closer to a floor than to four bugs. Fixed in order as each
one uncovered the next:

- **Contextual keywords could not be binding names — DONE.** `undefined`, `async`,
  `await`, `yield` and `let` get their own lexer tokens but are NOT reserved
  words. Every name slot (declarator, parameter, function name, catch parameter)
  tested `peekKind(p) == T_IDENT`, so `var undefined;` was a **parse error**, and
  a parse error is fatal. Relaxed through one `isBindingName` predicate, used
  only where a NAME is expected — `await` and `yield` keep their operator meaning
  in expression position, which is the context rule the spec uses anyway.
- **`EvalError` and `URIError` did not exist — DONE.** Both are core ECMAScript.
  `EvalError` was a ReferenceError at first mention, and the comment on
  `errorCtorIdFor` already admitted they were "thrown by name but with no native
  constructor". They do not fit the contiguous `NATIVE_ERROR..NATIVE_REFERENCE_ERROR`
  range (0..4 is full), so the range checks name them explicitly.
  `decodeURIComponent("%")` now throws a real `URIError`.
- **`eval` did not exist as a VALUE — DONE.** It was handled only at the call
  site, so `typeof eval` was `"undefined"` and get-intrinsic's `'%eval%': eval`
  table entry blew up. There is now a global binding whose native throws
  `EvalError` when called indirectly (there is no runtime compiler), while the
  direct `eval("bareIdent")` form still works — the guard moved from `scopeHas`
  to a new `scopeHasBelowGlobal`, so only a USER binding shadows it.

Whole-suite 1500-sample **677 → 680**. Locked by
`tests/contextualKeywordBindings.js`.

**Still blocked, next in line:** all four apps now get through get-intrinsic's
parse and its global table and fail inside it with
`base intrinsic for %String.prototype.indexOf% exists, but the property is not
available`. `String.prototype.indexOf` itself is fine (typeof, `hasOwnProperty`,
`getOwnPropertyDescriptor` and `in` all agree with node), so the fault is in
whatever get-intrinsic uses to walk from `%String.prototype%` to the member.
One measured lead: `Object.getOwnPropertyNames(String.prototype)` returns 28
names where node returns 52.

Two smaller things found by the same probe, not yet fixed:

- Running `scripts/test262-sweep.ts` without `--json` writes
  `docs/conformance/test262.json` containing ABSOLUTE paths
  (`/Users/<you>/git/test262`), which the pre-commit hook then rejects as a
  home-directory leak. Either the report should record `$HOME`-relative paths or
  the default output belongs outside `docs/`.

- **`globalThis` is missing most builtins in the RUNTIME.** `typeof Symbol` is
  `"function"` but `typeof globalThis.Symbol` is `"undefined"`, and likewise for
  `Function`, `RegExp`, `Proxy`, `Reflect`, every typed array, `decodeURI`,
  `escape` and more. The engine's `globalThis` is much more complete than the
  runtime's, so the runtime is putting a different object in front of it.
- Reading a contextual keyword still yields the KEYWORD, not the binding:
  `var undefined = 5; console.log(undefined)` prints `undefined`, not `5`,
  because `undefined` in expression position lexes as the literal. Declaring
  works (which is all get-intrinsic needs, since it declares `var undefined;`
  precisely to obtain the real value); shadowing does not. The fix is to make
  `undefined` an ordinary global binding rather than a literal token.

## eval is real now, and "no runtime compiler" was never true — DONE 2026-08-15

`eval` resolved a bare identifier and hard-errored on everything else, under a
comment in `evalCall` saying milojs has no runtime compiler. That comment was
wrong, and I wrote it. `src/runtime/repl.milo` has always called `lex()` and
`parseProgram()` on new source at runtime and executed the result: eval is that
same operation with the CALLER's scope instead of the REPL's global one.

`runEvalSource(src, st, scope)` parses into the shared `gProg` and runs the
statements, answering the completion value. Three details that are not wiring:

- **`var` and function declarations belong to the caller's scope, `let`, `const`
  and `class` do not.** Hoisting into the caller and executing in a fresh child
  scope gives both: `eval("var vv = 2")` is visible afterwards, `eval("class Ce {}")`
  leaves nothing behind.
- **Indirect eval runs in the GLOBAL scope.** `const e = eval; e(src)` goes
  through the `NATIVE_EVAL` native at scope 0, so it cannot see the caller's
  locals. That is the whole difference between the two forms.
- **Appending to `gProg` mid-evaluation is safe here** because Milo's `&Prog` is
  a second-class reference, re-read through rather than cached across a call, so
  an outer `evalExpr` walk picks up a reallocated arena. Stressed by the fixture:
  400 eval'd closures escape into an array, each append able to reallocate under
  a live walk, then all are called afterwards.

| suite | before | after |
|---|---:|---:|
| test262 1500-sample | 680/1470 = 46.3% | **699/1470 = 47.6%** |
| QuickJS `tests/` | 97/149 = 65.1% | **98/149 = 65.8%** |

+19 on test262, the largest single move this session outside the constructor
prototype work. QuickJS moved only 1 because its remaining eval cases need more
than eval (`new.target` in a function context, `var_obj` semantics).

Locked by `tests/evalRuntime.js`.

## The parser accepted truncated input instead of failing — DONE 2026-08-15

`parsePrimary` ended in "unexpected token: consume it so parsing always makes
progress", which swallowed ANY token that cannot start an expression and answered
`undefined`. `atStatementEnd` then treats EOF as a legal statement end, so a
truncated expression ran off the end without complaint. Six of ten malformed
sources parsed clean, and nothing downstream could tell.

Three separate holes, all closed:

- **`parsePrimary`'s fallback now marks the parse failed** (still consuming the
  token so recovery reports as much as it can, and not consuming EOF). That
  covers `var =`, `1 +`, `}` and `()=>`.
- **An expression statement had no end check.** `a b c` parsed as `a` and then
  started over, silently dropping `b c`. It now calls `expectStatementEnd`, which
  still honours ASI.
- **A top-level `return` is rejected in eval only.** It is legal in a CommonJS
  module, since node wraps the file in a function, so the parser cannot tell the
  two apart; `runEvalSource` checks the parsed block instead.

Making the parser strict immediately exposed a bug it had been hiding, in
express's own dependency tree: **`break` and `continue` took the next line as
their label.** `proxy-addr` writes

```js
if (!trust(addrs[i], i)) continue
addrs.length = i + 1
```

and the label parser consumed `addrs`, then choked on the `.`, silently mangling
the function body. The comment above it admitted "No ASI tracking here". `return`
had the same gap in the other direction, swallowing the next line as its
expression. All three now stop at a line break.

Verified against five real applications: tahoeroads still serves bytes identical
to node on every route and now logs **zero** parse errors (it was mangling
proxy-addr before), and the other four apps report zero parse errors and fail at
exactly the same get-intrinsic point as before. No valid code was rejected.

QuickJS `tests/` 98/149 → **99/149**. The test262 sample did not move: its
`Expected a SyntaxError` bucket is mostly early errors the parser still does not
diagnose (duplicate declarations, bad assignment targets, strict-mode rules),
which is a separate body of work. Locked by `tests/parserRejectsBadInput.js`.

## What a real application found that the suites did not — 2026-08-15

Pointing milojs at `tahoeroads` (express 4 + Prisma + tRPC, a deployed backend)
turned up two defects in ten minutes that test262 and every fixture here had
missed, and the app now serves bytes identical to node on every route tried.
Both are recorded in `docs/status.md` under Evidence. Keep doing this.

- **`require` inside a closure resolved against the wrong module — DONE.**
  `requireModule` took its base directory from `st.modDirStack`, which is
  DYNAMIC: it is popped when a module body finishes. body-parser exports its
  parsers through `Object.defineProperty(exports, 'json', {get: ... require('./lib/types/json')})`,
  so the require fires long after body-parser's body ended and resolved against
  whoever touched the getter — express — producing
  `node_modules/express/lib/lib/types/json`. **express 4 could not load at all.**
  Now resolved through the lexical `__dirname` binding in the closure's own env
  chain, which names the module the code was WRITTEN in. Locked by the lazypkg
  fixtures under `tests/modfix/`.

- **`\S`, `\D` and `\W` inside a character class became the literal letters —
  DONE.** `reParseClass` recognised only the lowercase shorthands; the uppercase
  ones fell through to `reEscapedChar`. So `[\s\S]` meant "whitespace or the
  letter S": it matched a newline but not a letter, `[\s\S]*` matched the EMPTY
  string, and `[\s\S]+` matched nothing. The app rewrites page metadata with
  `/<title>[\s\S]*?<\/title>/` and silently served the untouched template.
  Fixed by adding the complement ranges over the byte domain — the domain `[^]`
  already matches over. `built-ins/RegExp` 724/1879 → **725/1879**: test262
  barely notices, which is exactly why a real app was needed to find it. Locked
  by `tests/regexClassShorthands.js`.

## Smaller gaps found by probe on 2026-08-15

- **`String.prototype.normalize` is a SILENT no-op.** It returns its input, so
  `"e\u0301".normalize("NFC").length` is 2 where node gives 1, and a caller
  normalizing before an equality check gets `false` for strings that are equal.
  The in-source comment justified it with "strings are byte buffers, so every
  form is already normalized", which is false reasoning: UTF-8 says nothing about
  canonical composition. Comment corrected; the behaviour is unchanged and still
  wrong. Needs composition/decomposition tables, generatable from node the way
  `tools/gen-unicase.mjs` does (canonical decomposition, combining-class
  ordering, composition with the exclusion list).

  The form ARGUMENT is validated now, because that costs nothing and an invalid
  form is a RangeError in the spec: `"a".normalize("NFZ")` throws instead of
  silently pretending. `built-ins/String/prototype/normalize` 3/14 → **4/14**.
  Asserted by `tests/normalizeFormArg.js`, which deliberately encodes only the
  part that matches node, so it will not need rewriting when the gap closes.
- ~~Unicode property escapes do not match~~ — DONE 2026-08-17, see below.

## ToString reached neither Date.prototype nor Object.prototype — DONE 2026-08-15

`String(someDate)` answered `"[object Date]"`. So did `"" + d`, `[d].join("")`
and `` `${d}` `` — every way a date reaches a string except calling
`d.toString()` by hand. Any `console.log("at " + date)` was wrong.

Four separate defects, found by probing ToPrimitive rather than Date:

- **`callBuiltinByName` excluded `toString` and `valueOf` from date dispatch**
  (`isDate && name != "toString" && name != "valueOf"`). Every generic conversion
  reads those off the prototype as bound method values and calls them, so all of
  them fell through to the object tag; `d.valueOf.call(d)` answered the ISO
  string instead of the epoch number.
- **Date's default ToPrimitive hint.** Date is the one built-in whose
  `@@toPrimitive` turns the DEFAULT hint into the STRING one. Without it, fixing
  `valueOf` to answer a number made `"" + d` WORSE — it started printing the
  epoch. `toPrimitiveDefault` now routes a Date to the string ordering.
- **`({}).toString` and `({}).valueOf` read as `undefined`.** A plain object has
  `proto == -1`, and the fallback to `Object.prototype` lives in `protoOfHandle`,
  which the property-chain walk does not use — so the copies stored on
  `Object.prototype` were unreachable from any ordinary object or class instance.
  ToPrimitive with the string hint then skipped straight to `valueOf`, which is
  the wrong order: `String({valueOf: () => 5})` answered `"5"` where node answers
  `"[object Object]"`. Resolved with the same shape of arm
  `hasOwnProperty`/`isPrototypeOf`/`propertyIsEnumerable` already had.
- **`String.prototype.concat` converted with the prog-free `toStr`**, so every
  object argument became `"[object Object]"` — including an array or a Date.
  Split out as `strConcatProg`; `stringMethod` has no Prog to re-enter user code
  with, which is why it could not be fixed in place.

Template literals were fixed alongside, and needed the AST node the old entry
predicted: **`Expr.ToStrHole`**, one per hole. The `"" + x` chain they desugared
to takes the DEFAULT hint, so an object with `Symbol.toPrimitive` saw `"default"`
where the spec passes `"string"`. The node also carries the one case where a
template is stricter than `String()`: `` `${Symbol()}` `` is a TypeError, while
`String(Symbol())` is not.

| area | before | after |
|---|---:|---:|
| `built-ins/Object/prototype/valueOf` | 9/20 = 45.0% | **13/20 = 65.0%** |
| `built-ins/String/prototype/concat` | 17/22 = 77.3% | **18/22 = 81.8%** |
| `built-ins/Object/prototype/toString` | 17/41 = 41.5% | **18/41 = 43.9%** |

The 1500-sample did not move (673 either way) — test262 is thin here, and the
value is that ordinary string building stopped printing `[object Date]`. Locked
by `tests/toPrimitiveHints.js`, whose Date assertions are written as identities
(`String(d) === d.toString()`) so the fixture says nothing about the host
timezone.

Still open, and needing a representation change rather than a fix: **an object
with a null prototype is indistinguishable from one with a default prototype**
(both `proto == -1`), so `String(Object.create(null))` answers
`"[object Object]"` where node throws `TypeError: Cannot convert object to
primitive value`. This is the same missing bit that keeps `util.inspect` from
printing node's `[Object: null prototype]` prefix.

## The runtime shadowed the engine's native typed arrays — DONE 2026-08-15

`lib/prelude.js` redefined `ArrayBuffer`, seven of the typed arrays and
`DataView` as plain JS arrays carrying an `_isTypedArray` marker. Because the
prelude runs in the runtime, `milojs` was strictly worse than `milojs-engine`
on every one of them:

| | shim (runtime) | node / engine |
|---|---|---|
| `u8[0] = 300` | stays `300` | `44` |
| `Object.getPrototypeOf(u8)` | `Array.prototype` | `Uint8Array.prototype` |
| `Object.prototype.toString.call(u8)` | `[object Array]` | `[object Uint8Array]` |
| `DataView.prototype.setUint16` | missing | present |
| `ArrayBuffer.prototype.slice` | missing | present |
| `new TextEncoder().encode("héllo")` | 5 latin-1 bytes | 6 UTF-8 bytes |

It was also inconsistent with itself: the comment noted that `Int16Array` and
`Float32Array` "are provided natively by the engine and are left as-is", so the
runtime shipped a mixed set where the element type decided whether you got a real
typed array. Deleted — the whole block is now a comment saying why it is empty.

`TextEncoder`/`TextDecoder` stay in the prelude, because they are host APIs the
engine does not provide, but they were rewritten to do real UTF-8 (including
surrogate pairs and U+FFFD for a truncated or lone one) over a real `Uint8Array`.

Removing the shim exposed one genuine engine gap, now also fixed:
**`makeTypedArray` ignored every argument that was not an Array, an ArrayBuffer
or another typed array.** Anything else fell through to the length branch, where
`toNum` of an object is NaN, so `new Uint8Array(buf)` came back EMPTY instead of
throwing — silent, and exactly what the runtime's own `typedArrayCoerce` fixture
caught. Both spec paths now exist: the iterable one (using the same drivability
test `iterableToArray` uses, since a Set carries no `Symbol.iterator` PROPERTY
here) and the array-like one (`length` plus indexed reads).

`built-ins/TypedArrayConstructors` 162/738 → **172/738** from the constructor
fix alone (measured against a baseline binary; the other typed-array directories
moved this session for reasons outside this change, so they are not attributed
here). Locked by `tests/runtime/typedArrayNative.js` and the rewritten
`tests/runtime/typedArrayCoerce.js`.

Still missing on the constructors themselves: `%TypedArray%.of` and
`%TypedArray%.from`. Both need a native id that knows which element type it was
reached through, which `Array.from`'s single `NATIVE_ARRAY_FROM` does not model.

## The milo compiler at `d6adecc5` could not build this repo — RESOLVED

`milo build src/milojs-engine.milo` on a clean HEAD failed in LLVM with
`error: use of undefined value '@.str.5025'` on a `getenv` call, deterministically
but layout-sensitively: adding unrelated code to `src/engine/eval.milo` moved the index
and the build succeeded, which is why the suite was green mid-session and red an
hour later against unchanged milojs source. Gone as of milo `b5a40d2b`. Recorded
because the failure mode is worth recognising: `milo` is a symlink to
`~/git/milo/milo`, so a red build here can be a compiler that moved underneath.

## The regex engine matched bytes, not code points — DONE 2026-08-15

Found while checking whether `\p{L}` was worth implementing. It is not the first
thing to fix, because the engine was not code-point aware at all:

| expression | was | node |
|---|---|---|
| `"aéb".match(/./gu).length` | 4 | 3 |
| `/^a.b$/.test("aéb")` | false | true |
| `/^é+$/u.test("ééé")` | false | true |
| `/^.$/u.test("😀")` | false | true |

Two causes, both in how an atom is built rather than in the matcher's search:

- **`.` advanced by one BYTE.** `RE_ANY` now steps a whole UTF-8 sequence, so a
  2-byte é is one dot instead of two plus a stray continuation byte.
- **A multibyte literal was one `Char` node per byte**, so a following quantifier
  bound to the LAST BYTE: `/é+/` meant "0xC3 then one-or-more 0xA9". A multibyte
  literal is now wrapped as a non-capturing group, which is a single atom for the
  quantifier to attach to.

`built-ins/RegExp` 727/1879 → **734/1879**.

## String.prototype.split ignored zero-width matches and captures — DONE 2026-08-15

Two separate defects in `regexSplit`, both common idioms:

```js
"fooBarBaz".split(/(?=[A-Z])/)  // was ["fooBarBaz"], node ["foo","Bar","Baz"]
"a1b".split(/(\d)/)             // was ["a","b"],     node ["a","1","b"]
```

A zero-width match just advanced the cursor and never split, and capture groups
in the separator were dropped instead of becoming elements. Rewritten to the
spec's shape (`p` the pending piece, `q` the cursor, an empty match advancing `q`
only when it lands at `p`), with one adjustment the spec does not need: it
matches AT `q` while `regexExec` SEARCHES from `q`, so a match starting at the
end of the string has to be rejected explicitly or a trailing zero-width
separator adds a spurious `""`.

`built-ins/String/prototype/split` 64/120 → **68/120**. Locked together by
`tests/regexCodePointsAndSplit.js`.

### Every zero-width advance, and string indices — DONE 2026-08-15

Prompted by the milo maintainer finding the same shape in `std/regex`'s
`findAll`. Their symptom was the mirror of mine: a byte-advance after a
zero-width match made their loop retry mid-character, where a now-correct matcher
REJECTED the position and the list came back truncated. Mine invented extra
matches instead, and `replace` spliced its output around half a character:

    "aéb".replace(/x*/gu, "-")   ->  "-a-\xef\xbf\xbd-\xef\xbf\xbd-b-"   (invalid UTF-8)
    "aéb".match(/x*/gu)          ->  5 empty strings, node gives 4

Four loops had it (global replace, replace-with-callback, matchAll, global
match); `split` had already been fixed and was the template. All advance a whole
character now.

Their note is the one worth keeping: **a half-corrected stack can be worse than
an uncorrected one.** Their locale fix turned a wrong-but-complete answer into a
silently truncated one, which is why they went looking at the loop rather than
declaring the locale change done.

**String indices were BYTE offsets**, found while checking the above:
`"aéb".match(/b/).index` was 3 where node says 2, so `s.slice(m.index)` cut in
the wrong place. `.index`, the offset a replace callback receives, and
`lastIndex` (which a caller both reads AND writes) are UTF-16 units now, with the
conversion at the boundary and bytes kept internally.

`built-ins/RegExp` 734/1879 → **736/1879**.

### Relative specifiers that climb above their base — DONE 2026-08-16

`normalizePath` popped a segment for `..` and, when there was nothing to pop,
**dropped it silently**. So a path that climbs above its base lost the climb:

    from pkg/sub/deep:  require('../../lib.js')  ->  resolved as 'lib.js'

Not a missing feature, a wrong answer: it resolved against the wrong directory
and reported "cannot read module". Only an ABSOLUTE path may discard a `..`
(nothing is above the root); a relative one has to keep it, and must not later
pop a `..` it just kept.

Also fixed alongside: `require('.')` and `require('./')` normalised to the empty
string, and an empty base resolves against nothing. Both are the directory
itself, which node answers with its package.json `main` or `index.js`.
`require('..')` and `require('../')` already worked once the `..` survived.

How it was found is the point: I went looking for real package test suites to run
after concluding that `\p{...}` was not worth its table size, and
`define-properties`' suite failed on `require('../')` before it could even load
its test harness. The bug was never going to show up in a fixture written by
someone who already knew how this resolver behaves.

Locked by `tests/modfix/updir/`, exercised from `tests/modules.js`.

### `\p{...}` property escapes — DONE 2026-08-17, and the estimate that blocked it was wrong

The 2026-08-16 entry sized this and declined to build it: 10,869 ranges for 46
properties, "tens of thousands of lines of generated Milo". Its prescription was
right and its arithmetic was wrong, in a way worth recording because the same
mistake is easy to repeat.

Right: *"if it is built, it should be compact DATA decoded once, not emitted
code."* That is what shipped. `tools/gen-uniprops.mjs` writes `src/engine/uniprops.txt`,
one line per property, ranges as gap+length varint pairs in a base-64 alphabet.
`src/engine/uniprops.milo` decodes a property at pattern-COMPILE time straight into the
regex's `ReClass`, so matching `\p{L}` costs what matching `[a-z]` costs and
nothing decodes per character.

Wrong, three ways:

- **It priced the wrong representation.** 10,869 ranges is a real count, but as
  data those ranges are ~2 characters per varint pair, not ~4 lines of if-tree.
  The whole table is **103KB** — smaller than several files already in `lib/`.
- **It scoped to a subset to save size, and the subset was the expensive part.**
  Building all of it costs almost nothing extra: 1,682 property SPELLINGS,
  including every `Script`/`Script_Extensions` value and every alias, because
  identical range bodies are stored once and aliased by name.
- **"A feature no application tested here has ever used"** was true of the app
  corpus and irrelevant to the score. It was the single largest addressable block
  in test262: **441 generated files**, measured 0% → **86.0%** (527/613 with
  `--dir`), moving the whole-suite sample 64.3% → 65.9% in one sitting.

The 14% that still fails is not fixable here: test262 tracks a newer Unicode than
node 25.3.0's ICU 77.1, so those tests assert code points this oracle does not
have. 101 of the harvested spellings are unknown to this node for the same reason
and are deliberately absent from the table, which makes them a SyntaxError — which
is what the spec wants for an unrecognised name anyway.

**The general lesson:** an estimate that assumes the wrong representation is not a
conservative estimate, it is a wrong one. The 2026-08-16 note had already worked
out the right representation in its own second paragraph and then costed the first
one.

### An async generator handed out a promise instead of awaiting it — FIXED 2026-08-17

    async function* g() { yield Promise.reject(new Error("boom")); }
    await g().next();     // resolved. The rejection surfaced later, unattributable

AsyncGeneratorYield **awaits** its operand before handing it out, so yielding a
rejected promise rejects the promise the awaiting `next()` returned. `genYield`
handed the value out raw, so `next()` resolved WITH the rejected promise and the
rejection turned up later as an unhandled rejection with nothing connecting it to
the call that caused it. That is the "reject reason" cluster in
`async-gen-private-method`, 24 tests.

Fixed by awaiting in `genYield` when the generator is async. A rejection there is a
throw AT the yield, which is exactly how it propagates outward.

Alongside it: `yield*` over `{ next() { return 5 } }` stopped SILENTLY. An
iterator's `next()` must answer an object; a primitive is a TypeError. The check
went on the generic-iterator path — the first attempt put it on the generator path,
where a primitive result cannot occur, so it compiled, read correctly and did
nothing. Verified by the probe going from NO THROW to TypeError, not by inspection.

Measured: `language/statements/class` 83.1% → **83.6%**, sample 69.1% → 69.2%.

Worth recording that the class area was written off in earlier notes as "diffuse"
without being measured. It was already at 83.1%, and its biggest cluster was one
mechanism.

### A user method on an exotic object was silently ignored — FIXED 2026-08-17

    var d = new Date(); d.m = function () { return "d"; }; d.m()   // undefined
    var m = new Map();  m.mm = function () { return "m"; }; m.mm() // undefined
    var re = /a/g; re[Symbol.iterator] = fn; re[Symbol.iterator]() // undefined

No error, no call — just `undefined`. Every exotic receiver (regex, Date, Map, Set,
ArrayBuffer, DataView, typed array) routes method calls straight to its own builtin
handler, and those handlers know only their own method names. Anything else fell off
the end and returned undefined, so a property the program had explicitly put on the
object was unreachable as a call.

Fixed once rather than per type: an OWN callable property on the receiver is checked
before the whole exotic dispatch chain. Deliberately OWN and not inherited — an
inherited name has to keep reaching the builtin, or every `date.getTime()` would
resolve to the prototype's bound method and skip the fast path that exists for it.

Found while chasing `es-get-iterator`, whose test sets `Symbol.iterator` on a regex.
That suite is still blocked at 73/140 by something else further along, so this cost
more of a session than it returned in corpus points — but a silently ignored method
call on `Date` is worth more than the points.

**Method note:** the bug reproduced only after narrowing from "the suite recurses"
to "which SECTION does the suite stop at", by diffing `grep '^#'` of our run against
node's. The failure the suite reported (`Maximum call stack size exceeded`) named
neither the receiver nor the operation, and every direct reproduction of the
suspected cause passed.

### A builtin constructor did not inherit Function.prototype — FIXED 2026-08-17

`Array.constructor` was `undefined`. So was `Object.constructor` and
`Function.constructor`, and `Object.getPrototypeOf(Array) === Function.prototype`
was false.

`get-intrinsic` resolves `%Array.constructor%` by exactly that route, so it failed
with "base intrinsic for Array.constructor exists, but the property is not
available" — and `get-intrinsic` sits under a large share of the es-shim ecosystem,
so one missing prototype link stopped `call-bound` after 4 of its 16 assertions.

Two links were missing:

- `protoOfHandle` sent every callable OBJECT to `Object.prototype`. A callable
  inherits `Function.prototype`; that is what makes `.constructor` resolve.
- A native's property bag (`getNativeProps`) was a plain object, so `String`,
  `Number`, `Object` and friends had no route to `Function.prototype` either. A
  native is by definition callable, so the bag is now marked function-like at
  creation.

Measured: `call-bound` 4/16 → **16/16 complete**; package corpus 72% → **73%**,
40 suites complete; test262 sample 69.0% → 69.1%.

**Still open in that corpus:** `es-get-iterator` stops at 73/140 with
`Maximum call stack size exceeded` somewhere after its fake-iterator section. Direct
reproduction attempts all pass — iterating wrapper objects, arguments objects,
`Function('return arguments')`, custom `Symbol.iterator` — so the recursion is
further in, in tape or object-inspect machinery, and needs a stack trace rather than
more guessing.

### Node builtin module NAMES, and what 650 missing assertions actually were — FIXED 2026-08-17

`is-core-module` scored 68/718 in the package corpus — one package holding ~38% of
every assertion the whole corpus was missing. The obvious read was "we are missing
650 features". The real shape was different and worth recording.

The suite has three sections. Section 1 requires every name in `core.json`.
Sections 2 and 3 re-test the same list, obtained from `repl._builtinLibs` and
`module.builtinModules`. We had neither module, so **both sections produced zero
assertions** — the suite ran 166 of 718 and simply stopped. Two missing modules, not
650 missing features.

What shipped:

- `module` with `builtinModules`, `createRequire`, `isBuiltin`; `repl` with
  `_builtinLibs` derived from it. Sections 2 and 3 now run.
- Aliases and subpaths of modules that ALREADY EXIST, which node exposes as separate
  specifiers and the ecosystem probes by name: `path/posix`, `path/win32`,
  `assert/strict`, `util/types`, `sys`, `stream/promises`, `stream/consumers`,
  `constants`, `console`, `process`, and node's legacy internal names
  (`_stream_*`, `_http_*`, `_tls_*`).
- `timers` / `timers/promises`, and `punycode` implemented properly (RFC 3492)
  rather than stubbed, because it is small enough to just do.

**What was deliberately NOT added**, and the reason matters: `dns`, `http2`,
`cluster`, `dgram`, `domain`, `inspector`, `perf_hooks`, `v8`, `vm`, `wasi`,
`worker_threads`, `test`, `trace_events`, `stream/web`. Registering a name we cannot
back turns a clean resolution failure into a confusing one at first USE, and breaks
the `try { require(x) } catch { fallback }` probe the ecosystem relies on. Every
name in `builtinModules` is one this runtime can actually load.

`node:sqlite` still reports "not ok", and correctly: the test asserts it is
UNAVAILABLE on the running node version, and we support it.

Measured: is-core-module 68/718 → **354/718**; whole package corpus
55% → **72%** (948 → 1234 assertions). Real-app gate still 2/2 byte-identical.

**Lesson:** a package failing 650 assertions is more likely to be blocked than
broken. Look at where its output STOPS before assuming the gap is feature-shaped —
`tail` on the run answered in seconds what the failure count implied wrongly.

### The regex VM died silently on large inputs — FIXED 2026-08-17

    var s = "a".repeat(200000);
    print(/^[a-z]+$/.test(s));    // never returned; process exited 0

No error, no output, **exit status 0**: not a crash to catch, not a wrong answer to
notice, nothing. `reRun` recursed once per VM STEP, so `x+` over n characters
recursed n deep and past roughly 100k the green task's 8MB stack was gone.

A second bug shared the same cause and needed no size at all — **any quantifier
whose body can match empty killed the engine on a three-character input**:
`(a*)*`, `(a|)*`, `(a*)+`, `(?:)*` all hung and exited 0.

**Now iterative.** `reRun` keeps an explicit backtrack stack of `(pc, sp, trailLen)`
plus a trail of undo records, so alternatives share one `saves` vector instead of
snapshotting it per branch. Lookahead and lookbehind still recurse — their nesting
is bounded by the PATTERN, not by the subject, so it cannot run away.

The empty-body cure is a per-SPLIT record of the position its loop body was last
entered at. Arriving at the same split with the same `sp` means the body matched
empty, and the path is FAILED rather than skipped forward: backtracking unwinds the
empty iteration's captures, which is what makes `(a*)*` on `"aaa"` capture `"aaa"`
and not `""`. Skipping forward leaves the empty capture committed, which was the
only difference from node in the first working draft.

Measured:

| | before | after |
|---|---|---|
| `/^[a-z]+$/` on 200k chars | silent exit 0 | true |
| the same on **1M** chars | silent exit 0 | true |
| `(a*)*` on `"aaa"` | silent exit 0 | `["aaa","aaa"]` |
| `(x+x+)+y` on 20 x's | (catastrophic) | false, promptly |
| `built-ins/RegExp/property-escapes` | 27.1% | **85.8%** (+360) |
| whole-suite sample | 67.5% | **69.0%** |

**The method mattered more than the code.** The previous attempt at this broke every
regex and was reverted. This one started by building a 60-case differential harness
(`exec` + `test` + `replace` + `split` + `match`, capture groups, lookaround,
backrefs, flags, astral, property escapes) and capturing node's output FIRST. That
harness caught the empty-capture discrepancy immediately and reduced the rewrite to
"make this diff empty" — which it now is, 65 of 65 lines identical to node.

**Known cost:** ~20x slower than node on a small-pattern loop (41ms vs 2ms for 20k
matches). The trail and stack are `Vec` pushes per step; a production engine would
reuse buffers across `exec` calls. Worth revisiting, but not before correctness.

### reduce passed three arguments where the spec says four — FIXED 2026-08-17

`Array.prototype.reduce` and `reduceRight` built their callback arguments by hand
and pushed only `(accumulator, value, index)`. The fourth — the object being
reduced — was never pushed, so a callback reading `obj.length` read it from
`undefined` and the engine reported `cannot read property 'length' of undefined`.
That error text was the 4th-largest failure reason in `built-ins/Array/prototype`.

Every other callback method builds its arguments through `makeCbArgsDyn`, which has
always passed the object. These two did not, because they also thread an
accumulator and so were written separately. When adapting an array-like the object
handed over is the ORIGINAL receiver, which `arrayLikeOrig` records.

### Mutating a frozen array silently succeeded — FIXED 2026-08-17

`Object.freeze([1,2]).push(3)` grew the array. So did `pop`, `sort`, `reverse`, and
the rest of the mutating set, on frozen arrays, sealed arrays, and arrays whose
`length` had been made non-writable by the `defineProperty` work landed earlier the
same day. All are TypeErrors.

Also fixed alongside: `arrayLikeLength` read `length` with the Prog-free `toNum`,
so a `length` getter returning a **Symbol** yielded NaN and was treated as 0 rather
than throwing the TypeError that ToLength specifies. Its `-1` return now means
either "too large" or "already threw", and the caller checks `st.throwing` before
substituting its own RangeError — previously an abrupt completion from a poisoned
`length` was reported as this engine's array-size limit, which is a confusing lie
about whose fault the failure is.

Measured across the two entries plus the recursion fix above: `built-ins/Array/prototype`
67.2% → **76.3%**, +255 tests of 2811, in one session.

**Still open in that area**, and both are design rather than bugs: 62 tests need
resizable ArrayBuffers, and ~37 need the generic path to stop MATERIALISING an
array-like (`ARRAY_LIKE_MAX` is 2^24, and the tests use lengths near 2^53 with
methods like `pop` that only touch one element). The second is the same
"arrayMethodGeneric copies" design already noted; making it read the original
lazily per index would close both that and the remaining coercion-order cases.

### SIGBUS from ordinary JS, and two prototype-chain blind spots — FIXED 2026-08-17

The top failure reason in `built-ins/Array/prototype` was not an assertion. It was
`crash(SIGUSR1)`, 156 times.

**First, the signal was mislabelled.** bun reports signal 10 as `SIGUSR1`, which is
its name on Linux; on macOS signal 10 is **SIGBUS**. So the histogram said "some
scheduling signal" when it meant "memory fault". Worth knowing for any future
triage: check the number, not the name bun prints.

**Second, it did not reproduce.** Standalone the case exited 0. Under the sweep it
died every time. The difference was not the harness: `$(…)` capture reproduced it
10/10 while `| cat` did not, which sent me looking at pipes for a while. It was
simply an unreliable read — the engine faults on this input regardless, and some of
my earlier "0 failures" loops were reading the exit status of `head`, not of the
engine. **Capture the status of the process you are testing, not of the pipeline.**

Minimal case:

    Array.prototype.forEach.call(Object.create([1, 2, 3]), fn)   // SIGBUS

`callBuiltinByName` resolves the method with `getMemberDyn(o, name)`. For an object
whose PROTOTYPE is an array, that resolves — through the chain — to the very bound
builtin the dispatcher is currently handling. Calling it re-enters the dispatcher
with the same receiver and name, forever, until the native stack dies. The comment
90 lines above already warns about this exact shape for Node-API buffers; it was
reachable a second way and only the first way had a guard.

Fixed by noticing that the lookup came back with the method already being
dispatched (`boundMethodNameOf`) and routing to the generic operation instead. A
user method of the same name is a `Func`, not a bound builtin, so
`({map: f}).map()` still calls `f`.

**Then the tests still failed, for a different reason.** With the crash gone,
`forEach` over such an object visited nothing. An array keeps `length` and its
elements OUTSIDE the Prop list, so `objHas` cannot see them — and both chain walks
that matter were built on `objHas`:

- `getMember`'s prototype walk, so `Object.create([1,2,3]).length` was `undefined`
  and every generic array method therefore saw length 0.
- `evalInOperator`, so an inherited index was absent to `in` — which
  `arrHasIndexDyn` consults, so the callback was skipped for every element.

Both now check for an array at each level of the chain. Measured:
`built-ins/Array/prototype` 67.2% → **71.4%**, +116 tests of 2811.

**Lesson, and it is the third instance today:** the same blind spot (array storage
is not Prop storage) produced the `defineProperty` gap above, these two chain walks,
and the `setMember` non-extensible exemption. Each was found separately. A grep for
`objHas`/`objOwnIndex` used as "does this object have this key" is the audit that
would have found all four at once.

### defineProperty did not know arrays existed — FIXED 2026-08-17

Found by the QuickJS-parity worklist, which is the first list this project has had
that says what to fix rather than what is broken.

An array's indices live in `elems`/`logicalLen` and its `length` is derived, so
none of them are `Prop` entries. Every descriptor operation therefore missed them
completely, and the failures were not subtle — twelve probes, twelve wrong answers:

| | before | node |
|---|---|---|
| `defineProperty([], "0", {value:1,…})` | length 0, element invisible | length 1, `a[0] === 1` |
| `getOwnPropertyDescriptor([7], "0")` | **threw TypeError** | `{value:7,…}` |
| `defineProperty(a, "length", {value:1})` | ignored | truncates |
| `defineProperty(a, "length", {value:-1})` | ignored | RangeError |
| `defineProperty(a,"length",{writable:false})` then add an index | silently grew | TypeError |
| `Object.seal([1,2]); a[2] = 3` | grew to 3 | stays 2 |

Two helpers now own those keys — `arrayOwnDescriptor` builds the descriptor and
`arrayDefineOwn` performs the definition — hooked into `applyDescriptor` (so all
three of its callers benefit) and into `getOwnPropertyDescriptor`. `length`'s one
variable attribute needed somewhere to live, since it has no Prop entry:
`JSObj.lengthNonWritable`.

Two subtleties that cost a fixture each:

- An **accessor** at an index cannot live in the element vector, so it falls through
  to the ordinary property path — which means `arrayOwnDescriptor` has to DEFER to
  `buildPropDescriptor` whenever the index has a real Prop entry. Building a data
  descriptor from `arrGet` turned a getter into its empty slot.
- `setMember` exempted arrays from the non-extensible check wholesale, because
  `objOwnIndex` never finds an element. The equivalent question for an array is
  "is this index past the current length", which is what `Object.seal` needs.

Measured: `Object/defineProperty` 72.3%→76.0%, `defineProperties` 65.7%→71.2%,
`getOwnPropertyDescriptor` 79.0%→79.4% — **+77 tests** across 2073. Real-package
corpus 946→948 assertions and 38→39 complete suites.

**Still wrong, and honestly out of reach here:** per-element writability.
`defineProperty(a,"0",{value:5,writable:false})` then `a[0]=9` still writes, because
the element vector has no per-index attribute storage. It needs the same thing
`length` just got, but per element, which is a representation change rather than a
patch.

### A JS argument could kill the process: unchecked f64→i64 casts — FIXED 2026-08-17

`dv.getFloat64(1e308)` did not throw a RangeError. It **terminated the process**
with `runtime error: integer overflow at src/engine/eval.milo:13715`, and
`"a".repeat(1e308)` was worse: no output, exit status 0, after grinding through
gigabytes. Either is reachable from ordinary untrusted JS.

The shape was `toNum(args[0]) as i64`. For a real argument it is fine; for
`Number.MAX_VALUE` the cast lands near `i64::MAX` and the *next arithmetic* on it
overflows, which in Milo is a trap, not a wrap. So the bounds check written on the
line below never got to run — the addition inside the check was what trapped.

Found because the test262/QuickJS parity list surfaced four DataView cases whose
failure reason was a Milo panic rather than a JS error. **A crash in the failure
column is worth more attention than its test count**: four tests, but the class is
"a script can halt the host".

Fixed as a class, not four instances:

- `numToIndex(x: f64): i64` saturates at ±(2^53−1) and answers 0 for NaN
  (ToIntegerOrInfinity's rule), so a clamped value is still out of range for any
  real buffer or string and the arithmetic downstream cannot overflow.
- 64 call sites in `src/engine/eval.milo` converted mechanically.
- `argNum` in `src/engine/builtins.milo` — the single funnel most string and array methods
  take their index argument through — converted, which covers far more than the 64.
- `String.prototype.repeat` gained the product cap that `padStart` already had.
  `padStart`'s comment described exactly this failure mode; the guard had been
  added there and not generalised, which is the same "fixed once, not as a class"
  pattern as the 41 missing argument guards recorded above.

Verified: 14 huge-argument cases across DataView, String, Array, TypedArray and
ArrayBuffer now match node exactly, where before the third one killed the run.

**Lesson:** `numToIndex` lives in ONE place. The first version of this fix defined
it in `eval.milo` while `builtins.milo` kept its own unchecked cast — two
definitions of the same idea, which is precisely the hazard AGENTS.md opens with.
`tools/lint-symbols.sh` only catches a literal duplicate NAME, not a duplicated
idea; the reviewer has to catch that.

### UTF-16 indexing is O(index), so every string scan is quadratic — PARTIALLY FIXED 2026-08-17

The most significant PERFORMANCE defect found so far, and it was found by accident:
`RegExp.escape` on a 100k-character string took 38 seconds, and the cause was not
in `RegExp.escape`.

Measured, 100k-character ASCII string, one full loop:

| operation | milojs before | milojs after | node |
|---|---:|---:|---:|
| `s.charCodeAt(i)` | 13947ms | 6012ms | 4ms |
| `s.charAt(i)` | 27721ms | 11482ms | 3ms |
| `s[i]` | 31655ms | 15368ms | 2ms |

Strings are UTF-8 bytes; JS indices are UTF-16 units. `utf16Locate` walked from
byte 0 calling `decodeCodepoint` per CHARACTER, so a single `charCodeAt(i)` cost
O(i) and any loop over a string was O(n²). Every string-scanning program in this
engine is affected — this is not a test-suite artifact.

**What was fixed.** Below the first non-ASCII byte, byte offset and UTF-16 index are
the same number, so the three converters (`utf16Locate`, `utf16ToByte`,
`byteToUtf16`) now check that first, with a scan BOUNDED by the index asked for
rather than by the string length. A bounds check against the byte length also
short-circuits before any scan. Net ~2.3x, and short strings — the overwhelmingly
common case — went from 3500x slower than node to ~28x (200k accesses on a 10-char
string: 57ms vs node's 2ms). `RegExp.escape` also stopped doing three index
conversions per character, which took the original case 38s to 7s overall.

**What is NOT fixed, and why.** It is still O(index) per access, so a long string is
still quadratic — `quickjs/tests/bug1571.js` (three escapes over ~100k characters)
needs 28s against a 10s timeout and still fails. Getting to O(1) needs the ASCII
prefix length CACHED per string, and a Milo `string` is a value with nowhere to put
it. Several tempting shortcuts were considered and rejected as unsafe: keying a memo
on the string's buffer ADDRESS (wrong after a free/reuse), on its byte length plus a
first/last-bytes fingerprint (collides across distinct strings), or on a content
hash (O(n) to compute, so no better than the scan).

**The real fix is architectural**: JS string VALUES need somewhere to carry
metadata — an interned string table, or a `JSStr` handle with `{bytes, asciiPrefix,
utf16Len}` — at which point indexing is O(1), `.length` is a field read, and the
converters disappear. That is the same shape as the object-heap migration in
[docs/milojs-arena-safety.md](milojs-arena-safety.md) and wants its own session,
with the string microbenchmark above as the acceptance test.

**Lesson:** the 38-second symptom was in `RegExp.escape`, which I had written two
ticks earlier, so the obvious read was "my new code is slow". Rewriting it to avoid
`+=` (the other obvious culprit) changed nothing — 38s before, 38s after. Only then
did measuring the primitive show that `charCodeAt` itself was the cost. Rewrite the
suspect once; if the number does not move, stop rewriting and measure a level down.

### Annex B block-level function hoisting — DONE 2026-08-17

Was scoped earlier the same day as "not started, wants a whole session", with the
blocker identified as needing var-vs-lexical tracking. Both halves turned out
cheaper than the note predicted, and the note's own proposed design was more work
than what shipped.

The old behaviour hoisted the function VALUE out of nested blocks, so `typeof f`
BEFORE `if (true) function f(){}` answered `"function"` and
`if (false) function h(){}` left `h` a function that had never been evaluated.
B.3.3 creates the var-scoped binding as **undefined** and assigns the value when
the declaration is EVALUATED.

The conflict rule is the part that needed care, because the two cases are
indistinguishable from a `Binding`:

    (function(){ let q = 1; { function q(){} } return q; })()   // node: 1
    (function(){ var v = 1; { function v(){} } return typeof v; })()  // node: function

**What shipped, and why it is smaller than the plan.** The scoped note proposed
recording lexical names per block in the PARSER. Not needed: `hoistStmt` already
walks the statements it needs, so `collectLexicalNames` computes the shadow set
during the hoist and `hoistStmt` carries it down (plus a `nested: bool` it did not
have). And rather than teach `Binding` about var-vs-lexical, `Scope` grew an
`annexBFns` list of the names the hoist created a placeholder for. Exec-time
write-back walks up to the first scope that RECORDED the name — so a `let` is never
touched, a `var` is, and there is no global fallback, because absence means the
hoist declined. Three files, no parser change.

Measured: whole-suite sample 68.2% to **68.6%**.

**Lesson:** the estimate was right that a partial version would trade passes for
regressions, and wrong about what "complete" cost. Both of this file's two
size estimates today (this and `\p{...}`) were pessimistic for the same reason —
they priced a design sketched in the same paragraph rather than the cheapest design
that satisfies the requirement. Sketch the alternative before quoting the number.

### A throwing argument did not abort its call — DONE 2026-08-17

`arr.push(boom())` pushed a value. `Math.abs(boom())` and `JSON.stringify(boom())`
caught correctly, and a user-function callee aborted correctly, so this looked like
it worked everywhere it was checked.

`evalArgs` sets `st.throwing` and returns the arguments evaluated so far; 41 of the
42 call sites then dispatched anyway. The one that already guarded was the
`console.log` fast path, added when someone noticed an argument that threw was
still being printed — the same bug, found once and fixed locally.

Where it actually hurt was invisible from the call site: a Promise executor doing
`try { resolve(f()) } catch (e) { reject(e) }` — the standard shape, and what
`Promise.try` is specified as — FULFILLED the promise with `undefined` before the
catch ran, so `reject` hit an already-settled promise and the rejection vanished.
That is `Promise.try`, and it is also why 32 test262 cases reported "Expected a
Test262Error to be thrown but no exception was thrown at all".

**Lesson:** a guard added at one call site to fix one symptom is a guard the other
40 sites still need. `console.log` printing a thrown-away argument and a promise
silently fulfilling with `undefined` do not look like the same bug, and they were.

### A NULL out-param killed the process and exited 0 — DONE 2026-08-16

Prompted by the milo maintainer finding that std/crypto passed constant lengths
across an FFI boundary where `requires` contracts are dropped at -O2. Their rule
is the transferable part: **the same construct is a different risk at an FFI
boundary**, because there the check is the last line of defence and nothing else
is watching.

milojs's Node-API surface is that boundary here. 45 entry points wrote to an
addon-supplied `result` pointer with no null check. node DEFINES this case: it
answers `napi_invalid_arg` and writes nothing. milojs called `memcpy` to address
0, and the observed failure is worse than the crash it sounds like:

    node:   status from NULL out-param: 1     (napi_invalid_arg)
    milojs: <no output>                       exit code 0

The process died mid-callback and reported success. A CI run reads that as a
pass. All 45 now return `NAPI_INVALID_ARG`, matching node.

Severity, checked before claiming it rather than after: **prospective, not
live.** No addon in the five applications tested does this, and one that did
would be broken against node too. What makes it worth fixing is the failure
MODE, not its likelihood.

Nine entry points are deliberately NOT guarded, because a NULL out-param is
meaningful for them: `napi_get_value_string_utf8` (NULL buf means "tell me the
length"), `napi_get_cb_info`, `napi_get_typedarray_info` and the handle-scope
family all treat it as "I do not want this output". Guarding those uniformly
would have broken working addons, which is why the sweep was reviewed per
function rather than applied to every `*u8` parameter.

Locked by `tests/napi/nullout.c`, which asserts the returned STATUS rather than
that the process survived: a run that died would print nothing and still exit 0,
so "we got here" is not an assertion.

### util.types lied about features this engine has — DONE 2026-08-16

Found with the milo maintainer's mechanical grep (functions whose whole body is a
constant return, where the NAME promises a check). Four `util.types` predicates
returned a constant `false`:

    isAsyncFunction(async function(){})   false, node true
    isGeneratorFunction(function*(){})    false, node true
    isGeneratorObject(gen())              TypeError: not a function
    isBoxedPrimitive(new Number(1))       false, node true

The first three are features milojs genuinely has, so a caller dispatching on
`util.types` took the wrong branch silently. Fixing them needed the type tags
first, which were also wrong: an async function, a generator function and a
generator object all reported `[object Function]` or `[object Object]`. They now
report `AsyncFunction`, `GeneratorFunction`, `AsyncGeneratorFunction`,
`Generator` and `AsyncGenerator`, matching node, which is what
`Object.prototype.toString` is supposed to say and what the predicates read.

Two remain `false`, both for reasons that are properties of the engine rather
than guesses, and both written as real checks so they become correct on their own
if that changes:

- **`isProxy`**: a Proxy here is indistinguishable from its target through any
  JS-visible channel (its type tag reflects the target, as in node). node answers
  true using an internal slot this engine does not expose.
- **`isBoxedPrimitive`**: there are no wrapper objects to find. `new Number(1)`
  returns the PRIMITIVE 1 (`typeof` is `"number"`, `instanceof Number` is
  false), so `new String`/`new Boolean`/`new Number` are all identity. That is
  the real gap and it is bigger than these predicates: it is also why
  `Number.prototype` is a plain object rather than a Number wrapping 0.

### The UTF-16 model is lossy for lone surrogates — OPEN

Found by turning the milo maintainer's "grep for JUSTIFICATIONS, not limitation
notes" at code I had written hours earlier. milojs strings are UTF-8, which has
no encoding for an unpaired surrogate, and two operations lose data rather than
erroring:

| expression | milojs | node |
|---|---|---|
| `String.fromCharCode(0xD800).charCodeAt(0)` | 65533 (U+FFFD) | 55296 |
| `JSON.parse('"\ud800"').charCodeAt(0)` | 65533 | 55296 |
| `"\u{1F600}".slice(0,1).length` | 2 (whole char) | 1 (the high half) |

The substitution is silent. A program doing surrogate arithmetic, or round-
tripping JSON that contains `\ud800`, gets a different string back and no
indication. Fixing it means a representation that can hold unpaired surrogates
(WTF-8, or UTF-16 units with a UTF-8 fast path), which is a string-layer decision
rather than a patch.

`isWellFormed`/`toWellFormed` were rewritten to SCAN for unpaired surrogates
instead of returning `true` unconditionally. The answers are identical today,
because no operation can produce one; the point is that the old version argued an
invariant about the rest of the engine from a site that cannot enforce it, so it
would have become a lie silently. A scan keeps working if the representation ever
changes.

**A correction worth keeping.** On first reading `"\u{1F600}".slice(0,1).charCodeAt(0)`
answering 55357 in both engines, I concluded milojs COULD hold half a character
and that my earlier reasoning had been wrong twice over. It had not: 55357 is
simply the first unit of the whole character milojs returns, and its `.length` is
2 where node's is 1. Condemning your own earlier work is not automatically the
rigorous move; it needs the same evidence as defending it.

### An audit for silent limitations, mostly negative — 2026-08-16

Run at the milo maintainer's suggestion after they found `std/json` decoding
surrogate pairs into CESU-8. Their refined property is the useful one: **grep for
limitations that are SILENT, not for limitation comments.** A comment saying
"only X is supported" next to code that throws is fine; the dangerous shape is a
comment that justifies returning a plausible wrong answer, and it survives review
because the code matches its own documentation perfectly.

Yield here, reported in full because most of it is negative:

- Every other limitation in `src/` and `lib/` is LOUD: `child_process`, `https`,
  `net.createServer`, `http.request`, `tls.connect` and the sqlite BigInt cases
  all throw with a message naming the gap.
- **`normalize` was the exception**, and its comment was actively false. See
  above.
- **A stale comment in `parseClass`** said class fields and getters are
  unsupported and that a getter parses as a method. All of it works. This is the
  quietest kind of wrong doc: it under-claims, so nobody hits a bug, they just
  avoid a feature that works.
- **Fixture flakiness: none.** Six fixtures use `setImmediate`, `Math.random`,
  `Date.now` or `hrtime`. Ran node 6x and milojs 8x against each: all
  deterministic on both sides. The one that WAS flaky by construction
  (`eventLoop`) had already been found and fixed. Note the method: running only
  the side you control proves nothing, which is the lesson from that fixture.

### Error stacks carry frames, and a subclass gets one at all — DONE 2026-08-16

`new Error("boom").stack` was the header line alone, with no frames, and
`class E extends Error {}` produced an instance whose `.stack` was **undefined** —
the one property a caller reaches for when logging a custom error.

Both fixed using the frame machinery added for V8 structured traces
(`fnFileStack`). A stack now names the source file of each function on the call
stack. Deliberately no line or column: this engine records no per-frame position,
and `:0:0` would be fake precision a reader would try to use. Frames stay
repo-relative rather than absolute, because an absolute path would make the
fixture machine-specific and uncommittable. Locked by `tests/errorStacks.js`,
which is byte-identical to node.

### A fixture that pinned an order node does not guarantee — DONE 2026-08-16

`tests/eventLoop.js` asserted that `setImmediate` runs after the 0ms/1ms timers.
**node does not guarantee that in the main module**, and does not deliver it
consistently: across 15 runs it printed "immediate" at line 6 eight times and at
line 8 seven times, because whether the 0ms timer is already due depends on how
long process startup took. milojs is deterministic (15/15 at line 6).

So the fixture was flaky by construction, and its exemption was recording a
divergence that was really a coin flip. The fixture now asserts what node does
guarantee: that `setImmediate` runs, and after the microtask drain. Deterministic
in both engines, 10/10 against the committed capture, and the exemption is gone
for a real reason this time.

**How this was found is the part worth keeping.** I deleted that exemption
earlier the same hour on a SINGLE observation that it matched node, which is the
exact mistake this file warns about elsewhere: one run is not a measurement. The
STALE check added minutes before caught it and put the exemption back. Then the
12-run retest said "deterministically divergent", which was also wrong, because
it compared against one node capture that happened to be the other coin face.
The truth needed running BOTH engines repeatedly. A gate written an hour earlier
caught its author.

### An exemption that stopped diverging — DONE 2026-08-16

`tools/verify-expected.sh` checks every `.expected` against node, and
`tests/.node-oracle-exempt` is the list of fixtures it skips. Each entry is
argued in the file, which is good, but nothing re-tested them.

**`tests/eventLoop.js` had stopped diverging.** Its exemption said setImmediate
runs before the 0ms/1ms timers where node runs the timer phase first. That was
fixed at some point and the exemption outlived it: the fixture had been matching
node exactly while sitting behind a hole in the gate. It is a node-verified
fixture again and the entry is gone (5 exemptions left, from 6).

Two checks added so the registry cannot rot the same way again, both proven to
fire before being committed:

- **STALE**: every DIVERGENCE exemption is re-run against node, and one whose
  output already matches fails, telling you to delete it. A gate stops gating
  when its exceptions outlive their reasons, and nothing was watching for that.
- **UNARGUED**: the file's own rule was "do not add a DIVERGENCE without a
  backlog entry", enforced by nobody. It is checked now. NOT-RUNNABLE entries
  are exempt from that rule, because node genuinely cannot run them and there is
  no bug to track, so the headings in the file are read rather than decorative.

The rule this came from, borrowed from the milo maintainer, who hit it the same
day from the other side (a fixture that passed only because a worse parse error
let the checker recover far enough to reach the assertion): **a fixture that can
be satisfied by weakening the thing under test was not testing it.** The local
form is that an exemption list nobody re-tests is a way to make a failing fixture
pass, one commit at a time.

### matchAll answered an array, and six methods were missing from String.prototype — DONE 2026-08-16

Chasing the 0/25 above. The flat zero was one wire, as the pattern predicted:

- **`matchAll` returned an ARRAY where the spec says an iterator.** So the common
  `[...s.matchAll(re)]` worked and nothing else did: `.next` was absent, and
  spreading the same value twice yielded the matches twice where an iterator is
  exhausted after one pass. It reuses the existing array iterator now, which
  supplies `next`, `@@iterator` and the one-shot behaviour together.
- **A non-global regex no longer silently succeeds.** The spec makes it a
  TypeError, because the result would repeat the same match forever.
- **Six methods dispatched by name but were absent from `String.prototype`:**
  `matchAll`, `at`, `codePointAt`, `replaceAll`, `localeCompare`, `normalize`.
  `typeof "".matchAll` was `"undefined"`, so anything starting from the prototype
  (which is how test262 is written, and how `Function.prototype.call.bind` and
  every uncurry idiom work) failed before calling anything.

| area | before | after |
|---|---:|---:|
| `String/prototype/matchAll` | 0/25 | **5/25** |
| `String/prototype/at` | 0/11 | **9/11** |
| `String/prototype/localeCompare` | 3/13 | **9/13** |
| `String/prototype/replaceAll` | 5/45 | **9/45** |

`at` was a second flat zero from the same cause, which is the pattern holding a
third time: **a whole subsystem reading as broken is more often one wire than N
faults.** The 1500-sample did not move (699 either way); these directories are
not in it. Locked by `tests/matchAllAndStringProto.js`.

### Character classes were byte ranges too — DONE 2026-08-15

`ReClass` held `u8` ranges, so a class compared one byte at a time:

| expression | was | node |
|---|---|---|
| `/^[à-ÿ]$/u.test("é")` | false | true |
| `/^[^a]$/u.test("é")` | false | true |
| `/^[а-я]+$/u.test("привет")` | false | true |
| `"aéb".match(/[^x]/gu).length` | 4 | 3 |

Ranges are code points now, class members parse as code points (so `[à-ÿ]` is one
range rather than four bytes of which two look like one), the shorthand
complements span to 0x10FFFF instead of 0xFF, and case folding inside a class
goes through the real Unicode mappings so `/[à-þ]/i` matches É.

One more had to move with it: **the search loop advanced one BYTE per failed
attempt**, restarting the match inside a multibyte character where a decode reads
a continuation byte as its own code point. `/[^é]/u.test("é")` was true because
the retry at offset 1 "matched" the second half of the é it had just rejected.
It steps a whole character now.

`built-ins/RegExp` did not move (734/1879 either way): test262's coverage here is
almost entirely ASCII, which is the same observation that made the real-app check
worth building. The evidence is the 31-case differential fixture.

**Closed 2026-08-17.** `\p{...}` shipped exactly in the shape this predicted:
table generation plus a branch in the class parser. See the entry below for why
the size estimate that had blocked it was wrong.

## The runtime hid globalThis behind a whitelist, and four missing members — DONE 2026-08-15

- **`globalThis` was a hand-written object in the RUNTIME.** The engine installs
  a real one whose property reads resolve through the global scope, and
  `src/milojs.milo` then overwrote it with a bare `{}` (plus a prelude object
  listing about twenty well-known names). So `globalThis.Symbol`,
  `globalThis.Reflect`, `globalThis.Proxy` and every typed array read as
  undefined under `milojs` while working under `milojs-engine`. Feature detection
  is written that way constantly. The comment in milojs.milo claimed the engine
  exposed no global-object reflection; it does, through the `isGlobal` flag.
  Now identical to node across 12 probed globals, plus `global === globalThis`
  and the self-reference.
- **`Object.groupBy` / `Map.groupBy`** (ES2024) added.
- **`String.prototype.isWellFormed` / `toWellFormed`** (ES2024) added. milojs
  strings are UTF-8, which cannot represent a lone surrogate, so every string
  here is well-formed by construction and saying so is more useful than omitting
  the methods.
- **`%TypedArray%.of` / `.from`** added, `from` taking an iterable or array-like
  plus an optional map function.
- **`structuredClone` was already implemented** and the backlog entry was stale.

Two things worth keeping from how this went wrong:

- **Adding `isWellFormed` via `String.prototype` broke `normalize` and
  `localeCompare`.** Assigning to that prototype marks it touched, which turns
  off the by-name string dispatch, and any method living only on that path
  disappears. They are implemented in `stringMethod` instead. Anything added to
  `String.prototype` from JS carries the same risk.
- **`Set` is iterable but its `Symbol.iterator` is not readable as a property**,
  so `typeof src[Symbol.iterator] === "function"` is a broken iterability test
  here. `%TypedArray%.from` spreads instead.

Locked by `tests/runtime/modernSurfaceAndGlobal.js`.

## An in-progress compiler change broke async, and how it was found — RESOLVED

For a few hours this repo's suite was red with eight fixtures failing, all
async/generator/green-task shaped: `doubleBind`, `generatorProtocol`,
`microtaskHandlerGcRoot`, `objectGeneratorMethods`, `promises`, `r2r3Barrier`,
`r6LocalsLiveAcrossSuspend`, `staticAccessors`. The symptom was silent: `await`
on a BOUND async function produced no output, no error, exit code 0.

```js
function C(x){ this.x = x; }
C.prototype.m = async function(a){ return this.x + a; };
var mm = new C(7).m.bind(c);
async function main(){ console.log(await mm(3)); }   // expected 10, printed nothing
main();
```

**Nothing pushed to milo was ever broken.** The first diagnosis written here said
"a regression between `b5a40d2b` and `03635d2b`", and that was wrong: the milo
maintainer bisected every pushed commit in that range and all of them print 10.
The breakage was in their UNCOMMITTED working tree, which this repo builds from,
because `milo` on PATH is a symlink into that checkout. Cause: new drop glue for
closure environments, specifically `reapTask` releasing a spawned task's
environment. That one release has been dropped from what they are landing; a
spawned task's environment keeps leaking exactly as it does today.

Two things to keep from this:

- **A red suite here can mean a dirty compiler tree, not a landed regression.**
  Check `milo --version` against `~/git/milo`'s status before writing anything
  down, and say "the compiler this was built with", not "a pushed commit".
- **Conformance numbers must not be republished while the toolchain is
  suspect.** The 1500-sample read 682 during the outage against the 699 on
  record; publishing that would have recorded a 17-case decline that never
  happened in this repo. Re-measured after the fix: 699 and 99 again, exactly
  what was already published.
- **Check `uptime` before believing a number that moved without a code change.**
  This machine is shared with other agents building the compiler. A suite run
  here went 4s to 16s (and run-milo 14s to 49s) with no source change at a load
  average of 12.96, and the milo maintainer independently saw full-suite runs
  report 19, then 202, then 21, then 32 failures with different membership each
  time, every one of which passed when run alone. Re-run before diagnosing.

Resolved on the milo side by `3436dd96`: the codegen glue had been swept into an
unrelated commit WITHOUT its std/runtime half, so spawn paths were not forgetting
what they hand over. Verified from this repo against `e551a4e6`: 209/209 fixtures
over three consecutive runs, both GC-pinning fixtures clean under
`MILOJS_GC_THRESHOLD=1`, tahoeroads and chat still byte-identical to node, and
conformance back to 699/99.

**The lifetime question is still open, and this repo is the one that can answer
it.** milojs matches tasks by RAW POINTER and holds those pointers past the
body's completion, in `genTask`/`genEnv`, `actTask`, and
`awaitTask`/`suspendedTask`. The abandoned-generator case is unbounded rather
than a window: `for (const x of g()) break;` leaves a body task that never
finishes and never gets a terminal read, so `removeGen` never runs. A
"task is about to be reclaimed" hook would let us drop our record and delete the
recycled-address workaround documented above `removeGen`; the requirements we
need from it are recorded in that discussion (fire before reuse, fire for
abandoned tasks too, hand back the task pointer, be safe to call mid-reap).

Open on the milo side, and this repo is the one that can answer it: something
reaches a spawned task's environment AFTER the task is reaped, which is why
releasing it breaks async. See milo's backlog #18.

## Node-API: 20 entry points added, and three real addons load — 2026-08-15

An audit of every `.node` file across five real applications, by diffing the
symbols each one needs against the symbols milojs exports:

| addon | v8 syms | napi syms | status |
|---|---:|---:|---|
| prisma query engine | 0 | 60 | loads (tahoeroads serves DB-backed pages) |
| `sharp` | 0 | 52 | **now loads** |
| `fsevents` | 0 | 20 | **now loads** |
| `onnxruntime-node` | 0 | 65 | linux/x64 build, not testable here |
| `better-sqlite3` | **49** | 0 | cannot load, see below |

`sharp` named 18 entry points that were **absent from the binary rather than
stubbed**, which is a different failure: a missing symbol makes `dlopen` fail
before the addon runs a line. Added, with `fsevents`'s two on top:

- handle scopes: `napi_open_handle_scope`, `napi_close_handle_scope`, the
  escapable pair, and `napi_escape_handle`. Every handle is already mirrored into
  the interpreter's foreign-host root set for its lifetime, so a scope has no
  storage to reclaim and these are bookkeeping.
- async work: `napi_create_async_work`, `napi_queue_async_work`,
  `napi_delete_async_work`. node runs `execute` on a libuv threadpool and
  `complete` on the loop thread; milojs has one JS thread, so queueing runs
  execute and then complete in that order. An addon sees its work finish
  correctly, but gets no parallelism, so a long execute blocks the loop.
- values: `napi_create_string_latin1` (one byte per code point, not UTF-8),
  `napi_get_value_int64`, `napi_get_typedarray_info` (length in ELEMENTS, and
  `data` pointing at the VIEW's first byte, not the buffer's, or a subarray reads
  the wrong bytes), `napi_create_external` / `napi_get_value_external`.
- properties: `napi_define_properties` (honouring accessors, not flattening a
  getter into a data property), `napi_has_property`, `napi_has_own_property`,
  `napi_add_finalizer`.
- errors: `napi_get_last_error_info`, `napi_is_exception_pending`,
  `napi_create_type_error`.

Two bugs in the engine came out of writing the test addon for them:

- **A Node-API accessor never fired.** `getMemberDyn` gated its getter on
  `isCallable`, the value-only predicate, and a Node-API function is an OBJECT
  carrying a `napiFn` index. `isCallableIn` recognises it.
- **`objHasInChain` stopped one level short.** A plain object's `proto` field is
  -1 and the link to Object.prototype is resolved by type, so the raw walk
  reported `toString` as absent.

Also fixed: **the preloader tried to PARSE `.node` files as JavaScript**, and
reported `expected an expression, found '<'` against a Mach-O load command table.
`.node` files are dlopened at require time and must not be followed by the module
graph walk.

Locked by `tests/napi/surface.c` and `tests/napi/surface.js`, which are a link
test first: if any of these regresses out of the build, loading the addon fails
outright. Writing them also caught a misuse worth recording: deleting an
async_work straight after queueing frees it under a live threadpool worker, and
node segfaults. The handle is deleted from the complete callback instead.

**better-sqlite3 stays out of reach, and no amount of Node-API work changes
that.** Its 11.10.0 prebuilt links the V8 C++ API: `nm -u` shows 49 `v8::`
symbols and zero `napi_`. Implementing those means reproducing V8's object
layout, not just its function names, because the V8 headers inline much of it.
For scale: Bun's V8 compatibility layer is ~4,300 lines and its own notes
describe it as "V8-compatible object layouts that inline V8 functions can read"
plus tagged pointers and handle-scope buffers. The three sqlite apps need a
sqlite package that is napi-native instead.

## console had 11 missing methods, could not be overridden, and wrote diagnostics to stdout — DONE 2026-08-16

Found by running `html-escaper`'s own test suite, whose first statement is
`console.assert(...)`. Three separate defects, in increasing order of how much
they matter:

**Missing methods.** `assert`, `table`, `group`, `groupEnd`, `groupCollapsed`,
`time`, `timeEnd`, `timeLog`, `count`, `countReset` and `clear` did not exist.
Each was not a degraded log line but a `TypeError` that killed the program: a
library that instruments itself with `console.time` cannot even be imported.
Added in `lib/prelude.js` with node's semantics, including group indentation
applied to every stream and `console.assert` printing only on a falsy first
argument.

**`console.log` could not be overridden.** `evalCall` had a fast path that fired
on the receiver being named `console` and the method being a known name, so
`console.log = fn` was accepted and then ignored. Monkey-patching console is how
loggers, test harnesses and output capture all work, so this silently broke a
whole class of library. The fast path now consults `consoleMethodIsPristine`,
which checks the live binding is still the native before taking the shortcut.

**`console.error` and `console.warn` wrote to stdout.** Any program whose stdout
is piped or parsed got its diagnostics interleaved into its data. Both the native
(`NATIVE_CONSOLE_ERROR`) and the fast path now select `eprint`. The two sites had
to be fixed together: fixing only the native left the shortcut still wrong, which
is exactly what the first verification pass caught.

Locked by `tests/runtime/consoleSurface.js`, which diffs stdout and stderr
against node separately — the combined-stream capture that `tests/run.sh` uses
cannot see a stream mix-up at all.

## Built-in arguments skipped ToString, and `new` could not take a computed callee — DONE 2026-08-16

Found by a new method: install real npm packages and run each one's OWN test
suite under milojs and under node, then diff. 53 of the packages installed as
transitive dependencies ship a runnable `test/index.js`. All 53 failed, and all
53 failed for the same reason, which is what made the method worth keeping: a
corpus that fails as a block is pointing at one defect, not fifty-three.

**Arguments to built-ins were never coerced through the interpreter.**
`builtins.milo` has no `Prog` and so cannot re-enter the evaluator; its `argStr`
and `argNum` answer `"[object Object]"` and `NaN` for every object, skipping the
user `toString`/`valueOf` the spec requires calling. 13 of 17 probed operations
were wrong: `exec`, `test`, `@@match`, `indexOf`, `includes`, `startsWith`,
`split`, `replace`, `padStart`, `repeat`, `at`, `charAt`, `slice`.

That is a spec deviation on its own, but the reason the whole corpus died is
narrower. `is-regex` identifies a regex by handing `RegExp.prototype.exec` an
object whose `toString` throws a private marker, and answering whether the
marker comes back. An engine that stringifies without asking makes the function
return `undefined` — neither true nor false — and `safe-regex-test` then rejects
an actual RegExp with "`regex` must be a RegExp". `tape` is built on that path,
so no package that tests with tape could load.

Fixed by coercing at the dispatch boundary, in `eval.milo`, where a `Prog`
exists and a throwing conversion has somewhere to throw from; `builtins.milo`
stays prog-free. The position table (`strArgWantsString`/`strArgWantsNumber`) is
per method because the spec is: `padStart` ToNumbers argument 0 and ToStrings
argument 1. It runs after the regex-op branch, since stringifying a RegExp
argument would turn `s.replace(/a/g, "x")` into a search for the literal `/a/g`.

**`new` accepted only `.name` in its callee.** `parseNew` looped on `T_DOT` and
nothing else, so `new g[name]()` parsed as `new g` and reported "value is not a
constructor" against the container instead of constructing what the key names.
`new g.Uint8Array()` worked, which is why this survived: the two forms are
interchangeable everywhere else. Indexing a table of constructors is how
`which-typed-array` builds one instance per global name.

Next barrier in the same corpus, not fixed here: `Object('a')` returns the
primitive rather than a String wrapper object, so `0 in Object('a')` throws.
That is the primitive-wrapper item already open below.

Locked by `tests/coercionAndNewCallee.js`.

## Primitive wrapper objects did not exist — DONE 2026-08-16

`new String("a")`, `new Number(1)`, `new Boolean(false)` and `Object(prim)` all
handed back the PRIMITIVE. Three observable things were wrong at once: `typeof`
said "string", `new Boolean(false)` was falsy, and the result was `===` its own
primitive. The fourth consequence is the one that surfaced it: `0 in Object("a")`
threw, because the `in` really was being applied to a string.

Found by the npm-package corpus. `array.prototype.every`'s first two lines are

    var boxedString = Object('a');
    var splitString = boxedString[0] !== 'a' || !(0 in boxedString);

a feature probe for an engine bug from 2010, and it is a dependency of tape.

A wrapper is now an ordinary object carrying `JSObjExtra.boxed`, which doubles as
its own discriminator since no wrapper ever holds undefined or null. A String
wrapper materialises its index properties and `length` eagerly, frozen and (for
the indices) enumerable, matching node's descriptors: the string behind them can
never change, so there is nothing to keep in sync and every path that enumerates,
tests `in`, or reads a key works without a special case.

The paths that had to learn about it:

- **ToPrimitive** unwraps, which covers `+`, template holes, `String()`,
  `Number()`, and relational comparison in one place.
- **`==` between an object and a primitive** now converts the object side. That
  is the general spec rule, not a wrapper special case; it was simply missing.
- **Method dispatch** delegates to the primitive for anything the wrapper does
  not own, because the prototype's entries are bound methods carrying no
  receiver. A user-defined override still wins.
- **instanceof**, **spread/iteration**, **`Object.prototype.toString`** tags, and
  **JSON.stringify**.

Two things learned the hard way. JSON.stringify is implemented in
`lib/engine-prelude.js`, not in the native: the native cannot call back into user
code, so `toJSON`, the replacer and the reviver live in JS. Unwrapping in
`mjPushStringified` therefore had no effect at all, and the debug print that
proved the branch was never reached was worth more than the reasoning that said
it should have been. And `Object.prototype`'s own methods were enumerable, which
nothing had ever exposed because a plain object is not linked to it here; String
wrappers listed `hasOwnProperty`/`toString`/`valueOf`/`isPrototypeOf` among a
string's indices in for-in until they were marked non-enumerable.

Measured on the 53-package corpus: 52 of 53 suites now execute (they previously
died before their first assertion), 666 of 1699 assertions pass where 0 did, and
20 packages match node's assertion count exactly. The remaining gap is spread
across many small causes rather than one barrier, which is a different kind of
work from the three single-cause fixes that got here.

Locked by `tests/primitiveWrappers.js`.

## An absolute entry path under the working directory broke every node_modules require — DONE 2026-08-16

`milojs /path/to/app/main.js` run from inside `/path/to/app` failed with
"module was not pre-loaded" on every `require`, while the same program run as
`milojs main.js`, or with the same absolute path from a different working
directory, worked. Absolute entry plus cwd-at-or-above-the-entry is the common
shape — it is what a shell script, a supervisor, and an editor's run button all
produce.

The module registry keys on the paths the PRELOADER produced, and require
resolves through `relativizeToCwd`. An absolute entry keyed the whole graph
absolutely while every lookup arrived in relative form, so nothing matched. The
entry path is now relativized before the graph walk, and `preloadGraph` returns
the entry's index by the same key it registered it under — the second half
mattered: relativizing only the queue made the entry itself unfindable and
turned the failure into "cannot read".

Found because `tools/check-packages.sh` passed absolute paths.

## tools/check-packages.sh: real packages' own test suites as a gate — 2026-08-16

The fixtures in `tests/` are written by whoever is fixing something, so they
encode what was already suspected. A package's own suite does not. Three defects
in one sitting — built-in arguments skipping ToString, `new` rejecting a computed
callee, primitive wrappers not existing — were each invisible to all 217
fixtures and each fatal to roughly fifty npm packages.

The corpus is the ljharb/es-shim dependency tree, on purpose: those packages
feature-detect the engine aggressively and test with tape, so one engine defect
shows up as a whole suite that cannot start. That amplification is what makes
the signal readable — a corpus that fails as a BLOCK is pointing at one cause,
and each of the three fixes above took the block from 0 assertions to thousands.

Counted per TAP assertion rather than per suite: a suite that dies on its first
line and a suite that fails one edge case are very different results, and
pass/fail per file cannot tell them apart. `tools/packages-baseline.txt` holds
the last measured pair and the script fails only on a DECREASE, because the
number moves with the corpus as well as with the engine.

Today: 53 suites run, 666/1699 assertions, 20 suites complete. Before this
session's three fixes: 0/1699 and 0 complete.

## Prototype methods accepted any receiver, so every is-* detector answered true — DONE 2026-08-16

`String.prototype.valueOf.call([])` returned `""` instead of throwing. Same for
`Number.prototype.valueOf`, `Boolean.prototype.valueOf` and every Date getter.
Not a quiet deviation: calling a prototype method on a candidate and catching
the TypeError IS the detector that `is-string`, `is-number-object`,
`is-boolean-object`, `is-date-object`, `is-weakref` and
`is-finalizationregistry` are built on, so each of them reported arrays,
objects and regexes as instances of its type.

The existing `boundBrand` mechanism (built for the buffer family) already had the
shape; it needed four more brands and a receiver rule that accepts the PRIMITIVE
as well as the wrapper, since `String.prototype.valueOf.call("abc")` is legal and
`.call([])` is not. Three related fixes fell out of it:

- **`String.prototype.valueOf` on a primitive returned undefined.** It was never
  implemented in `stringMethod`, so the detector failed in the other direction.
- **`String.prototype` really is a String object.** The spec gives it, and
  Number.prototype and Boolean.prototype, a [[StringData]]/[[NumberData]]/
  [[BooleanData]] slot holding `""`, `0` and `false`. That is why
  `String.prototype + ""` is `""`, and it is why the brand check must accept the
  prototype as a receiver for its own valueOf. Symbol.prototype, BigInt.prototype
  and Date.prototype are ORDINARY objects by contrast, and node throws for their
  branded methods called on themselves; the fixture pins both halves.
- **The REST of String.prototype is generic** and ToStrings whatever receiver it
  gets: `String.prototype.indexOf.call(["a","b"], "b")` is 2, because the
  receiver becomes `"a,b"` and the array is not searched as an array. milojs
  answered 1 by dispatching on the array. Branding those methods generic and
  converting the receiver at the bound-method call sites fixes it while keeping
  null/undefined a TypeError.

**A defect of my own, caught by the new gate.** The `==` object-vs-primitive
conversion added with the wrapper work converted `obj == null` too. The spec
resolves that to false with NO conversion, and get-intrinsic opens with exactly
that null guard against `Date.prototype`, whose valueOf now correctly throws. So
a correct fix (brand checks) turned an already-shipped bug (over-eager `==`
coercion) fatal. `tools/check-packages.sh` went 666 to 0 assertions and refused
to pass, which is the entire argument for having built it a run earlier.

Corpus: 666 to 701 assertions, 20 to 26 suites complete.

Locked by `tests/receiverBrandChecks.js`.

## `this` in a receiver-less call was undefined, and Function was not callable — DONE 2026-08-16

Two defects that only look separate. `Function("return this")()` is how a
library finds the global object, and it needed both halves to work.

**`Function` was a plain object holding `.prototype`.** Calling it reported
"Function is not a function", and `new Function(a, b, body)` reported "value is
not a constructor". It is now a Native built on the same evaluator `eval` uses,
producing node's exact source layout (`function anonymous(a\n) {\nbody\n}`)
because `Function.prototype.toString` on the result is observable. Always the
global scope: a function built this way never closes over its caller, which is
the difference from direct eval. es-get-iterator (140 assertions) and
function-bind (46) build their test subjects with it and could not start.

**`this` in a call with no receiver was `undefined`, not `globalThis`.** This is
OrdinaryCallBindThis and it was simply absent, so every UMD wrapper, every
`var global = (function(){ return this })()`, and every sloppy-mode method
extraction saw the wrong value. Fixed at the single point where a frame binds
`this`. The engine tracks no strict mode, so it applies the sloppy rule
throughout, which is also the mode the test262 sweep runs in.

Also: **`fn.constructor === Function`** and **`fn instanceof Function`** were
both false. Functions are not objects in this value model, so nothing linked
them to `Function` and the instanceof walk never saw them.

Corpus: 701 to 760 assertions.

Locked by `tests/functionConstructor.js`.

## RESOLVED 2026-08-16: Function.prototype.toString returns "[object Function]", never source

Every function stringifies to `[object Function]` — declared, expression,
arrow, or built by `new Function`. Node returns the verbatim source text, and
libraries read it: lodash distinguishes native from user functions by looking
for `[native code]`, and several detectors parse the parameter list out of it.

Blocked on the lexer, not on the printer. `Token` carries `kind`, `num`, `text`,
`nlBefore` and `raw` but no byte offset, and `FuncDef` keeps no span, so there is
nothing to slice the original source with. Reconstructing text from the AST would
not fix it either: the `.expected` files are byte-exact against node, and a
pretty-printer cannot reproduce the author's spacing.

The fix is offsets on Token, a start/end span on FuncDef, and the source text
retained per module. Worth doing, but it touches the hot lexer path and should
be measured, not assumed free.

## getPrototypeOf/setPrototypeOf ignored primitives, and Symbol.iterator was unreadable on Map/Set/String — DONE 2026-08-16

`Object.getPrototypeOf` and `Reflect.getPrototypeOf` differ in exactly one way:
Object BOXES its argument, so `Object.getPrototypeOf(42)` is `Number.prototype`,
while Reflect does not and throws for the same input. milojs returned `null` for
every primitive from both and threw from neither. Four packages test precisely
that boundary — get-proto, reflect.getprototypeof, dunder-proto, set-proto — and
between them account for 30 failing assertions.

Fixed: `Object.getPrototypeOf`/`setPrototypeOf` follow ToObject (nullish throws,
a primitive resolves to its wrapper prototype), and every `Reflect` entry point
requires a real object. `__proto__` reads on primitives resolve the same way, and
`Object.prototype.__proto__` is now a visible accessor descriptor — the evaluator
still short-circuits `__proto__` before any chain walk, so the property makes the
descriptor VISIBLE rather than implementing the behaviour, which is what
dunder-proto reads off it.

**Two latent bugs surfaced by the Reflect check, in the same pattern as the
`obj == null` one.** Making Reflect reject a non-object turned two silent wrong
answers into hard failures, and the corpus went to 0 twice more:

- **%IteratorPrototype% was not linked to Object.prototype.** The array-iterator
  chain was one link shorter than node's, so walking it three deep answered null.
- **`Map.prototype[Symbol.iterator]`, `Set`'s and `String`'s did not exist as
  readable values.** for-of and spread always worked because they drive the
  collection directly and never read the member. get-intrinsic resolves
  `%MapIteratorPrototype%` by CALLING it, which is a different thing.

That second one needed fixing in two places, and the reason is worth recording:
`m[Symbol.iterator]` extracted and then called goes through the member-read path,
while `m[Symbol.iterator]()` written as one expression dispatches by the symbol
KEY. The extracted form worked as soon as the member read was fixed, so the
direct form looked fixed too until the corpus said otherwise.

Corpus: 760 to 796 assertions.

Known divergence, not fixed: `Object.getOwnPropertyDescriptor(Object.prototype,
'__proto__').get.call(undefined)` returns Object.prototype where node throws. The
getter is a strict built-in, so node leaves `this` undefined; milojs has no
strict-mode tracking and substitutes globalThis for every receiver-less call. The
two are indistinguishable at the call site without tracking strictness.

Locked by `tests/prototypeOpsAndIterators.js`.

## Four defects in Function.prototype.bind, and match/search rejected string patterns — DONE 2026-08-16

**bind.** The result carried no own `length` or `name`, `.call` on it replaced
the bound receiver instead of ignoring the call-site one, and `new` on it
reported "value is not a constructor". A wrapper that preserves arity by reading
`fn.length` off a bound function got `undefined`; function-bind asserts all four.
`length` is now the target's less the pre-bound arguments (floored at 0) and
`name` is `"bound " + target name`, set at every one of the six sites that build
a bound object. `.call`/`.apply` route through `callValue` on the bound object
itself, which already merged the bound receiver and arguments correctly — the
bug was one site calling the TARGET directly and discarding both. `new` on a
bound function constructs the target with the bound arguments in front and the
bound `this` ignored, per [[Construct]].

**match/matchAll/search with a string pattern returned undefined.** The spec has
no non-regex form for these three: it builds a RegExp from whatever it is handed,
so `"a1b".match("\\d")` is `["1"]`. `replace` and `split` DO have literal-string
forms and keep them, which is why the conversion is keyed to the three names
rather than applied to every regex-ish op.

Locked by `tests/bindAndStringPatterns.js`.

## RESOLVED 2026-08-16: is-callable reports every object as callable

`isCallable({})` is `true`. The package detects callables by calling
`Function.prototype.toString` on the candidate inside a try/catch; milojs accepts
any receiver there, so nothing throws and everything looks callable. Classes are
also reported callable, because that check regex-matches `/^\s*class\b/` against
the source text milojs does not have.

Branding `Function.prototype.toString` to require a callable receiver was tried
and REVERTED: it fixes `isCallable({})` but costs 9 assertions elsewhere in the
corpus, through a path that ends in "String.prototype.match called on
incompatible receiver" during tape's own reporting and was not diagnosed. It is
also only half a fix while the source text is missing, since class detection
stays broken either way. Both halves want the lexer-offset work in the
Function.prototype.toString entry above; they should land together.

## Function.prototype.toString now returns real source — DONE 2026-08-16

Every function stringified to `[object Function]`. Not merely imprecise: lodash
and friends tell a built-in from a user function by looking for the exact string
`[native code]`, so every user function looked native; and is-callable decides
whether a value is callable by whether `Function.prototype.toString` throws on
it, so every object looked callable.

Answering it needs the VERBATIM text — the `.expected` files are byte-exact
against node, and a pretty-printer cannot reproduce the author's spacing. So:

- `Token` gains `at` and `end` byte offsets. Stamped centrally in the lex loop
  rather than at each of the ten Token literals, several of which are built in
  helpers that never see the cursor. Each iteration consumes exactly one token
  or only whitespace, so at the top of the NEXT iteration the cursor is exactly
  the previous token's end.
- `FuncDef` gains `srcStart`/`srcEnd`, filled at all six construction sites.
  `async` is included because the caller consumed it and node's output has it;
  a class METHOD starts at its name while a static BLOCK starts at `static`.
- `Prog` keeps each file's text once, so a span can be sliced back out. Once per
  file, not per function: a function's text contains every nested function's
  text, so per-function slices would duplicate the program at each nesting level.

Built-ins keep node's `function <name>() { [native code] }`, and a genuine
bind() result prints anonymously where a built-in METHOD value keeps its name.
ToString of a function is its source everywhere, not only through `.toString()`:
`String(fn)`, `"" + fn` and `${fn}` all had to be routed through the Prog.

**Two latent bugs this exposed.** `Object.getPrototypeOf(fn)` answered
Object.prototype for every function: a function's property BAG is an ordinary
object, and the bag was what got asked. A bag with a DELIBERATE prototype still
wins, which matters because `Object.getPrototypeOf(Int8Array)` is the
%TypedArray% intrinsic and test262's whole TypedArray tree opens with that read.
And `String(x)` used the prog-free `toStr`, so a user `toString` never ran there.

With those fixed, branding `Function.prototype.toString` to require a callable
receiver is net POSITIVE — the earlier attempt cost 9 assertions and was
reverted, and the reason was this getPrototypeOf bug, not the brand. Corpus 797
to 800 assertions and 26 to 28 complete suites.

Follow-up, done the same day: classes now carry a span too, recorded on the
constructor FuncDef (declared or synthesised) since that is the function value a
class becomes. `isCallable(class {})` is false, as node has it.

Locked by `tests/functionSourceText.js`.

## Function.prototype.apply took an array only, and globalThis.x += y read undefined — DONE 2026-08-16

Both found while tracing why `deep-equal` cannot load.

**apply took an ARRAY; the spec takes an array-LIKE.** It reads `length` and then
the index properties, and reading `length` can run a getter that throws.
Accepting arrays alone silently called the function with NO arguments, which is
wrong for the commonest form there is, `fn.apply(null, arguments)`. is-callable's
feature probe is built on precisely the throwing-length-getter case, so its
`reflectApply` branch was disabled on this engine.

**`globalThis.x += y` read `undefined` for its own left-hand side.** A plain read
goes through `getMemberDyn`, which resolves a global binding; the
compound-assignment read goes through `getMember`, which did not. So
`globalThis.x` and `globalThis.x += 1` disagreed about the same property. Worth
recording separately: this bug also corrupted my own instrumentation while
debugging the above — a trace that stashed state on globalThis reported
"undefined" for a value it had just written, and I read that as evidence about
is-callable rather than about the tracer.

Locked by `tests/applyAndGlobalThisWrites.js`.

## Function.prototype.toString now returns real source — DONE 2026-08-16

Every function stringified to `[object Function]`. Not merely imprecise: lodash
and friends tell a built-in from a user function by looking for the exact string
`[native code]`, so every user function looked native; and is-callable decides
whether a value is callable by whether `Function.prototype.toString` throws on
it, so every object looked callable.

Answering it needs the VERBATIM text — the `.expected` files are byte-exact
against node, and a pretty-printer cannot reproduce the author's spacing. So:

- `Token` gains `at` and `end` byte offsets. Stamped centrally in the lex loop
  rather than at each of the ten Token literals, several of which are built in
  helpers that never see the cursor. Each iteration consumes exactly one token
  or only whitespace, so at the top of the NEXT iteration the cursor is exactly
  the previous token's end.
- `FuncDef` gains `srcStart`/`srcEnd`, filled at all six construction sites.
  `async` is included because the caller consumed it and node's output has it;
  a class METHOD starts at its name while a static BLOCK starts at `static`.
- `Prog` keeps each file's text once, so a span can be sliced back out. Once per
  file, not per function: a function's text contains every nested function's
  text, so per-function slices would duplicate the program at each nesting level.

Built-ins keep node's `function <name>() { [native code] }`, and a genuine
bind() result prints anonymously where a built-in METHOD value keeps its name.
ToString of a function is its source everywhere, not only through `.toString()`:
`String(fn)`, `"" + fn` and `${fn}` all had to be routed through the Prog.

**Two latent bugs this exposed.** `Object.getPrototypeOf(fn)` answered
Object.prototype for every function: a function's property BAG is an ordinary
object, and the bag was what got asked. A bag with a DELIBERATE prototype still
wins, which matters because `Object.getPrototypeOf(Int8Array)` is the
%TypedArray% intrinsic and test262's whole TypedArray tree opens with that read.
And `String(x)` used the prog-free `toStr`, so a user `toString` never ran there.

With those fixed, branding `Function.prototype.toString` to require a callable
receiver is net POSITIVE — the earlier attempt cost 9 assertions and was
reverted, and the reason was this getPrototypeOf bug, not the brand. Corpus 797
to 800 assertions and 26 to 28 complete suites.

Follow-up, done the same day: classes now carry a span too, recorded on the
constructor FuncDef (declared or synthesised) since that is the function value a
class becomes. `isCallable(class {})` is false, as node has it.

Locked by `tests/functionSourceText.js`.

## Function.prototype.apply took an array only, and globalThis.x += y read undefined — DONE 2026-08-16

Both found while tracing why `deep-equal` cannot load.

**apply took an ARRAY; the spec takes an array-LIKE.** It reads `length` and then
the index properties, and reading `length` can run a getter that throws.
Accepting arrays alone silently called the function with NO arguments, which is
wrong for the commonest form there is, `fn.apply(null, arguments)`. is-callable's
feature probe is built on precisely the throwing-length-getter case, so its
`reflectApply` branch was disabled on this engine.

**`globalThis.x += y` read `undefined` for its own left-hand side.** A plain read
goes through `getMemberDyn`, which resolves a global binding; the
compound-assignment read goes through `getMember`, which did not. So
`globalThis.x` and `globalThis.x += 1` disagreed about the same property. Worth
recording separately: this bug also corrupted my own instrumentation while
debugging the above — a trace that stashed state on globalThis reported
"undefined" for a value it had just written, and I read that as evidence about
is-callable rather than about the tracer.

Locked by `tests/applyAndGlobalThisWrites.js`.

## apply's argument read did not abort the call when it threw — DONE 2026-08-16

`Function.prototype.apply` reads `length` and the index properties off its
array-like argument, and any of those reads can run a getter that throws. The
new array-like handling set the throw flag but the five call sites went on to
invoke the function anyway, with a partial argument list, leaving the pending
throw to surface at an unrelated later point. Each site now returns immediately.

Found while measuring the deep-equal chain, which is built on exactly this shape:
is-callable probes a candidate with `Reflect.apply(value, null, badArrayLike)`
where `badArrayLike`'s length getter throws a private marker.

## "use strict" was ignored, so strict code got globalThis as its receiver — DONE 2026-08-16

The directive was never parsed. Every function, strict or not, took globalThis
when called with no receiver. That was my own regression from binding
receiver-less `this` to globalThis: correct for sloppy code, wrong for strict,
and it cost two QuickJS cases (`bug1552.js`,
`iterator-tostringtag-setter.js`) which test SetterThatIgnoresPrototypeProperties
on `Iterator.prototype`. Those setters reject a nullish receiver, and with
globalThis substituted they silently accepted one. I had filed the same defect
two rounds earlier against the `__proto__` getter and called it a narrow
divergence; it was not.

`PState` now carries a `strict` flag and `FuncDef` an `isStrict`. The directive
is detected by PEEKING at the token after `{` rather than by inspecting the
parsed block, because the flag has to be set before the body is parsed: every
FuncDef built inside inherits it. Module level, function bodies and arrows all
set it; a class body is strict unconditionally, directive or not. Sloppy mode
substitutes globalThis for BOTH undefined and null, so `f.call(null)` and `f()`
bind the same receiver.

`lib/engine-prelude.js` now declares the directive, which is what makes the spec
setters it defines behave correctly.

Not covered: strict mode's other rules (assignment to an undeclared name, `with`,
duplicate parameter names, octal literals). Only the `this` binding is wired to
the flag so far — the flag is the part that was missing, and the rest can hang
off it.

Locked by `tests/strictModeThis.js`.

## BigInt64Array and BigUint64Array did not exist — DONE 2026-08-16

The largest single named failure bucket in the test262 sample: 21 cases died on
`ReferenceError: BigInt64Array is not defined` before running a line of their own.

Their elements are BigInt VALUES, so they cannot travel the f64 element path the
other nine kinds share — the range runs to 2^64 and f64 loses integers past 2^53,
so a round trip through a double silently corrupts the top bits. Added
`taLoadBig`/`taStoreBig`, which carry elements as the decimal strings
`JSValue.BigInt` already uses, and `taElemValue`/`taSetElemValue` at the index
read and write paths so a BigInt-kind view yields BigInt and everything else
still takes the numeric fast path.

Two things bit on the way, both worth recording:

- **The native id block collided.** `NATIVE_TA_BASE` was 79 with nine kinds, so
  ids 79..87. Two more kinds ran into `NATIVE_HTTP_FETCH` (88) and
  `NATIVE_MATH_EXP` (89), and `new BigInt64Array(3)` therefore constructed a
  FETCH, which returned an error string. `typeof` said "string", length was 25,
  and indexing gave characters. Moved the block to 160, above every id in use.
- **Decimal accumulation traps.** Converting a BigInt string to raw bits with
  `acc = acc * 10 + digit` overflows i64 for any value near 2^64, and Milo traps
  on integer overflow rather than wrapping. Converting through `bnToRadix(m, 16)`
  and placing nibbles with shifts writes the bits directly and cannot overflow.

Full 64-bit range verified against node, including `2n**63n` wrapping to the
minimum, `-1n` in a BigUint64Array reading as 18446744073709551615n, and
9007199254740993n (2^53+1) surviving a round trip exactly — the value that proves
the f64 path was never an option.

test262: 713 to 719 of 1470.

Locked by `tests/bigIntTypedArrays.js`.

## Identifiers were ASCII-only, so every non-ASCII name was a ReferenceError — DONE 2026-08-16

The lexer's `isIdentStart` accepted `[A-Za-z_$]` and nothing else, so `℘`, `ñ`
and `変数` were not identifier characters at all. Four failure buckets in the
test262 sample were the same defect wearing different names — "static is not
defined" (7), "#ZW_ is not defined" (3), "u2118 is not defined" (3), "ZW_ is not
defined" (1) — because the class-element tests are built on exactly this:

    static #$; static #_; static #\u{6F}; static #℘; static #ZW_<U+200C>_NJ;

Identifiers are scanned byte by byte, so the fix is to accept any byte at or
above 0x80 and let the whole UTF-8 sequence through verbatim: the lexer never
needs to decode it, only to keep it together. `\uXXXX` and `\u{X...}` escapes are
decoded to UTF-8 as they are scanned, in identifiers and private names alike, so
`#\u{6F}` names the same field as `#o`. An identifier may also START with an
escape, which needed the same allowance at the dispatch.

Also fixed here, found by the fixture rather than the corpus:

- **`#x in o`, the ergonomic brand check, threw.** Its left side is a private
  NAME, not an expression, and evaluating it as an identifier is a
  ReferenceError. It is answered from the own-property table now, and the right
  side must be an object.
- **`#\u{6F} = 5` declared a PUBLIC field named `o`.** The `#` branch required an
  identifier character to follow, and a backslash is not one, so the `#` lexed
  alone and the escape became an ordinary name.

test262: 719 to 735 of 1470 — 16 cases from one lexer predicate.

Locked by `tests/unicodeIdentifiersAndPrivateNames.js`.

## Almost nothing that should be non-enumerable was — DONE 2026-08-16

Class methods, statics and accessors; every Date.prototype method; Error.prototype
and each native error subclass's `name`/`message`/`constructor`; every own
property of Math. All enumerable.

The descriptor mismatch is the least of it. The visible consequence is that
`for (k in obj)` over ANY class instance listed every method it inherits, so
object iteration over user classes was simply wrong — `for-in` on a `class C { m()
{} get g() {} }` instance yielded `["m","g"]` where node yields `[]`. Anything
that walks an object generically (serialisers, diffing, shallow copies) saw
methods as data.

Fixed at the four places that install these: `instantiateClass` for class
members, the `dateProtoMethodNames` loop, `setupErrorProtos`/`setupOneErrorProto`,
and the Math block — which also freezes the CONSTANTS, since `Math.PI` is
non-writable and non-configurable as well as non-enumerable.

Only FIELDS stay enumerable on a class, and they are installed as `this.x = ...`
in the constructor rather than through the member path, so they were never
affected. An object LITERAL's members are enumerable and must stay that way; the
fixture pins that too, because the obvious over-broad fix breaks it.

test262: 735 to 761 of 1470. Predicted 29 from two failure buckets, got 26.

Locked by `tests/propertyEnumerability.js`.

## Object.defineProperty validated nothing, and a function's name/length were not own properties — DONE 2026-08-16

**defineProperty accepted everything.** All ten spec rejections probed were
silently allowed — a non-object target, a null or primitive descriptor, `get`
together with `value`, `set` together with `writable`, a non-callable accessor,
and redefining a non-configurable property. A call that must throw returned the
object unchanged, so the caller carried on believing the property was defined.
`validDescriptor` now runs ValidateAndApplyPropertyDescriptor's rejection rules
before anything is applied, for `defineProperty` and `defineProperties` alike.

**A function's `name` and `length` were synthesised on READ only.** Every
`getOwnPropertyDescriptor(fn, "name")` answered undefined, which is how test262
checks them and how any library that copies function metadata reads them. They
are materialised in `propertyBagOf` — the one place every descriptor path goes
through — with the spec's attributes. `hasOwnProperty` was routed through the
same helper so it cannot disagree with `getOwnPropertyDescriptor`, and the member
READ now consults the bag so a redefined `length` is honoured rather than being
recomputed from the FuncDef.

**A regression I shipped into the gates and had to back out of.** The first guard
was `objHandle(argVals[0]) < 0`. A function is an object in JS but is a `Func`
here, not an `Obj`, so that rejected every `defineProperty(fn, ...)` — which
call-bind does on load, taking the npm corpus from 802 assertions to 0 and both
real apps with it. `propertyBagOf` is the right test: it answers for functions
and natives too and is -1 only for a genuine primitive. The fixtures and
test262 were all green while this was broken; check-apps and check-packages
caught it.

test262: 761 to 766 of 1470.

Locked by `tests/descriptorValidation.js`.

## OPEN: assignment to a frozen property does not throw in strict mode

`"use strict"; const o = Object.freeze({a:1}); o.a = 2;` silently ignores the
write where node throws TypeError. The strict flag now exists on FuncDef, but the
assignment path has no access to the enclosing function's strictness at runtime —
it would need to be carried on the frame, as `this` binding is. Same shape as the
other strict-mode rules still unimplemented (assignment to an undeclared name,
`with`, duplicate parameter names, octal literals).

## Spreading a non-iterable was a silent no-op, so array destructuring never threw — DONE 2026-08-16

`[...5]`, `[...null]` and `[...{}]` all produced an empty array instead of a
TypeError. Array destructuring is desugared to `[...expr]` — the comment at that
desugaring says so explicitly, because iteration is the semantics the pattern
needs — so the same defect showed up from the other end as `const [a] = 5`
binding undefined. About 30 test262 cases in the sample are destructuring
failures of this shape, spread across class, object and generator contexts, and
they were the largest identifiable group inside the two "expected a throw"
buckets.

Fixed at `spreadInto`'s fallthrough, which is the one place that decides a value
cannot be walked. Three neighbouring silences went with it:

- **A malformed iterator ended iteration quietly.** An object whose `next` is not
  callable, and a `next()` that returns a non-object, both set the loop guard and
  returned what had been collected so far. Both are TypeErrors.
- **`({a} = null)` and `[a] = null`** — the destructuring ASSIGNMENT form, which
  does not go through the declaration path — read from the nullish value and
  produced undefined.
- **`const { ...r } = null`** returned `{}` from `__objRest` rather than throwing.

Worth recording how the first attempt went wrong: I added the check in
`patternDecls`, where the pattern is parsed, and it changed nothing. Array
patterns bind their temp to `[...expr]` FIRST, so by the time the emitted check
ran, its argument was the already-spread array — always iterable. The check has
to live where the spread happens, not where the pattern is written.

test262: 766 to 769 of 1470. Only 3, against ~30 cases identified — the rest of
that group needs the iterator protocol to drive destructuring rather than
indexing a spread temp, which is a larger change than this one.

Locked by `tests/destructuringErrors.js`.

## require() of an absolute path failed for files as well as directories — DONE 2026-08-16

Filed as a directory-only problem; verifying it showed it was broader.
`require('/abs/path/mod.js')` failed too. Neither form was handled: an absolute
specifier fell through to the node_modules walk and reported "no such package",
which is what any tool that requires by absolute path hits — generated code and
test harnesses do it routinely.

Absolute specifiers now resolve directly as a file or a directory, and the
result is converted back to the registry's cwd-relative form. That second half
matters: the module graph keys on that form, so an absolute key leaves every
transitive relative require inside the module reporting "was not pre-loaded" —
the module loads and its dependencies silently do not.

Also corrected the diagnostic. A path specifier is not a package lookup, so
"no such package, and node builtin modules are not implemented yet" was both
wrong and misleading for it; the thrown MODULE_NOT_FOUND already says the file is
missing, and node prints nothing extra.

Locked by `tests/runtime/absoluteRequire.js`.

## Backlog hygiene, 2026-08-16

Two entries were duplicated and one was superseded but left in place:

- `OPEN: deep-equal cannot load — is-callable answers false inside its dependency
  chain` was replaced by a corrected entry (the cause is stack exhaustion, not
  is-callable) but the original was never deleted, so the file carried both the
  wrong diagnosis and the right one.
- `OPEN: require() of an absolute path` appeared twice verbatim.

Both removed. The remaining OPEN entries were re-verified against the current
build rather than trusted: absolute-path require was still broken and is fixed
above; deep-equal still fails; private-name keyspace and the strict-mode frozen
write are both still reproducible.

## deep-equal could not load: ArrayBuffer.prototype.byteLength was not an accessor — DONE 2026-08-16

The largest single blocker in the npm corpus, open across four rounds, and the
cause was three packages away from where it showed.

`ArrayBuffer.prototype.byteLength` is an ACCESSOR on the prototype in the spec.
milojs carried the value on the instance instead, so reading
`new ArrayBuffer(8).byteLength` always worked and nothing looked wrong — only the
DESCRIPTOR was missing, and only code that inspects descriptors could tell.

`is-array-buffer` inspects exactly that descriptor. With it absent the package's
fallback answered TRUE for every object: a plain array, a typed array, `{}`.
deep-equal then took its ArrayBuffer branch, wrapped the value in
`new Uint8Array(a)`, and recursed on the result for ever — so
`deepEqual([1,2],[1,2])` exhausted the stack. tape's `deepEqual` is built on it,
which is why function-bind, object.assign and array.prototype.flatmap could not
finish either.

Corpus: 802 to 897 assertions, 28 to 35 complete suites.

**Three earlier diagnoses of this were wrong, and the pattern is worth keeping.**
Round one blamed is-callable ("answers false inside its dependency chain"). Round
two corrected that to stack exhaustion and proved the recursion was real by
showing remaining-frames stayed at 2 no matter what the limit was — right, but
still a symptom. Round three raised the recursion limit, measured that it did not
help, and reverted. What finally worked was instrumenting the recursion to print
its ARGUMENTS rather than its depth: the value being compared arrived as a
`Uint8Array` on every re-entry, and one grep for `Uint8Array` in deep-equal's
source pointed at the branch. Depth measurements described the loop; the first
look at the DATA identified it.

Locked by `tests/arrayBufferByteLength.js`.

## Object.assign skipped ToObject, and Array/Promise had no own length — DONE 2026-08-16

Two defects, each of which stops a package on its first line.

**`Object.assign` did no ToObject on its target.** A nullish target returned
quietly where the spec throws, and a PRIMITIVE target came back unboxed, so
`typeof Object.assign(1, {})` was "number" rather than "object". Sources stay
lenient — a nullish SOURCE is skipped, not an error — which is the asymmetry the
object.assign package tests first.

**`Array` and `Promise` had no own `length` or `name`.** Both are constructor
OBJECTS in this engine rather than Natives, so the native naming pass never
reached them. get-intrinsic resolves `%Array.length%` and reports "base intrinsic
for Array.length exists, but the property is not available" without it, which is
where call-bound stopped — taking 16 assertions with it, plus everything
downstream that call-bound loads.

Corpus: 897 to 911 assertions. test262 unchanged at 769, which is expected: both
of these are reached through package code rather than through the language
surface the sample covers.

Locked by `tests/toObjectAndCtorLength.js`.

## Three iterability gaps, found by package suites and worth zero on both scores — DONE 2026-08-16

All three verified wrong against node, all three fixed, and neither the corpus
total nor test262 moved. Recording that plainly, because a round that improves
correctness without moving a number is easy to quietly not report.

- **A String wrapper with its own `Symbol.iterator` ignored the override.** The
  wrapper fast path in `spreadInto` ran before the own property was consulted, so
  `Object("s")` with an installed iterator yielded `["s"]` instead of what the
  override returns. My own fast path, added with the wrapper work.
- **A FUNCTION carrying a `Symbol.iterator` was rejected as non-iterable.**
  Functions are not `Obj` in this value model, so the iterator walk never saw
  them and the non-iterable throw I added last round caught them instead. That
  throw was right; its reachability test was too narrow.
- **`Object.assign` did not box a primitive SOURCE**, so a string source
  contributed no index properties: `Object.assign({}, "ab")` was `{}` rather than
  `{0:"a",1:"b"}`.

The first two are regressions I introduced in earlier rounds — the wrapper spread
path and the `isSpreadable` predicate — and neither fixture nor sweep caught
them. es-get-iterator's and object.assign's own suites did.

Locked by `tests/spreadIterableEdges.js`.

## Temporal, stages 1 and 2 — 2026-08-16

The largest single block in the test262 sample: 128 failures, 18% of everything
still failing, one unimplemented API. Now 93.

Implemented in `lib/temporal.js` (923 lines, its own builtin loaded at both entry
points): `Duration`, `PlainDate`, `PlainTime`, `PlainDateTime`,
`PlainYearMonth`, `PlainMonthDay`, `Instant`, `ZonedDateTime`, `Now`. Real ISO
calendar arithmetic via civil-from-days, month-clamping on add (`Jan 31 + 1
month` is `Feb 28`, and `Feb 29` in a leap year), midnight wrapping, extended
year formats, and epoch nanoseconds carried as BigInt — a Number loses the low
digits within months of the epoch.

Written in JS rather than as Milo natives: every operation is arithmetic over
small integers and string formatting, so a native would be a large amount of Milo
for no speed anyone would notice.

**Not a stub, and that constrains it.** A `Temporal` global that exists but
throws is worse than none, because libraries feature-detect with `typeof
Temporal !== "undefined"`. So what is defined works and what is not is ABSENT.
The visible consequence is time zones: only UTC and fixed offsets are
implemented, and `ZonedDateTime.from("...[America/New_York]")` REFUSES rather
than quietly treating a named zone as UTC. A wrong offset is worse than a
refusal — it produces plausible timestamps that are silently hours off.

**No node oracle reaches this API.** Every fixture in `tests/` is diffed
byte-for-byte against node, and this node has no Temporal, so a fixture there
would compare real output against a ReferenceError for ever. `tools/check-
temporal.sh` carries 73 spec-derived assertions instead, and AGENTS.md records
why they cannot live in `tests/`.

That gate paid for itself on its first run: it reported one failure and the
ENGINE was right — the expected epoch for `2026-08-16T12:00:00Z` was a day out,
confirmed against `Date.UTC`. The expectation was corrected, not the code.

Also caught during stage 1: the file runs in GLOBAL scope, so its top-level
helpers (`pad`, `def`, `tag`) became globals and broke an unrelated fixture whose
sloppy-mode `this` picked up `globalThis.tag`. Wrapped in an IIFE; only
`Temporal` escapes.

test262: 769 to 804 of 1470 for stages 1-2.

**Stage 3** added `until`, `since` and `round` to PlainTime, PlainDateTime,
Instant and ZonedDateTime, with the options they take — `largestUnit`,
`smallestUnit`, `roundingIncrement` and all nine `roundingMode` values — plus a
`calendarId` getter on every type. A built-in method's own `name` is its PROPERTY
key rather than the function expression's, which matters for `with`: the keyword
forces the implementation to be called `withFields`, and test262 has a name.js
per member.

test262: 804 to 814. Temporal failures 128 to 83.

## `new` on a non-constructor built an object instead of throwing — DONE 2026-08-16

Found while chasing Temporal's `not-a-constructor.js` tests, and much broader
than them. Every arrow, every method shorthand, and every plain built-in
function — `Math.max`, `Object.keys`, `Array.prototype.map` — answered to `new`
by building an object and running the body against it. A typo like
`new arr.map()` produced a value rather than failing.

Four rules now decide it: arrows and METHODS are never constructors (`FuncDef`
carries `isMethod`, set for object shorthand and class members); a native is a
constructor only if it is on the list of ones that actually construct; a bound
BUILT-IN METHOD value is not a constructor while a genuine `bind()` result is,
when its target is.

Two things the fixture caught while landing it. Marking class members as methods
also marked the class CONSTRUCTOR, which broke `new C()` across 19 fixtures —
the constructor is a class member syntactically but is exactly what `new` must
reach. And `Proxy` had to be added to the constructor list; it is a native that
does construct, and four proxy fixtures said so immediately.

**A limit worth naming.** `new JSON.parse(...)` still does not throw. JSON.parse
is a JS function defined in the prelude, because the native cannot call a
reviver, and a JS function expression IS constructible. The same applies to every
Temporal method: `not-a-constructor.js` and `builtin.js` (8 cases in the sample)
are unreachable while those APIs are written in JS rather than as natives. That
is a real cost of the implementation strategy, not an oversight, and the fixture
names it rather than asserting around it.

test262: 814 to 815, but the value is not the case count — this one is a silent
wrong answer in ordinary code.

## Pattern defaults fired on null, and anonymous defaults had no name — DONE 2026-08-16

Destructuring was the largest identifiable cluster left in the sample: 106
failures, 16% of everything still failing. Two defects behind most of it, both
in the desugaring rather than the evaluator.

**A pattern default applied to NULL as well as undefined.** `withDefault`
compared with `==`, which matches both, so `const [a = 7] = [null]` bound 7 where
the spec binds null. A silent wrong value, not an error, in the single most
common destructuring idiom there is.

**An anonymous function, arrow or class used as a default took no name.**
`const [a = () => {}] = []` left `a.name` empty. Fixing it turned up three more
sites that share the same helper and were all missing it: parameter defaults
(`function f(a = () => {}) {}`), plain assignment (`z = function () {}` infers
`z`), and anonymous CLASS expressions anywhere — `inferFuncName` only understood
`FuncExpr`, so `const A = class {}` had an empty name too. A class needs its
constructor FuncDef renamed as well, since that is the function value a class
becomes.

test262: 815 to 856 of 1470, the largest single jump of the session. dstr
failures 106 to 67.

Locked by `tests/destructuringDefaults.js`.

## Array destructuring now drives the iterator instead of draining it — DONE 2026-08-16

The architectural change flagged three rounds ago. Array patterns were desugared
to `[...src]` bound to a temp, then indexed — which drains the iterator
completely and never closes it. Three things follow from that and none were
observable:

- **`const [a] = gen()` drained the generator.** It must pull ONE value and then
  call `gen.return()`. A generator with a `finally` block never ran it, and one
  with side effects per step ran all of them.
- **A `next()` that throws on element 3 surfaced even when the pattern wanted 2.**
- **IteratorClose was never performed**, so a `return()` that throws could not
  propagate, and an iterator could not tell it had been abandoned.

The desugaring now emits `__iterSteps(src, n, hasRest)`: get the iterator, step
it exactly n times, drain only if the pattern ends in a rest element, otherwise
call `return()`. Element reads index the RESULT of that, so the existing indexed
desugaring is untouched — the change is what the temp is bound to.

Ordering mattered: the stepping binding has to be emitted BEFORE the element
reads that consume it, and the element decls are built during parsing while the
count is only known at the closing bracket. The array branch collects its
declarations locally and emits the binding first once the count and rest flag are
settled.

test262: 856 to 869 of 1470. dstr failures 106 to 55 across the two rounds.

Locked by `tests/destructuringIterator.js`, which traces the exact call sequence
(`next0,next1,return`) rather than only the bound values — the sequence is the
part that was wrong.

## Every callback-taking Array method accepted a non-callable — DONE 2026-08-16

`[1].map()` gave `[]`. `[1].reduce(null)` gave `1`. `[1].some()` gave `false`.
Twelve methods, none of them validating, all returning a plausible default. That
is the worst shape for this failure: a typo, an undefined import or an unresolved
method reference produced an ANSWER rather than an error, so the mistake showed
up somewhere else entirely. Fixed centrally in `arrayMethod`, together with
`reduce` over an empty array with no seed (counting PRESENT elements, so a
hole-only array counts as empty) and `sort` with a non-callable comparator.

**The first version regressed two cases, and the reason is ordering.** The spec
performs LengthOfArrayLike BEFORE validating the callback, so
`Array.prototype.map.call(obj, undefined)` where `obj`'s length getter throws
must surface the GETTER's error. Adapting an array-like receiver already read
that length, but the pending throw was then overwritten by the callback
TypeError. `arrayMethodGeneric` now bails as soon as adaptation throws.

Worth keeping: the sweep went 869 to 868 on the first attempt, and diffing the
failure SETS rather than the totals named the two regressed cases immediately.
A net +7 with a hidden -2 would have looked like a clean win.

test262 869 of 1470, corpus 911 to 919.

Locked by `tests/arrayCallbackValidation.js`, which pins the ordering as well as
the validation.

## Private class members shared one keyspace — DONE 2026-08-16

Filed open three rounds ago, and worse than the entry described. Private members
were ordinary properties keyed `#x`, in a single namespace across every class:

- **Two classes that both declare `#x` shared the key.** `#x in b` answered true
  for an instance of a different class. In bundled code, where `#x` is
  ubiquitous, one class could read another's private state — a real containment
  failure, not a conformance detail.
- **`#x` appeared in `getOwnPropertyNames`.**
- **The brand check missed private METHODS**, which live on the prototype rather
  than the instance, so `#m in o` was false for a genuine instance.
- **Reading a private member from an object that never had it returned
  undefined**, which reads as "absent field" rather than "wrong object".
- **`#s in C` for a private static threw**, because a class value is a Func here
  and the check demanded an Obj.

Private names are now keyed per class, reusing the unique key each class already
carries for `super`. Enumeration skips them centrally in `enumOrder`, the brand
check walks the prototype chain (so methods count, and a different class's
mangled key still answers false), and the diagnostic prints `#x` rather than the
mangled form.

**One half could not land.** Node throws when a private member is WRITTEN to an
object whose class did not declare it. A guard there rejects every instance field
initialiser, because fields are installed by the constructor as `this.#x = init`
at a point where the object does not yet carry the key — three fixtures said so
immediately. Distinguishing the two needs field installation to use a definition
path of its own rather than ordinary assignment. The read guard, which is the
half that matters for containment, is in.

test262: 869 to 873 of 1470.

Locked by `tests/privateClassMembers.js`.

## An uncurried valueOf on a wrapper returned the wrapper — DONE 2026-08-16

`Object(42n).valueOf()` was correct. `BigInt.prototype.valueOf.call(Object(42n))`
returned the WRAPPER. The direct form went through the wrapper delegation path;
the uncurried form landed on the generic object `valueOf`, which answers with the
receiver. Every library uses the uncurried form.

object-inspect is built on it: to print a boxed primitive it calls valueOf and
wraps the result in `Object(...)`. A result that is still an object nests again,
so `inspect(Object(42n))` recursed until the stack was gone — which is what took
out es-get-iterator's suite. Symbol wrappers had the matching defect in
`toString`, printing the object tag instead of the description.

Corpus 919 to 925, test262 873 to 874.

Locked by `tests/wrapperUnwrapping.js`.

## Temporal option validation, and a published number that was quietly wrong

Temporal 60.7% -> 62.2% (+69). The whole family of option tests came from one
missing abstraction: nothing in lib/temporal.js implemented **GetOption**. Every
option was read as a bare property and coerced with `String()`, which is wrong
three ways at once — `String(symbol)` does not throw where ToString must, an
invalid value was accepted rather than rejected, and an object's `toString` was
reached by a path that read it twice.

- `overflow` was **never read at all**: `{ overflow: "bogus" }` and
  `{ overflow: null }` were both silently fine. It is now validated in every
  `from`, `with`, `add` and `subtract`.
- The options bag's TYPE was unchecked on `with`, `add`, `subtract`, `toString`,
  `until` and `since` across every type — 19 methods, found by probing rather
  than by reading the spec method by method.
- Ordering matters and is observable: `GetOptionsObject` reads no properties, so
  checking the bag's type early is fine, but reading `overflow` must not happen
  until the item itself has parsed. `PlainMonthDay.from("13-34", observer)` has
  to throw RangeError without ever touching the bag.

Two regressions I caused and caught by measuring rather than by inspection: the
first version declared `options` as a second parameter, which moved `from.length`
from 1 to 2 (+6 failures), and read `overflow` before parsing (+5). Options come
off `arguments` now.

### An engine bug underneath it

`String(obj)` read `toString` twice, and read it BEFORE `@@toPrimitive` instead
of after. The NATIVE_STRING path probed for a callable `toString` to decide
whether to take over, and the coercion it then delegated to read the property
again. Every other spelling — a template hole, `obj + ""`, `[obj].join("")` —
was already correct, so this only showed up through `String()`.

### The published conformance number was measured on built-ins/Date

`docs/conformance/test262.json` is what the README and status.md cite, and every
`--dir` sweep in this session had been overwriting it. The committed report said
361/594 = 60.8% — the score for `built-ins/Date` alone — while the prose around
it read as the whole-suite figure.

The sweep now writes the canonical path only for a full or sampled WHOLE-SUITE
run; `--dir` and `--limit` go to `.dev/test262-partial.json` unless `--json` says
otherwise. A diagnostic cannot republish itself as the headline any more. This is
the third measurement-integrity bug this session, after the engine-missing
"1347 crashes" and the QuickJS failure detection — all three the same shape: the
harness reporting confidently on something it had not actually measured.

## Capture reset in quantifiers, and a silent opcode collision

Three regex/Date fixes, measured directly rather than through the whole-suite
sample, which is too coarse to see them: `built-ins/RegExp` 1153 -> 1155,
`built-ins/Date` 360 -> 361.

- **Captures inside a quantified body reset each iteration.** The spec's
  RepeatMatcher clears every capture inside the body at the start of every
  repetition, so a group that does not participate in the LAST pass reads
  undefined. milojs kept the stale value: `/(z)((a+)?(b+)?(c))*/` on
  "zaacbbbcac" reported "bbb" for group 4 where node reports undefined.
  Implemented as an `RE_RESET` opcode emitted at the top of each quantifier
  body, with the slot range derived by scanning the compiled body for RE_SAVE,
  and trailed like a save so backtracking restores it.
- **`\c` followed by a non-letter is a literal backslash**, not a control
  escape (Annex B). `/\c0/` matches the three characters `\c0`; the fallthrough
  dropped the backslash and matched "c0".
- **`Date.parse` accepts the short ISO date forms.** `YYYY` and `YYYY-MM` are
  valid and were NaN, because the parser required ten characters.

### The opcode collision, and the gate that now catches it

`RE_RESET` was first written as `12`. `RE_LOOKEND` was already 12. Nothing
warned — two distinct NAMES holding the same number is invisible to
`lint-symbols.sh`'s duplicate-name check — and the VM silently treated every
lookahead-end as a capture reset, so `a(?=b)` stopped matching entirely. The only
thing that caught it was `tests/regexDifferential.js` comparing 60 patterns
against node, which is precisely why that fixture exists.

`lint-symbols.sh` now checks the three hand-numbered tag families (`RE_`, `T_`,
`NATIVE_`) for two members sharing a value. Restricted to those three on
purpose: other prefixes legitimately repeat a number — src/runtime/repl.milo has a
sprite whose width and row count are both 18, which is the false positive the
first version of the check produced. Verified by re-introducing the collision
and watching the gate name both lines.

## Module code was not strict code, and every QuickJS test file is a module

The spec makes module code strict with no directive needed. milojs ran every
module sloppy, and four unrelated-looking behaviours all came from that one fact:

- assigning to a non-extensible or frozen object silently did nothing where it
  must throw;
- a bare function call saw an object as `this` instead of undefined;
- an assignment to an undeclared name created a global instead of raising a
  ReferenceError (which was not implemented at all, in any mode);
- `Object.setPrototypeOf(Object.prototype, {})` was a silent no-op.

Strictness has to be decided at PARSE time, not just at run time: a function's
strictness is baked into its FuncDef, so setting `st.strict` around the module
body fixed the top level and left every function inside it sloppy. `PState.strict`
now starts true for module code, and `parseProgram` ORs rather than assigns
`progStrict` — it was overwriting the flag the caller had just set.

`moduleIsStrict` nearly became a fourth duplicated idea in this repo: it started
as a hand-rolled token scan for import/export before `hasEsmSyntax` turned up
doing the same thing better (it skips a member named `import` and a dynamic
`import(...)`, which the hand-rolled version did not). It delegates now.
`tools/lint-symbols.sh` catches duplicate NAMES; it cannot catch a duplicated
idea under a new name, and this is the second time that has happened here.

Also fixed alongside: %Object.prototype% is an immutable prototype exotic object
(null is the only prototype it accepts), and a non-extensible object's prototype
cannot be replaced either.

QuickJS 71.1% -> 71.3%, and `test_builtin.js:test` passes for the first time.
test262 unmoved at 70.6% — it skips module tests in this sweep, so none of this
shows up there. Packages 76%, apps 2/2, Temporal 119/119: nothing regressed from
turning strictness on, which was the real risk.

### What test_builtin.js still fails, measured per function

Running each of its 29 test functions separately rather than letting the first
failure mask the rest:

- `test_string` / `test_rope`: lone surrogates normalise to U+FFFD
  (`charCodeAt` gives 65533 where 55296 is expected). Architectural — strings are
  UTF-8 here, and a lone surrogate has no UTF-8 encoding. Shared root cause with
  a slice of test262's String area.
- `test_typed_array`: Float16Array absent.
- `test_date`: a parse returning NaN for -30610224000000.
- `test_regexp`: `\c0` escape handling.
- `test_eval`, `test_function`, `test_array`: one assertion each, undiagnosed.

## Temporal ISO strings: one parser instead of seven regexes

Each Temporal type carried its own ISO regex, and not one of them knew about
ANNOTATIONS — the bracketed suffixes carrying the time zone and the calendar that
every Temporal string in the wild ends with. `Temporal.PlainDate.from("2000-05-02[u-ca=iso8601]")`
was a RangeError. That grammar alone was 208 test262 cases.

Replaced with a single hand-written scanner, `parseTemporalISO`, used by all six
`from` methods. Temporal **56.5% -> 60.7%** (+192), whole suite 70.3% -> 70.7%.

The annotation rules need real validation, not a character class:

- an unknown annotation is IGNORED (`2000-05-02[foo=bar]` is a valid PlainDate);
- the same annotation marked critical with `!` is a RangeError, which is the
  entire point of the flag: a consumer that does not understand it must refuse
  the string rather than silently drop it;
- a repeated `u-ca` is tolerated and the first wins, UNLESS one of them is
  critical, which makes the ambiguity fatal;
- a time zone annotation has no `=`, must come first, and only one is allowed.

Three more rules fell out of the same rewrite, each its own test262 file per type:

- **U+2212 MINUS SIGN is not a minus.** `1976-11-18T15:23:30.12−02:00` reads as
  valid to a human and is a RangeError; only ASCII `-` counts.
- **An offset needs a time to be an offset from.** `2022-09-15Z` and
  `2022-09-15+00:00` are RangeErrors, where `2000-05-02T00+00` is fine.
- **`:60` is a leap second on the wire** and clamps to `:59`; it never denotes a
  61st second.

`tests/temporalIsoStrings.js` locks the grammar down. node 25 has no Temporal, so
it cannot be the oracle — the fixture is in `.node-oracle-exempt` with test262 as
the authority instead.

## QuickJS has been coasting, and this is the first tick that looked at it

test262 went 61.9% -> 70.7% across this session while the QuickJS suite moved
67.1% -> 69.8% and has been FLAT for three ticks. Every tick picked the largest
test262 cluster and QuickJS moved only as a side effect. Measured properly for
the first time, 45 of 149 cases fail, and they are diffuse — mostly one test
function each rather than one mechanism:

- `test_builtin.js` alone holds 12: test_array, test_rope, test_eval, test_date,
  test_regexp, test_function, test_exception_source_pos,
  test_function_source_pos, test_exception_prepare_stack,
  test_exception_stack_size_limit, test_exception_capture_stack_trace,
  test_cur_pc.
- `bug492.js` holds 4, all resizable ArrayBuffer: resize_shrink, resize_grow,
  resize_zero, detach.
- Single files: `test_base64.js` (Uint8Array base64), `test_domexception.js`,
  `Float16Array` (absent entirely), `for-await-normal-close.js`,
  `test_bigint.js` asintn and bigint2, `parse-error-column.js`, `bug1301`,
  `bug1302`, `bug1498`, `bug652`, `bug858`, `test_closure.js` eval_const.
- 4 are timeout/crash under SIGTERM and have not been diagnosed.

Roughly 8-10 of the 45 are QuickJS-specific diagnostics — exception source
positions, `cur_pc`, `prepare_stack` — which test engine-internal introspection
rather than portable semantics. 90% here means 134/149, so 30 of the 45 have to
go, and those 8-10 are the expensive ones. The cheap coherent wins are resizable
ArrayBuffers (4), Float16Array, DOMException and base64.

## Temporal was the biggest single cluster in test262, and nobody had measured it

`tools/check-temporal.sh` reported 119/119 and had done for weeks. Against
test262 the same implementation scored **48.4%** (2229/4603). The local gate was
not wrong, it was just far weaker than the suite, and its green number is why
this area went unexamined: Temporal is 199 of 1274 failures in a uniform whole-
suite sample, **16% of the entire remaining gap** and larger than any other
single area.

Brought to **56.5%** (+373 tests) in one sitting, which moved the whole-suite
number 69.2% -> 70.3%. What it took was ordinary porting, in descending order of
yield:

- **Nine missing methods** (137 tests): `toZonedDateTime`, `withPlainTime`,
  `withCalendar`, `toPlainDateTime`, `toPlainYearMonth`, `toPlainMonthDay`,
  `startOfDay`, `getTimeZoneTransition`, `ZonedDateTime.prototype.with`, plus
  `toLocaleString` on all eight types.
- **Calendar units in until/since/round** (96 tests). PlainDateTime and
  ZonedDateTime rejected year, month, week and day outright — "unsupported
  unit: year" — which is most of what anyone actually asks those types for.
  Needed DifferenceISODateTime, where the date and time halves can disagree in
  sign: 2000-01-01T12:00 to 2000-01-02T06:00 is 18 hours, not "1 day and
  -6 hours".
- **`largestUnit: "auto"`** (50 tests) is the LARGER of the type's default and
  smallestUnit, not the fixed default. `since(other, {smallestUnit: "year"})` is
  legal and was rejected as "smaller than largestUnit".
- **ToString vs String()** (47 tests). `ToString(symbol)` is a TypeError;
  `String(symbol)` is not. Every unit, calendar and ISO-string entry point used
  the latter, so a symbol argument reported RangeError ("not a Temporal unit")
  after String() had already turned it into "Symbol(year)".
- **era / eraYear / daysInWeek** getters, absent entirely. They answer undefined
  and 7 under the ISO calendar, but the tests that noticed were reading the
  property DESCRIPTOR, so being absent failed before the value mattered.
- Accessor functions are named `get <prop>` in the spec; every one here was an
  anonymous function with name `""`.

### Two engine bugs the Temporal shape tests exposed

Both general, neither Temporal-specific.

- **`prototype` was not an own property of ANY function.**
  `Object.getOwnPropertyNames(F)` gave `name,length` where node gives
  `length,name,prototype`, and `F.hasOwnProperty("prototype")` was false for
  every function and every class. Reads worked because `.prototype` was
  intercepted ahead of the property bag and resolved through `st.funcProtos`,
  which stays the single source of truth — it is now also materialised on the
  bag so that describing a function agrees with reading it.

  Which functions get one is itself observable, and getting that wrong cost a
  measured **-74 tests** on the first attempt: a built-in that is not a
  constructor has NO `prototype`, and test262 asserts exactly that on every
  method. The condition is `valueIsConstructor` (not "every non-arrow"), with
  generators as the one exception in the other direction — not constructors, but
  they do have a prototype. `__markNotConstructor` also has to REMOVE a
  materialised one, because the prelude's marking walk reads
  getOwnPropertyNames first (materialising it) and marks second.

- **`new` did not consult `valueIsConstructor`.** It tested `isArrow ||
  isMethod` inline, so generators, async functions and everything
  `__markNotConstructor` had recorded were constructable through `new` while
  `Reflect.construct` correctly rejected them. Two spellings of one operation
  that disagreed.

The class case is knowingly left wrong in one attribute: FuncDef carries no
class flag, so a class reports `prototype` as writable:true where the spec says
false. lib/temporal.js redefines its own eight constructors explicitly. A real
fix wants an `isClass` flag on FuncDef.

### Still open in Temporal, by measured size

2002 failures remain. The clusters, from the failure list:

- ISO string parsing rigour, ~208: annotation handling (`argument-string-calendar-annotation`,
  `-time-zone-annotation`, `-unknown-annotation`, critical flags), the U+2212
  minus sign, time separators, UTC offsets in date strings, and range limits.
- Observable operation order, ~106: `order-of-operations.js` and
  `options-read-before-algorithmic-validation.js` check the exact sequence of
  property gets. Reading largestUnit before smallestUnit is part of the
  contract, and the auto-widening fix above got that order wrong on the first
  pass.
- Option validation, ~115: `options-wrong-type`, `overflow-wrong-type`,
  `roundingmode-wrong-type`, `smallestunit-wrong-type`,
  `overflow-invalid-string`.
- smallestUnit of year/month/week for a date-time difference, 50: needs
  RoundRelativeDuration, which is the one genuinely hard algorithm left here.
- `leap-second.js`, 27: `:60` is accepted and clamped to 59.
- `argument-number.js`, 26: a number argument is a TypeError, not coerced.

None of these need new architecture. Temporal at 90% is reachable and worth
about 4 points of the headline on its own.

## CLOSED: es-get-iterator overflowed because the recursion guard was 104 frames

Five previous sittings tried to find which *value* triggered the overflow. There
was no such value. The engine's `callDepthLimit` was **104** while node's is about
10,400, and tape's deferred sub-test chain recurses past 104 all on its own — the
failure moved with total accumulated depth, not with any particular input, which
is exactly why bisecting the value list kept subtracting hypotheses without ever
converging.

Two things had gone wrong at once:

- **The limit was stale.** Its comment describes the engine's "normal process
  stack", but the engine had since moved its program onto an 8 MB green task,
  same as the runtime. Nobody re-measured; 104 had been correct for a stack the
  engine no longer used.
- **A frame count cannot describe two stacks.** The main interpreter task and
  every generator/async body have different stack sizes, so no single number is
  right for both — one that is safe on 8 MB wastes 97% of a 256 MB stack, and one
  sized for the big stack is a silent overflow crash on the small one.

The guard now measures the native stack it is actually standing on
(`stackHeadroom()` in eval.milo, reading the current task's mapped stack base),
and raises a catchable RangeError with 512 KB to spare. It is correct on any task
whatever size it was spawned with, and it was verified by pushing the frame
backstop to 200,000 and watching the engine stop cleanly at ~39k frames instead
of dying.

Stack sizing was then chosen by measurement rather than by preference. A JS frame
costs ~6.9 KB of tree-walker native stack:

| task stack | frames | RSS for `console.log(1+1)` | package corpus |
|---|---|---|---|
| 8 MB (old) | ~1,200 | 21 MB | 73% |
| 16 MB | ~2,400 | 36 MB | **76%** |
| 32 MB | ~4,800 | 53 MB | 76% |
| 256 MB | ~39,000 | 288 MB | 76% |

16 MB takes the entire measurable win at a sixteenth of the memory of the largest
option, and keeps the engine's footprint under node's. The remaining distance to
node's ~10.4k frames is not buyable with more stack — it needs the ~6.9 KB
per-frame cost brought down, which means splitting the big `match` arms on the
eval → callValue → callFunction → execBlock recursion so a frame holds only the
live arm's locals. That is the next real lever here, and it is worth roughly a 4x
depth increase for free.

es-get-iterator went 76 → 130 of 140 assertions; the package corpus went 73% →
76% (1246 → 1297 assertions). test262 and the QuickJS suite did not move at all,
which is the honest shape of this fix: almost nothing in a conformance suite
recurses 100 frames deep, and almost every real library does.

### Three bugs found on the way

- **`for...of` over a non-iterable threw a bare JS string**, not a TypeError, so
  `e instanceof TypeError` was false and `e.message` undefined. Every
  `assert.throws(TypeError, ...)` wrapped around a for-of was failing for the
  wrong reason, as were the prelude's `WeakSet`/`Object.fromEntries`, which route
  their iteration through the same statement.
- **A regex literal could not follow `of`.** `for (const x of /a/g)` was a parse
  error. Every other keyword is lexed with its own token kind, so `return /a/`
  was fine; `of` is contextual, arrives as a plain identifier, and `of / 2 / 1`
  really is two divisions. `inForHead()` in lexer.milo reconstructs just enough
  bracket context to tell the two apart.
- **`new RegExp(/x/g)` stringified its argument** into `[object Object]` and
  compiled a regex matching that literal text, instead of copying source and
  flags.

### Harness fix: a missing engine binary reported as 1347 crashes

The sweep read a nonexistent `/tmp/mj-eng` and reported every case as
`crash(undefined)` — indistinguishable from a catastrophic regression, and it
cost a real detour before the cause was spotted. It now exits 2 and says the
binary is missing. Same class of defect as the QuickJS failure-detection bug:
the harness answering confidently about something it could not observe.

## OPEN (superseded): es-get-iterator overflows in tape's nested-test machinery

Still stops after 76 assertions with RangeError, at the same point before and
after the valueOf fix. What the fix DID rule out, by direct measurement rather
than inference:

- `object-inspect` no longer recurses on any of the values that section uses —
  boxed symbols, bigints, numbers, functions and regexes all print correctly,
  with and without an added Symbol.iterator.
- `getIterator` answers undefined for all twelve non-iterables the section tests.

Not in tape's nested scheduling either, which was the next hypothesis and is now
also ruled out by measurement:

- one level of `t.test` inside a `forEach`, twelve times: fine;
- TWO levels — the shape `fakeIterator` actually produces, since `t.iterate`
  nests a second `t.test` inside it — twelve times: fine, and a stack probe
  immediately afterwards reports 494 of 500 frames free, so the nesting leaks
  no depth;
- every value that section uses, through spread, `inspect` and `deepEqual`
  individually: all correct.

The synchronous phase of the section runs to completion (every marker fires); the
overflow happens later, in the DEFERRED sub-test run, at the value after `{}`.
67 assertions sit behind it.

Five sittings have gone at this now and each one has only subtracted hypotheses.
Recording that as the state rather than as progress: the next attempt should
bisect the section by deleting values from `nonIterables` until it passes, which
identifies the value directly instead of reasoning about which one it might be.
