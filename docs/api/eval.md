## eval

### `evalBinaryExpr`

```milo
fn evalBinaryExpr(prog: &Prog, op: &string, a: i64, b: i64, st: &mut Interp, scope: i64): JSValue
```

Binary evaluation is separated from the full expression dispatcher so recursive
operand evaluation does not retain the fallback dispatcher's large native frame.

### `evalExprFallback`

```milo
fn evalExprFallback(prog: &Prog, idx: i64, st: &mut Interp, scope: i64): JSValue
```

Handles expression shapes outside the small recursive front dispatcher.

### `napi_call_function`

```milo
fn napi_call_function(_env: *u8, recv: i64, func: i64, argc: i64, argv: *u8, result: *u8): i32
```

Node-API's synchronous callback into JavaScript. This adapter lives beside
`callValue` to avoid an evaluator/Node-API import cycle.

### `adoptPromise`

```milo
fn adoptPromise(st: &mut Interp, derived: i64, source: i64)
```

Make `derived` follow `source`: settle now if it already has, else register.

### `anyGenParked`

```milo
pub fn anyGenParked(st: &Interp): bool
```

True if any generator has been started but not run to completion, so its body
task is parked forever. Such a task keeps the scheduler's task count > 0, which
would block main's final -1 poll and hang the process at exit — Node instead
drops an unfinished generator, so the entry point exits directly when this holds.

### `applyDescriptor`

```milo
fn applyDescriptor(st: &mut Interp, o: i64, key: &string, d: i64)
```

Define `key` on `o` from a descriptor object `d`, applying get/set or value
AND the enumerable/configurable/writable attributes (each defaulting to false
when omitted, per Object.defineProperty). Shared by defineProperty,
defineProperties, and Object.create's second argument — all three previously
dropped the attributes for accessors, and the latter two for data props too.

### `arrayIterNext`

```milo
fn arrayIterNext(st: &mut Interp, it: i64): JSValue
```

_Undocumented._

### `arrayLikeLength`

```milo
fn arrayLikeLength(prog: &Prog, o: i64, st: &mut Interp): i64
```

ToLength: NaN/negative clamp to 0, fractions truncate. The postcondition is the
safety contract arrayLikeToArray relies on — it loops to this value and pushes
an element each time, so an unbounded or negative result is either a runaway
allocation or a malformed array.

NOT currently provable: `milo prove --solver=z3` reports unknown because the
SMT translator has no rule for float literals and `toNum` declares no `ensures`
to model its result. Contracts are static-only — nothing checks this at run
time — so treat it as documentation until the translator learns f64.

### `arrayLikeOwnLength`

```milo
fn arrayLikeOwnLength(st: &Interp, o: i64): i64
```

The receiver's length BEFORE a mutating method ran, so write-back knows how far
to delete. Bounded for the same reason as arrayLikeLength: it drives a loop.

### `arrayLikeToArray`

```milo
fn arrayLikeToArray(prog: &Prog, recv: &JSValue, st: &mut Interp): i64
```

Copy an array-like receiver into a scratch array. Returns -1 if the receiver
is not adaptable or its length is out of range (with the error already
thrown). The result is NOT temp-rooted — the caller owns that.

### `arrayMethod`

```milo
fn arrayMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `arrayMethodGeneric`

```milo
fn arrayMethodGeneric(prog: &Prog, recv: &JSValue, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

Run an Array.prototype method against a receiver that is not a real array.

### `arrayMethodMutates`

```milo
fn arrayMethodMutates(name: &string): bool
```

The methods that mutate their receiver in place: after running on the scratch
array their result has to be copied back, or the call looks like a no-op.

### `arrayMethodNames`

```milo
fn arrayMethodNames(): Vec<string>
```

isArrayMethod's set as data, used to populate Array.prototype. Kept separate
because isArrayMethod is on the property-access hot path and a Vec scan there
would cost an allocation per lookup. Every name here MUST also be in
isArrayMethod, or it resolves to a method that then refuses to run.

`toString` IS included: Array.prototype.toString is join(","), and it is a
distinct function from Object.prototype.toString in the spec. It does not
shadow the type-tag path, which travels under the private @@objProtoToString
name precisely so the two cannot collide.

### `assignPattern`

```milo
fn assignPattern(prog: &Prog, patIdx: i64, value: JSValue, st: &mut Interp, scope: i64)
```

Destructure `value` into a pattern (ArrLit / ObjLit) of existing lvalue
targets. Handles nesting, holes, `...rest`, and `= default` elements.

### `assignTarget`

```milo
fn assignTarget(prog: &Prog, targetIdx: i64, value: JSValue, st: &mut Interp, scope: i64)
```

Assign `value` to a single destructuring target: a nested pattern recurses; a
`name = default` element applies the default when value is undefined; otherwise
the target is an ordinary lvalue (identifier / member / index).

### `awaitYieldMicrotasks`

```milo
fn awaitYieldMicrotasks(prog: &Prog, st: &mut Interp)
```

R2 of docs/milojs-async-suspension.md. Park the running activation until
`p` settles. Only legal off the main task: the main task runs the event loop,
so parking it would stop the timers and off-thread servicing that settle
promises in the first place — that path still drains in place.

Returns false when parking is not possible, so the caller can fall back.
A settled `await` still yields to the microtask queue in node (the continuation
is queued as a microtask). Run the microtasks pending RIGHT NOW — a snapshot,
so ones they queue run after this await, matching node — inline: no park, so
the activation's own ExecCtx (tempRoots/active scopes) stays live in the Interp
and rooted (the reverted R1a attempt bypassed that by yielding the task). Only
on an activation task; the main event-loop task drains microtasks itself.

### `bigStrOf`

```milo
fn bigStrOf(v: &JSValue): string
```

the decimal string of a BigInt, or "" for anything else

### `buildMatchArray`

```milo
fn buildMatchArray(st: &mut Interp, s: &string, saves: &Vec<i64>, rid: i64): JSValue
```

[wholeMatch, group1, group2, ...]; a non-participating group is undefined.
`rid` is the regex handle (-1 when none), used to attach `.groups` for named
captures (?<name>...).

### `buildPropDescriptor`

```milo
fn buildPropDescriptor(st: &mut Interp, h: i64, idx: i64): i64
```

Build a property-descriptor object { value, writable | get, set }+enumerable+
configurable for own property `idx` of `h`. Shared by getOwnPropertyDescriptor
and getOwnPropertyDescriptors.

### `builtinConstructorOf`

```milo
fn builtinConstructorOf(st: &Interp, o: i64): JSValue
```

The `constructor` for a builtin object, when the (faked) prototype chain has
none. Returns Undefined for anything without a well-defined builtin
constructor here, so a real (user) constructor resolved through the chain is
never overridden — this is only ever consulted as a fallback.

### `callBuiltinByName`

```milo
fn callBuiltinByName(prog: &Prog, recv: &JSValue, name: &string, args: Vec<JSValue>, st: &mut Interp): JSValue
```

Invoke a builtin method by name against an already-evaluated receiver+args.

### `callFunction`

```milo
fn callFunction(prog: &Prog, fIdx: i64, envIdx: i64, argVals: Vec<JSValue>, thisVal: JSValue, st: &mut Interp): JSValue
```

_Undocumented._

### `callMember`

```milo
fn callMember(prog: &Prog, recv: JSValue, name: &string, argsIdx: i64, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

### `callMemberValue`

```milo
fn callMemberValue(prog: &Prog, recv: &JSValue, name: &string, args: Vec<JSValue>, st: &mut Interp): JSValue
```

Call a method on an object with already-evaluated arguments.

### `callNative`

```milo
fn callNative(id: i64, argVals: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `callObjMethod`

```milo
fn callObjMethod(prog: &Prog, st: &mut Interp, recv: &JSValue, name: &string, args: Vec<JSValue>): JSValue
```

Map and Set share one entry list; a Set just stores true as every value.
Call a method by name on a user object (set-like argument plumbing).

### `callValue`

```milo
fn callValue(prog: &Prog, fnVal: &JSValue, args: Vec<JSValue>, thisVal: JSValue, st: &mut Interp): JSValue
```

_Undocumented._

### `cbThisArg`

```milo
fn cbThisArg(args: &Vec<JSValue>): JSValue
```

The (element, index, array) triple JS array-iteration callbacks receive.
The optional `thisArg` that map/filter/forEach/some/every/find/flatMap take
after their callback, and which the callback then runs with as `this`.
reduce/reduceRight are deliberately NOT in that group: their second argument
is the initial accumulator, so they always call with `this === undefined`.

### `codePointToUtf8`

```milo
fn codePointToUtf8(cp: i64): string
```

s.match(re): with the g flag, an array of all matched substrings (or null);
otherwise the first match array (whole + groups) or null.
Encode a single Unicode code point to UTF-8 (milojs's string encoding).

### `compactTimers`

```milo
fn compactTimers(st: &mut Interp)
```

Drop cancelled timers so the list cannot grow without bound in a long run.

### `currentModule`

```milo
fn currentModule(st: &Interp): string
```

_Undocumented._

### `dataViewMethod`

```milo
fn dataViewMethod(o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

DataView get/set. Default endianness is BIG-endian (the littleEndian arg
defaults false), unlike typed arrays which store host/little-endian. taLen is
the view's byte length here; taBuf/taOffset locate it in the backing buffer.

### `dateMethod`

```milo
fn dateMethod(st: &mut Interp, o: i64, name: &string, args: &Vec<JSValue>): JSValue
```

_Undocumented._

### `dateProtoMethodNames`

```milo
fn dateProtoMethodNames(): Vec<string>
```

_Undocumented._

### `describeCallee`

```milo
fn describeCallee(prog: &Prog, calleeIdx: i64): string
```

Invoke any callable JSValue (user function or native).
Build a class: the constructor becomes the class value, instance methods go on
its prototype, statics on its own property bag. `extends` chains the prototype
so instances inherit the base's methods, and records the base constructor
under __super$<Name> so super(...) can find it.
Best-effort name for a callee expression, so "is not a function" says which
one. Diagnostics only.

### `describeThrownValue`

```milo
fn describeThrownValue(st: &Interp, v: &JSValue): string
```

_Undocumented._

### `destructElement`

```milo
fn destructElement(_prog: &Prog, value: &JSValue, i: i64, st: &mut Interp): JSValue
```

One element of a value being destructured: `value[i]`. Arrays/array-likes go
through getMember by index; a string yields its i-th character.

### `doHttpFetch`

```milo
fn doHttpFetch(method: &string, url: &string, headersRaw: &string, body: &string): string
```

Invoke a native function/constructor. Error(msg) and new Error(msg) behave the
same (both mint an error object), matching JS.
Synchronous outbound HTTP/HTTPS. Milo has no coroutines and the event loop is
drained in place on await, so a blocking request is consistent with the rest of
the runtime (the server side blocks on accept too). Returns the raw HTTP
response text prefixed with 'O', or 'E' + message on any failure — the JS side
(lib/node-fetch.js) strips the sentinel and parses the response.

### `drainMicrotasks`

```milo
fn drainMicrotasks(prog: &Prog, st: &mut Interp, limit: i64)
```

Run queued microtasks. `limit` caps how many are processed (also the runaway
guard); pass a large value to drain the whole queue. A bounded limit lets an
`await` run exactly the microtasks pending at the await point — matching node,
which queues the await continuation as a microtask, so microtasks queued
before it run first and ones they queue run after.

### `earliestTimer`

```milo
fn earliestTimer(st: &Interp): i64
```

Index of the earliest active timer, or -1 when none remain.

### `endActivation`

```milo
fn endActivation(st: &mut Interp)
```

_Undocumented._

### `errorCtorIdFor`

```milo
fn errorCtorIdFor(kind: &string): i64
```

Reverse of nativeErrorName: the constructor id for a kind string, so an error
raised internally by makeError links to the same prototype a constructed one
does. Unknown kinds (URIError, EvalError — thrown by name but with no native
constructor) fall back to Error.

### `errorProtoFor`

```milo
fn errorProtoFor(st: &mut Interp, nativeId: i64): i64
```

The prototype object a freshly constructed error of this kind should link to,
or -1 before setupErrorProtos has run (makeError is reachable during startup).

### `evalArgs`

```milo
fn evalArgs(prog: &Prog, argsIdx: i64, st: &mut Interp, scope: i64): Vec<JSValue>
```

`out` is a plain Milo local, invisible to the collector, but evaluating a later
argument can run user code and therefore collect — so each finished argument is
temp-rooted until the whole list is built. Without this, f([1,2], g()) can see
the array swept and its slot reused while g() runs.

### `evalBigIntBin`

```milo
fn evalBigIntBin(op: &string, va: JSValue, vb: JSValue, st: &mut Interp): JSValue
```

Binary operators where at least one operand is a BigInt. Arithmetic requires
BOTH to be BigInt (JS throws on a mix); comparison and == coerce across types;
=== defers to the value-equality rule; bitwise on BigInt is not implemented and
throws rather than returning a silently-wrong (double-based) answer.

### `evalBin`

```milo
fn evalBin(op: &string, a: &JSValue, b: &JSValue): JSValue
```

_Undocumented._

### `evalCall`

```milo
fn evalCall(prog: &Prog, calleeIdx: i64, argsIdx: i64, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

### `evalDelete`

```milo
fn evalDelete(prog: &Prog, targetIdx: i64, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

### `evalExpr`

```milo
pub fn evalExpr(prog: &Prog, idx: i64, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

### `execBlock`

```milo
pub fn execBlock(prog: &Prog, blockIdx: i64, st: &mut Interp, scope: i64): Flow
```

_Undocumented._

### `execStmt`

```milo
pub fn execStmt(prog: &Prog, id: StmtId, st: &mut Interp, scope: i64): Flow
```

_Undocumented._

### `execTry`

```milo
fn execTry(prog: &Prog, tryB: i64, param: &string, catchB: i64, finallyB: i64, st: &mut Interp, scope: i64): Flow
```

try/catch/finally. The catch binding and both the pending throw value and any
pending return value are rooted across the finally block (which can allocate
and collect). finally overrides: its own throw or return wins; otherwise the
try/catch's pending throw or return is restored.

### `expandRepl`

```milo
fn expandRepl(repl: &string, s: &string, saves: &Vec<i64>, re: &Regex): string
```

Expand $1..$9, $&, $$, and $<name> in a replacement string against a match's
saves. `re` supplies the named-capture map for $<name> (pass a regex with no
named groups to disable it).

### `findGetter`

```milo
fn findGetter(st: &Interp, o: i64, key: &string): JSValue
```

Property read that understands arrays: `length` and integer indices hit the
element vector, everything else the string-keyed props.
Getter for `key` on `o` or anywhere up its prototype chain, else Undefined.
Kept separate from getMember because invoking a getter needs the program and a
mutable interpreter, which the plain reader does not have.

### `findNapiAddon`

```milo
fn findNapiAddon(st: &Interp, path: &string): Option<JSValue>
```

dlopen is not idempotent for addon state: a second registration would hand back
a fresh exports object and re-run module init, so loaded addons are cached by
path exactly like JS modules are.

### `findSetter`

```milo
fn findSetter(st: &Interp, o: i64, key: &string): JSValue
```

_Undocumented._

### `flattenInto`

```milo
fn flattenInto(st: &mut Interp, out: i64, arr: i64, depth: i64)
```

Flatten `arr` into `out` up to `depth` levels of nested arrays.

### `funcArity`

```milo
fn funcArity(prog: &Prog, fIdx: i64): i64
```

Function.prototype.length: the count of parameters before the first one with
a default or a rest parameter. milojs does not record defaults per-param, so
this counts declared params minus a trailing rest — enough for express, which
only checks length === 4 to detect error-handler middleware.

### `genFinish`

```milo
fn genFinish(st: &mut Interp, gi: i64, r: JSValue)
```

Called when a generator body finishes (return or fell off the end). Records the
return value (or the thrown error), marks it done, and hands control back to
whoever is inside next(). Runs on the generator's own task.

### `genIndexOf`

```milo
fn genIndexOf(st: &Interp, o: i64): i64
```

Index of the gen* record for gen object `o`, or -1.

### `genIndexOfTask`

```milo
fn genIndexOfTask(st: &Interp, task: *u8): i64
```

Index of the gen* record whose body task is `task`, or -1 — how `yield`
resolves which generator it belongs to.

### `genNext`

```milo
fn genNext(o: i64, args: Vec<JSValue>, st: &mut Interp): JSValue
```

gen.next(v): drive the generator one step. Spawns the body task on the first
call. Parks the caller and runs the body until its next `yield`, `return`, or
throw, then returns `{ value, done }`. If the body threw, the error is
re-raised at this next() site.

### `genYield`

```milo
fn genYield(handed: JSValue, st: &mut Interp): JSValue
```

The `yield e` expression, evaluated on a generator's body task. `handed` is the
already-evaluated operand. Hands it out, parks the body, and on resume returns
the value the next() caller passed in.

### `getMember`

```milo
pub fn getMember(st: &Interp, o: i64, key: &string): JSValue
```

_Undocumented._

### `getMemberDyn`

```milo
pub fn getMemberDyn(prog: &Prog, o: i64, key: &string, st: &mut Interp): JSValue
```

_Undocumented._

### `hasNodeAddonExt`

```milo
fn hasNodeAddonExt(p: &string): bool
```

_Undocumented._

### `hasPendingFetches`

```milo
fn hasPendingFetches(st: &Interp): bool
```

_Undocumented._

### `hoistBlock`

```milo
pub fn hoistBlock(prog: &Prog, blockIdx: i64, st: &mut Interp, scope: i64)
```

Bind `var` declarations and function declarations for a whole function body
before it runs. JS hoists both to the function scope through arbitrary
nesting, so this walks into blocks, loops, if/else, switch and try — unlike
let/const, which stay in the block they are written in.

### `hoistStmt`

```milo
fn hoistStmt(prog: &Prog, idx: i64, st: &mut Interp, scope: i64)
```

_Undocumented._

### `inspectArr`

```milo
fn inspectArr(st: &Interp, o: i64, depth: i64): string
```

bun renders short arrays inline: `[ 1, 2, "x" ]`, empty as `[]`.

### `inspectInner`

```milo
fn inspectInner(st: &Interp, v: &JSValue, depth: i64): string
```

Reproduces bun's console.log object rendering: one property per line, indented
two spaces per level, a trailing comma after every entry, string *values*
double-quoted, closing brace at the parent indent. `{}` stays inline. Nesting
past depth 2 collapses to `[Object]`. A top-level string prints raw (see
inspectTop) — only nested strings are quoted.

### `inspectObj`

```milo
fn inspectObj(st: &Interp, o: i64, depth: i64): string
```

_Undocumented._

### `inspectTop`

```milo
pub fn inspectTop(st: &Interp, v: &JSValue): string
```

_Undocumented._

### `instanceOf`

```milo
fn instanceOf(st: &Interp, val: &JSValue, ctor: &JSValue): bool
```

_Undocumented._

### `instantiateClass`

```milo
fn instantiateClass(prog: &Prog, classIdx: i64, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

### `isArrayMethod`

```milo
fn isArrayMethod(name: &string): bool
```

_Undocumented._

### `isBigIntVal`

```milo
fn isBigIntVal(v: &JSValue): bool
```

_Undocumented._

### `isBoundThisSet`

```milo
fn isBoundThisSet(st: &Interp, o: i64): bool
```

_Undocumented._

### `isCallable`

```milo
fn isCallable(v: &JSValue): bool
```

_Undocumented._

### `isCallableIn`

```milo
fn isCallableIn(st: &Interp, v: &JSValue): bool
```

isCallable, but also true for bound-method objects (Function.prototype.bind
results and the builtin bound methods). They are ordinary JSObjs, so the
JSValue-only test above cannot see them — typeof already reports "function".

### `isDataViewMethodName`

```milo
fn isDataViewMethodName(n: &string): bool
```

_Undocumented._

### `isErrorCtor`

```milo
fn isErrorCtor(id: i64): bool
```

_Undocumented._

### `isIdentifierText`

```milo
fn isIdentifierText(s: &string): bool
```

A single JS identifier and nothing else — what the limited eval accepts.

### `isMapSetMethodName`

```milo
fn isMapSetMethodName(n: &string): bool
```

_Undocumented._

### `isoFromMillis`

```milo
fn isoFromMillis(ms: f64): string
```

Date instance methods. Everything derives from the stored epoch milliseconds.
ISO-8601 in UTC, the format Date.prototype.toISOString produces.

### `isParkedOnPromise`

```milo
fn isParkedOnPromise(st: &Interp, t: *u8): bool
```

_Undocumented._

### `isPrimitiveMethodName`

```milo
fn isPrimitiveMethodName(n: &string): bool
```

Builtin methods dispatch natively by name; they are not properties. Reading one
as a VALUE therefore used to yield undefined even though calling it worked, which
breaks two very common patterns: feature detection (`typeof x.test === "function"`)
and method extraction (`Array.prototype.slice.call(args)`). These predicates say
whether a receiver answers to a name, so the member paths can hand back a bound
method instead of undefined.

### `isRegexMethodName`

```milo
fn isRegexMethodName(n: &string): bool
```

_Undocumented._

### `isStringMethodName`

```milo
fn isStringMethodName(n: &string): bool
```

_Undocumented._

### `isStrVal`

```milo
fn isStrVal(v: &JSValue): bool
```

_Undocumented._

### `isSuperName`

```milo
fn isSuperName(name: &string): bool
```

_Undocumented._

### `isSymbolStr`

```milo
fn isSymbolStr(s: &string): bool
```

Symbol test on the raw string. The JSValue-level isSymbolValue cannot be used
from inside a `match` arm on that same value: matching moves it, so reading the
original binding afterwards sees a zeroed slot and the test silently fails.

### `isSymbolValue`

```milo
fn isSymbolValue(v: &JSValue): bool
```

_Undocumented._

### `isTypedArrayMethodName`

```milo
fn isTypedArrayMethodName(n: &string): bool
```

_Undocumented._

### `isUndefinedValue`

```milo
fn isUndefinedValue(v: &JSValue): bool
```

_Undocumented._

### `iterClose`

```milo
fn iterClose(prog: &Prog, st: &mut Interp, iter: &JSValue)
```

Closing an iterator early is observable (the suite counts return() calls), so
every early exit from a set method has to do it.

### `iterResult`

```milo
fn iterResult(st: &mut Interp, value: JSValue, done: bool): JSValue
```

Build a `{ value, done }` iterator-result object.

### `iterStep`

```milo
fn iterStep(prog: &Prog, st: &mut Interp, iter: &JSValue, done: &mut bool): JSValue
```

One step of an iterator: returns done via the out-param slot.

### `joinArray`

```milo
fn joinArray(st: &mut Interp, o: i64, sep: &string): string
```

Property read that honours accessors; `this` inside the getter is the object.
Array.prototype.join / toString, prog-free so string-coercion paths (which have
no Prog) can reuse it. Nested arrays join recursively; null/undefined render
empty; every other element goes through toStr (plain objects -> [object Object]).

### `makeArrayFromCtor`

```milo
fn makeArrayFromCtor(st: &mut Interp, argVals: &Vec<JSValue>): JSValue
```

new Array(n) preallocates n holes; new Array(a, b, ...) is a literal list.

### `makeArrayIterator`

```milo
fn makeArrayIterator(st: &mut Interp, arr: i64, kind: i64): JSValue
```

An array iterator: a plain object holding the source array plus a cursor, with
`next` and `[Symbol.iterator]` as bound builtin methods. Built this way because
a native has no per-instance state and JSValue has nowhere to carry a cursor.
kind: 0 values, 1 keys, 2 entries.

### `makeBoundMethod`

```milo
fn makeBoundMethod(st: &mut Interp, recv: JSValue, name: string): JSValue
```

_Undocumented._

### `makeCbArgs`

```milo
fn makeCbArgs(st: &Interp, o: i64, i: i64): Vec<JSValue>
```

_Undocumented._

### `makeError`

```milo
pub fn makeError(st: &mut Interp, kind: string, msg: string): JSValue
```

_Undocumented._

### `makeGenerator`

```milo
fn makeGenerator(fIdx: i64, envIdx: i64, argVals: Vec<JSValue>, thisVal: JSValue, st: &mut Interp): JSValue
```

Create a generator object for a `function*` call. Does NOT run the body — that
starts on the first next(). Registers the gen* record and returns the object.

### `makeRegex`

```milo
fn makeRegex(st: &mut Interp, pattern: string, flags: string): JSValue
```

x instanceof C: for a user constructor, the object must have been made by it
(its `ctor` slot matches); for a native Error constructor, the object must be
an error whose kind matches (Error itself matches any error).
Compile a pattern and wrap it as a RegExp object (regexId links to the
compiled program; source/flags/lastIndex are ordinary properties).

### `makeTypedArray`

```milo
fn makeTypedArray(st: &mut Interp, kind: i64, args: &Vec<JSValue>): JSValue
```

new <T>Array(n | buffer | array) — allocates its own buffer except when handed
an existing ArrayBuffer, which it views in place (mutations are shared).

### `mapMethod`

```milo
fn mapMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `markRejectHandled`

```milo
fn markRejectHandled(st: &mut Interp, p: i64)
```

Awaiting or attaching a handler to a rejected promise counts as handling it,
so drop it from the unhandled-rejection set reported at loop end. (Without this,
`try { await Promise.reject(e) } catch {}` still printed a spurious unhandled
rejection — GC-masked, since a collected promise slot was skipped at reporting.)

### `mathNative`

```milo
fn mathNative(id: i64, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `napiDrainSettlements`

```milo
fn napiDrainSettlements(st: &mut Interp)
```

Apply promise settlements an addon requested while it held control.

### `napiServiceTsfn`

```milo
fn napiServiceTsfn(st: &mut Interp)
```

_Undocumented._

### `nativeCtorName`

```milo
fn nativeCtorName(id: i64): string
```

The `.name` of a native constructor (Object.name === "Object" etc), so
`err.constructor.name` and similar resolve. Empty for natives that are not
named constructors.

### `nativeErrorName`

```milo
fn nativeErrorName(id: i64): string
```

_Undocumented._

### `numToLocale`

```milo
fn numToLocale(n: f64): string
```

Call a member as a method: `this` binds to the receiver. String and array
receivers dispatch to built-in methods; object receivers use function-valued
properties. The receiver is temp-rooted across argument evaluation (an argument
may be a call that triggers GC).
toString/valueOf and friends on a number, boolean, string, null or undefined.
Number.toLocaleString default (en-US): thousands-grouped integer part, up to 3
fraction digits with trailing zeros stripped — (1000000).toLocaleString() is
"1,000,000" and (1234.5678) is "1,234.568". Only the default locale; no
currency/percent options.

### `objectTag`

```milo
fn objectTag(st: &Interp, o: i64): string
```

The tag Object.prototype.toString uses for a heap-object receiver.

### `objectTypeTag`

```milo
fn objectTypeTag(v: &JSValue): string
```

The tag Object.prototype.toString uses for a primitive receiver.

### `objIsoOrTag`

```milo
fn objIsoOrTag(st: &Interp, o: i64): string
```

_Undocumented._

### `parkOnPromise`

```milo
pub fn parkOnPromise(st: &mut Interp, p: i64): bool
```

_Undocumented._

### `primitiveMethod`

```milo
fn primitiveMethod(name: &string, recv: &JSValue, args: &Vec<JSValue>): JSValue
```

_Undocumented._

### `promiseMethod`

```milo
fn promiseMethod(o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

Dispatch a built-in Array method. `o` (the array) is temp-rooted by the caller;
the result array and the callback are additionally rooted while callbacks run
(a callback can allocate and collect).
.then/.catch/.finally on an already-settled promise. Callbacks run immediately
(no microtask queue), so ordering differs from real JS, but the value flow and
the rejection-skips-onFulfilled rule match.
.then/.catch/.finally. Handlers never run synchronously: they are queued as
microtasks, so ordering matches JS instead of the old settle-in-place model.

### `propertyBagOf`

```milo
fn propertyBagOf(st: &mut Interp, v: &JSValue): i64
```

The object that holds a value's properties: itself for an object, the statics
bag for a function, the native bag for a builtin. Functions are property
carriers in JS, and express builds its app by copying descriptors onto one.

### `protoOfHandle`

```milo
fn protoOfHandle(st: &Interp, h: i64): i64
```

The property bag a value carries, or -1. A function's own properties live in
its statics bag, not in an object slot, so Object.assign has to look there for
both its target and its sources — prisma's debug module is a function on both
sides of `Object.assign(fn, otherFn)`.
The prototype object index for object `h`, or -1 (null). milojs fakes the
prototype chain — a plain `{}` has proto -1 and inherits Object.prototype
methods by dispatch — so getPrototypeOf / `__proto__` / `constructor` resolve
the right singleton by type here rather than reading a real link.

### `proxyDelete`

```milo
fn proxyDelete(prog: &Prog, o: i64, key: string, st: &mut Interp): JSValue
```

`delete obj.k` / `delete obj[k]` — remove an own property. Array elements
become holes (undefined) rather than shifting, as in JS. Always returns true
here; the non-configurable cases the spec reports false for do not arise.
`delete proxy[key]`: the deleteProperty trap, else delete on the target.

### `proxyOwnEnumKeys`

```milo
fn proxyOwnEnumKeys(prog: &Prog, st: &mut Interp, o: i64): Vec<string>
```

Enumerable own string keys of a proxy: the ownKeys trap supplies the list,
then each key is kept only if its descriptor (getOwnPropertyDescriptor trap,
falling back to the target's own descriptor) says enumerable. Missing ownKeys
forwards to the target. Feeds for-in and Object.keys.

### `proxyTrap`

```milo
fn proxyTrap(st: &Interp, o: i64, name: &string): JSValue
```

The handler trap `name`, or undefined when the handler does not define it.

### `readLValue`

```milo
fn readLValue(prog: &Prog, targetIdx: i64, st: &mut Interp, scope: i64): JSValue
```

Read an assignable target (identifier / member / computed index) as a value.
Backs ++/-- and compound assignment; the base object of a member target is
evaluated here and again by writeLValue (harmless unless the base has side
effects, which is rare).

### `regexIdOf`

```milo
fn regexIdOf(st: &Interp, v: &JSValue): i64
```

_Undocumented._

### `regexMethod`

```milo
fn regexMethod(st: &mut Interp, o: i64, name: &string, args: &Vec<JSValue>): JSValue
```

_Undocumented._

### `regexReplace`

```milo
fn regexReplace(st: &mut Interp, s: &string, rid: i64, repl: &string): JSValue
```

_Undocumented._

### `regexReplaceFn`

```milo
fn regexReplaceFn(prog: &Prog, st: &mut Interp, s: &string, rid: i64, fn_: &JSValue): JSValue
```

s.replace(re, fn): the callback receives (match, ...groups, offset, string) and
its return value is substituted. Without this the function was coerced with
toStr and the literal text "function" ended up in the output.

### `regexSplit`

```milo
fn regexSplit(st: &mut Interp, s: &string, rid: i64): JSValue
```

s.split(re) — the separator is whatever the pattern matches. A zero-width
match advances by one so the split cannot loop forever.

### `regexStrMatch`

```milo
fn regexStrMatch(st: &mut Interp, s: &string, rid: i64): JSValue
```

_Undocumented._

### `regexStrMatchAll`

```milo
fn regexStrMatchAll(st: &mut Interp, s: &string, rid: i64): JSValue
```

str.matchAll(re): every match as a full exec-style array (match text, capture
groups, .index, .input) — unlike match/g which yields only the match strings.
Returned as an array, which is iterable for the usual `[...]` / for-of
consumption. Iterates regardless of the /g flag (lenient vs the spec's throw).

### `releaseCreatorOnce`

```milo
fn releaseCreatorOnce(st: &mut Interp)
```

Let the caller of this activation continue. Called at the activation's first
suspension point, and at completion if it never suspends — an async call
returns once its body reaches the first await, not when the body finishes.

### `removeGen`

```milo
fn removeGen(st: &mut Interp, gi: i64)
```

Drop a completed generator's record. Left in place, its stale body-task
pointer would collide with a future generator whose freshly-spawned task
reuses the same freed address — genIndexOfTask would then resolve `yield` to
the wrong (dead) record and write the yielded value into the wrong slot, so
the real consumer reads a stale value. Object indices of removed generators
are free to be recycled since collect no longer marks them.

### `reportUnhandledRejections`

```milo
fn reportUnhandledRejections(st: &mut Interp)
```

Node reports (and by default dies on) rejections nothing handles; silently
dropping them turned a thrown await-deadline error into an invisible hang.

### `requireModule`

```milo
fn requireModule(prog: &Prog, spec: &string, st: &mut Interp): JSValue
```

require(spec) — resolved against the directory of the module doing the calling.

### `resumeExecCtx`

```milo
pub fn resumeExecCtx(st: &mut Interp, task: *u8)
```

Take back the execution belonging to `task`, wherever it sits in the parked
set. Parks and wakes interleave, so position says nothing about ownership.

### `runDueTimer`

```milo
fn runDueTimer(prog: &Prog, st: &mut Interp): bool
```

Run a timer only if it is already due; never sleeps.

### `runEventLoop`

```milo
pub fn runEventLoop(prog: &Prog, st: &mut Interp)
```

_Undocumented._

### `runModule`

```milo
pub fn runModule(prog: &Prog, idx: i64, st: &mut Interp): JSValue
```

Execute a pre-loaded module in a fresh CommonJS scope and cache its exports.
A module already loading (a require cycle) returns its partial exports, which
is what Node does.

### `runOneTimer`

```milo
fn runOneTimer(prog: &Prog, st: &mut Interp): bool
```

Run one due timer, sleeping until it is due. Returns false when there is
nothing left to run.

### `sameValue`

```milo
fn sameValue(a: &JSValue, b: &JSValue): bool
```

SameValue: strict equality with the two exceptions the spec carves out —
NaN is equal to itself, and +0 is not equal to -0.

### `schedulerYieldedToActivation`

```milo
fn schedulerYieldedToActivation(st: &mut Interp): bool
```

The event loop: microtasks to exhaustion, then one timer, repeat. Returns when
nothing is left to run — which for a server with an interval never happens.
Give any runnable activation the CPU. Returns true if one was there to run,
so the event loop prefers a live continuation over sleeping on a timer.

### `serveHttpOnce`

```milo
fn serveHttpOnce(prog: &Prog, st: &mut Interp): bool
```

Ask each registered http server to accept and handle one connection. Returns
true only when a connection was actually handled, so the event loop can tell
a served request apart from an idle listener.

### `serviceFetches`

```milo
fn serviceFetches(st: &mut Interp)
```

Drain every queued microtask. Microtasks may enqueue more, which is correct:
JS runs the queue to exhaustion before the next timer.
Settle a promise and queue every reaction that was waiting on it. Settling
twice is ignored, as in JS.
Run threadsafe-function calls queued by an addon's own threads, then apply any
promise settlements they made. This is the only place a foreign thread's work
crosses into the interpreter.
Settle any fetch whose worker thread has finished. Called from the event loop
and from a blocked await, the same way node-api work is serviced.

### `setHasValue`

```milo
fn setHasValue(st: &Interp, o: i64, v: &JSValue): bool
```

_Undocumented._

### `setLikeHas`

```milo
fn setLikeHas(prog: &Prog, st: &mut Interp, other: &JSValue, v: &JSValue): bool
```

`other.has(v)` where other may be a real Set (whose `has` is native dispatch,
not a property) or a user set-like (where it is a property).

### `setLikeKeys`

```milo
fn setLikeKeys(prog: &Prog, st: &mut Interp, other: &JSValue): JSValue
```

other.keys() — the iterator a set-like exposes.

### `setLikeSize`

```milo
fn setLikeSize(_prog: &Prog, st: &mut Interp, other: &JSValue): f64
```

The set-methods proposal takes "set-like" objects: {size, has, keys}. `size` is
validated first and its diagnostics must name `.size`, which the suite checks.
Returns the size, or -1.0 after throwing.

### `setMember`

```milo
fn setMember(st: &mut Interp, o: i64, key: string, value: JSValue)
```

_Undocumented._

### `setMemberDyn`

```milo
fn setMemberDyn(prog: &Prog, o: i64, key: string, v: JSValue, st: &mut Interp)
```

_Undocumented._

### `settlePromise`

```milo
pub fn settlePromise(st: &mut Interp, p: i64, state: i64, value: JSValue)
```

_Undocumented._

### `setupErrorProtos`

```milo
fn setupErrorProtos(st: &mut Interp)
```

Give the Error family real prototype objects. They are natives, so before
this `TypeError.prototype` was undefined and `TypeError.prototype.constructor`
threw — a common branch in library code, and the single largest failure
bucket in the test262 sweep.

The objects live in each native's property bag (getNativeProps), which the
collector already walks, so they need no new GC root. Subtype prototypes chain
to Error.prototype the way the spec says, which is what makes
`Object.getPrototypeOf(TypeError.prototype) === Error.prototype` hold.

### `setupGlobals`

```milo
pub fn setupGlobals(st: &mut Interp)
```

_Undocumented._

### `spaces`

```milo
fn spaces(n: i64): string
```

_Undocumented._

### `spawnActivation`

```milo
fn spawnActivation(fIdx: i64, envIdx: i64, argVals: Vec<JSValue>, thisVal: JSValue, st: &mut Interp, caller: *u8): JSValue
```

R1: run an async body on its own green task and hand the caller a pending
promise as soon as that body reaches its first await.

The caller parks straight after spawning. Tasks are cooperative and only one
runs at a time, so the body cannot start before that park — there is no race
between spawning and waiting.

### `spreadBuiltin`

```milo
fn spreadBuiltin(out: &mut Vec<JSValue>, v: &JSValue, st: &Interp)
```

_Undocumented._

### `spreadInto`

```milo
fn spreadInto(prog: &Prog, out: &mut Vec<JSValue>, v: &JSValue, st: &mut Interp)
```

Spread an array value's elements into `out` (a no-op for non-arrays).
Spread any iterable: the built-ins directly, and anything carrying
[Symbol.iterator] by driving its next(). Driving calls back into user code, so
this needs the program and a mutable interpreter — which is why it is not the
immutable helper it once was.

### `strProtoMethodNames`

```milo
fn strProtoMethodNames(): Vec<string>
```

_Undocumented._

### `symbolDescription`

```milo
fn symbolDescription(s: &string): string
```

The description inside "@@sym:<desc>:<counter>". The counter is what makes two
same-description symbols distinct, so it is stripped from the LAST colon —
a description may itself contain colons.

### `symbolDisplay`

```milo
fn symbolDisplay(s: &string): string
```

What a symbol shows as: Symbol(desc). Without this the internal representation
leaks out of String(sym) and sym.toString().

### `symIteratorKey`

```milo
fn symIteratorKey(): string
```

The well-known @@iterator key. Symbols are interned strings, so this is just a
fixed one; counter 0 is reserved because user symbols start at 1.

### `symToPrimitiveKey`

```milo
fn symToPrimitiveKey(): string
```

_Undocumented._

### `symToStringTagKey`

```milo
fn symToStringTagKey(): string
```

_Undocumented._

### `taElem`

```milo
fn taElem(st: &Interp, view: i64, i: i64): f64
```

_Undocumented._

### `taSetElem`

```milo
fn taSetElem(st: &mut Interp, view: i64, i: i64, v: f64)
```

_Undocumented._

### `throwNullMember`

```milo
fn throwNullMember(st: &mut Interp, name: &string, base: &string): JSValue
```

Reading a property of null/undefined is a TypeError, not undefined. Returning
undefined instead turns a typo into a value that fails much later, somewhere
unrelated.

### `throwTypeErr`

```milo
fn throwTypeErr(st: &mut Interp, msg: string): JSValue
```

A real Error object, so catch blocks see .name/.message and instanceof works.
Raise a TypeError and yield undefined, for the proxy traps.

### `toPrimitiveDefault`

```milo
fn toPrimitiveDefault(prog: &Prog, v: &JSValue, st: &mut Interp): JSValue
```

_Undocumented._

### `toPrimitiveNumber`

```milo
fn toPrimitiveNumber(prog: &Prog, v: &JSValue, st: &mut Interp): JSValue
```

_Undocumented._

### `trySymToPrimitive`

```milo
fn trySymToPrimitive(prog: &Prog, h: i64, hint: &string, st: &mut Interp): Option<JSValue>
```

JS ToPrimitive with the "default" hint (used by `+`): try valueOf, then
toString, taking the first that yields a primitive. Arrays and plain objects
valueOf to themselves, so toString decides — arrays join, plain objects give
"[object Object]". A non-object value is already primitive.
ToPrimitive with the NUMBER hint (used by arithmetic/relational operators).
The only object whose number-hint result differs from the default here is a
Date: default hint (used by `+`) stringifies it, number hint yields its epoch
milliseconds. Everything else follows the same valueOf-then-toString path.
A user-defined [Symbol.toPrimitive](hint) takes precedence over valueOf/
toString. Returns Option.Some(primitive) when the method exists, else None so
the caller falls through to the ordinary coercion.

### `typedArrayMethod`

```milo
fn typedArrayMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

Typed-array methods. Views share their buffer, so subarray returns a new view
over the SAME bytes while slice copies — getting that backwards is the classic
typed-array bug.

### `typeofStr`

```milo
fn typeofStr(v: &JSValue): string
```

typeof: never throws, even for an unbound name (scopeLookup returns undefined).

### `wakeAwaiters`

```milo
fn wakeAwaiters(st: &mut Interp, p: i64)
```

Wake every activation waiting on `p`, in the order they began awaiting (R3).

### `writeBackArrayLike`

```milo
fn writeBackArrayLike(st: &mut Interp, tmp: i64, o: i64)
```

_Undocumented._

### `writeLValue`

```milo
fn writeLValue(prog: &Prog, targetIdx: i64, st: &mut Interp, scope: i64, value: JSValue)
```

_Undocumented._

### `yieldAtAwait`

```milo
fn yieldAtAwait(st: &mut Interp)
```

Drop this activation's bookkeeping and its pre-bind roots once the body ends.
An activation reaching any await hands control back to whoever called it and
lets the scheduler run them before this body continues. A no-op off an
activation: the main task owns the event loop and must not yield here.
