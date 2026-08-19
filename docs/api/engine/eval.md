## engine/eval

### `anyGenParked`

```milo
pub fn anyGenParked(st: &Interp): bool
```

True if any generator has been started but not run to completion, so its body
task is parked forever. Such a task keeps the scheduler's task count > 0, which
would block main's final -1 poll and hang the process at exit — Node instead
drops an unfinished generator, so the entry point exits directly when this holds.

### `arityLookup`

```milo
pub fn arityLookup(data: &string, name: &string): i64
```

Find `name` in "n:a,n:a,..." and answer its arity, or 0 when it is absent
(which is what every one of these tables returned for an unlisted name).

A scan rather than a HashMap: a global map cannot be initialized in the
embeddable build, which is compiled with --no-entry and so runs no global
initializers. At a few hundred boot-time lookups over 4KB the scan does not
show up, and it keeps these three fns stateless.

### `arrayBufferProto`

```milo
pub fn arrayBufferProto(st: &mut Interp): i64
```

_Undocumented._

### `arrGetDyn`

```milo
pub fn arrGetDyn(prog: &Prog, o: i64, idx: i64, st: &mut Interp): JSValue
```

join with each element converted through `prog`. The prog-free joinArray
remains for the coercion paths that have no Prog to re-enter user code with.
Element read that honours the prototype chain including ACCESSORS. arrGet
has no Prog and so cannot call a getter: with a getter installed at
`Array.prototype[1]`, a hole at index 1 read as undefined and indexOf could
never find its value.

### `awaitValue`

```milo
pub fn awaitValue(prog: &Prog, va: &JSValue, st: &mut Interp): JSValue
```

`await v`, factored out of the Unary branch so `for await (… of …)` can reuse
it verbatim rather than growing a second, drifting copy of the thenable
unwrapping, the activation park, and the main-task drain.

### `bigStrOf`

```milo
pub fn bigStrOf(v: &JSValue): string
```

the decimal string of a BigInt, or "" for anything else

### `builtinArityOn`

```milo
pub fn builtinArityOn(host: &string, n: &string): i64
```

A few method NAMES are shared by builtins whose arities differ, so a table
keyed by the name alone is necessarily wrong for one of them. `set` is the
live case: Map.prototype.set and WeakMap.prototype.set take (key, value) and
report 2, while %TypedArray%.prototype.set takes (array, offset) and reports
1. builtinArity holds the TypedArray value, so the host is passed in at the
sites that know it rather than the constant being flipped (which would only
move the failure onto TypedArray).

### `builtinCtorArity`

```milo
pub fn builtinCtorArity(n: &string): i64
```

_Undocumented._

### `builtinStaticArity`

```milo
pub fn builtinStaticArity(n: &string): i64
```

_Undocumented._

### `callBuiltinByName`

```milo
pub fn callBuiltinByName(prog: &Prog, recv: &JSValue, name: &string, args: Vec<JSValue>, st: &mut Interp): JSValue
```

Invoke a builtin method by name against an already-evaluated receiver+args.

### `callFunction`

```milo
pub fn callFunction(prog: &Prog, fIdx: i64, envIdx: i64, argVals: Vec<JSValue>, thisVal: JSValue, st: &mut Interp): JSValue
```

Records the called function's source file for the duration of the call, so a
V8-style stack trace can name the file each frame belongs to. Wrapping rather
than editing callFunctionBody's many early returns keeps the push and pop
paired without touching its control flow.

### `callNativeProg`

```milo
pub fn callNativeProg(prog: &Prog, n: &Native, argVals: &Vec<JSValue>, st: &mut Interp): JSValue
```

Native dispatch for the call sites that hold a Prog. callNative itself does
not, so any native whose answer depends on re-entering user code has to be
intercepted here — otherwise `String(obj)` reports "[object Object]" for an
object whose toString says otherwise, while `${obj}` and `"" + obj` (both of
which run the full ToPrimitive) disagree with it.

### `callValue`

```milo
pub fn callValue(prog: &Prog, fnVal: &JSValue, args: Vec<JSValue>, thisVal: JSValue, st: &mut Interp): JSValue
```

_Undocumented._

### `constructValue`

```milo
pub fn constructValue(prog: &Prog, st: &mut Interp, ctor: &JSValue, argVals: Vec<JSValue>, newTarget: &JSValue): JSValue
```

_Undocumented._

### `ctorArityData`

```milo
pub fn ctorArityData(): string
```

GENERATED from node (see docs/backlog.md): the `length` every built-in
function carries. test262 has a length.js per method asserting it exactly.

Three names disagree across prototypes: constructor (excluded), toString
(Number.prototype.toString is 1, everything else 0) and set
(Map.prototype.set is 2, %TypedArray%.prototype.set is 1). `set` is no longer
resolved from this table alone: builtinArityOn(host, name) takes the receiver
brand and this table holds only its fallback. `toString` still uses the
commoner value.
GENERATED from node: the `length` of a built-in STATIC. Kept separate from
builtinArity because the same name can differ — Object.keys is 1 while
Array.prototype.keys is 0.
GENERATED from node: a built-in CONSTRUCTOR own `length`.

All three are DATA. They used to be 1,184 lines of `if n == "x" { return N }`,
a linear string-compare chain per table walked on every lookup. Same 402
values, one comma-separated string each, decoded once into a HashMap on first
use. tools/check-arity.mjs parses these strings and still holds every value
against node, which is what makes it safe to keep them as data.
The table, embedded at compile time. A fn rather than a global because a
global string needs an initializer that runs, and the embeddable library is
built with --no-entry (same reason src/engine/uniprops.milo spells its data upData()).

### `currentModule`

```milo
pub fn currentModule(st: &Interp): string
```

_Undocumented._

### `dataViewByteLen`

```milo
pub fn dataViewByteLen(st: &Interp, o: i64): i64
```

A DataView's byte length right now. One constructed without an explicit
length tracks its buffer, so the stored taLen goes stale on every resize.

### `dateProtoMethodNames`

```milo
pub fn dateProtoMethodNames(): Vec<string>
```

_Undocumented._

### `definePropOf`

```milo
pub fn definePropOf(prog: &Prog, st: &mut Interp, v: &JSValue, key: &string, d: i64): bool
```

_Undocumented._

### `evalBinValues`

```milo
pub fn evalBinValues(prog: &Prog, op: &string, va: JSValue, vb: JSValue, st: &mut Interp): JSValue
```

The value-level half of a binary operator: everything after both operands
have been evaluated. Split out of evalBinArm so the bytecode VM runs the same
semantics rather than a second copy of them — a duplicated implementation of
ToPrimitive ordering is exactly the kind that drifts and is then wrong in one
place only.

### `evalExpr`

```milo
pub fn evalExpr(prog: &Prog, id: ExprId, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

### `evalInOperator`

```milo
pub fn evalInOperator(prog: &Prog, key: string, ov: JSValue, st: &mut Interp): JSValue
```

The `in` operator. Extracted because it existed twice, and both copies fell
through to `false` for a NATIVE or a FUNCTION right-hand side: `"prototype" in
String` answered false while `String.prototype` read fine. get-intrinsic walks
`%String.prototype.indexOf%` with exactly that test, so every package that
depends on it (a large slice of npm) died on "base intrinsic for
%String.prototype.indexOf% exists, but the property is not available".

### `execBlock`

```milo
pub fn execBlock(prog: &Prog, blockId: BlockId, st: &mut Interp, scope: i64): Flow
```

_Undocumented._

### `execStmt`

```milo
pub fn execStmt(prog: &Prog, id: StmtId, st: &mut Interp, scope: i64): Flow
```

_Undocumented._

### `funcSourceText`

```milo
pub fn funcSourceText(prog: &Prog, fIdx: i64): string
```

_Undocumented._

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

### `getOwnPropDescOf`

```milo
pub fn getOwnPropDescOf(prog: &Prog, st: &mut Interp, v: &JSValue, key: &string): JSValue
```

_Undocumented._

### `getProtoOf`

```milo
pub fn getProtoOf(prog: &Prog, st: &mut Interp, v: &JSValue): JSValue
```

_Undocumented._

### `hoistBlock`

```milo
pub fn hoistBlock(prog: &Prog, blockId: BlockId, st: &mut Interp, scope: i64)
```

_Undocumented._

### `inspectTop`

```milo
pub fn inspectTop(st: &Interp, v: &JSValue): string
```

_Undocumented._

### `isBigIntVal`

```milo
pub fn isBigIntVal(v: &JSValue): bool
```

_Undocumented._

### `isCallable`

```milo
pub fn isCallable(v: &JSValue): bool
```

_Undocumented._

### `isCallableIn`

```milo
pub fn isCallableIn(st: &Interp, v: &JSValue): bool
```

isCallable, but also true for bound-method objects (Function.prototype.bind
results and the builtin bound methods). They are ordinary JSObjs, so the
JSValue-only test above cannot see them — typeof already reports "function".

### `isCanonicalNumericKey`

```milo
pub fn isCanonicalNumericKey(key: &string): bool
```

The view's element count RIGHT NOW. A tracking view over a resizable buffer
answers a different number after every resize, so nothing may read the stored
taLen directly.
CanonicalNumericIndexString: a key whose ToString(ToNumber(key)) is the key
itself. On a typed array such a key is handled by the integer-index path even
when it is not a valid index, and an invalid one is DROPPED rather than stored:
`u8["1.5"] = 5` and `u8[-1] = 5` must leave no property behind. Without this
they became ordinary properties, so they read back and turned up in
Object.keys, which no real array index ever does.

### `isExtensibleOf`

```milo
pub fn isExtensibleOf(prog: &Prog, st: &mut Interp, v: &JSValue): bool
```

_Undocumented._

### `isoFromMillis`

```milo
pub fn isoFromMillis(ms: f64): string
```

_Undocumented._

### `isSymbolStr`

```milo
pub fn isSymbolStr(s: &string): bool
```

Symbol test on the raw string. The JSValue-level isSymbolValue cannot be used
from inside a `match` arm on that same value: matching moves it, so reading the
original binding afterwards sees a zeroed slot and the test silently fails.

### `isSymbolValue`

```milo
pub fn isSymbolValue(v: &JSValue): bool
```

_Undocumented._

### `isUndefinedValue`

```milo
pub fn isUndefinedValue(v: &JSValue): bool
```

_Undocumented._

### `joinArrayProg`

```milo
pub fn joinArrayProg(prog: &Prog, st: &mut Interp, o: i64, sep: &string): string
```

_Undocumented._

### `localOffsetSecAt`

```milo
pub fn localOffsetSecAt(epochSec: i64): i64
```

_Undocumented._

### `makeArrayIterator`

```milo
pub fn makeArrayIterator(st: &mut Interp, arr: i64, kind: i64): JSValue
```

_Undocumented._

### `makeBoundMethod`

```milo
pub fn makeBoundMethod(st: &mut Interp, recv: JSValue, name: string): JSValue
```

_Undocumented._

### `makeBoundMethodOn`

```milo
pub fn makeBoundMethodOn(st: &mut Interp, recv: JSValue, name: string, host: string): JSValue
```

_Undocumented._

### `makeError`

```milo
pub fn makeError(st: &mut Interp, kind: string, msg: string): JSValue
```

_Undocumented._

### `makeTypedArray`

```milo
pub fn makeTypedArray(prog: &Prog, st: &mut Interp, kind: i64, args: &Vec<JSValue>): JSValue
```

_Undocumented._

### `makeWrapper`

```milo
pub fn makeWrapper(st: &mut Interp, v: &JSValue): JSValue
```

Box a primitive. A String wrapper materialises its index properties and
length up front: the string is immutable, so there is nothing to keep in sync,
and it makes `0 in s`, Object.keys and for-in work without a special case on
every path that enumerates.

### `memberOfValue`

```milo
pub fn memberOfValue(prog: &Prog, ov: JSValue, name: &string, st: &mut Interp): JSValue
```

Property read (`o.x`) and computed read (`o[k]`) are extracted from
evalExprFallback for the same reason as assignment: they are among the most
frequent nodes in real code, and reaching them through the fallback charged
each one that function's multi-kilobyte frame. Their own arms were also the
two largest in it, so moving them out shrinks the frame every REMAINING
fallback node pays too.
The value-level half of a property read: everything after the object
expression has been evaluated. Split out of evalMemberExpr so the bytecode VM
reads a property through the same primitive-receiver rules (a number's
__proto__, a string's length, a boxed wrapper) instead of a second copy.

### `nativeErrorName`

```milo
pub fn nativeErrorName(id: Builtin): string
```

_Undocumented._

### `nativeSourceText`

```milo
pub fn nativeSourceText(st: &mut Interp, n: &Native): string
```

Parse `src` into the shared program and run it in `scope`, answering the
completion value (the last value-producing statement), which is what eval
returns.

Appending to gProg mid-evaluation is the part worth understanding: the arena
Vecs can reallocate while an outer evalExpr walk is live. It holds because
Milo's `&Prog` is a second-class reference that is re-read through rather than
cached across a call, so the walk picks up the new buffer. The stress case is
covered by tests/evalRuntime.js: 400 eval'd closures escaping into an array,
each forcing more appends, then all called afterwards.
A user function's VERBATIM source text, sliced out of the file it was parsed
from. Every function used to answer "function <name>() { [native code] }",
which is not merely imprecise: lodash and friends test for that exact string
to tell a built-in from a user function, so every user function looked native.
A built-in's source text. Its own `name` property is authoritative: it is set
from node's own tables by nameNativesOf.

### `ownEnumerableKeys`

```milo
pub fn ownEnumerableKeys(prog: &Prog, st: &mut Interp, v: &JSValue): Vec<string>
```

EnumerableOwnPropertyNames: the own STRING keys that are enumerable, in spec
order. A Proxy has no own properties of its own, so every caller that walked
`enumOrder` over the object's prop table saw nothing and Object.values,
Object.entries, Object.assign and `{...proxy}` all came back empty. This goes
through the ownKeys and getOwnPropertyDescriptor traps instead.

### `ownKeysOf`

```milo
pub fn ownKeysOf(prog: &Prog, st: &mut Interp, v: &JSValue): Vec<string>
```

_Undocumented._

### `ownStringKeys`

```milo
pub fn ownStringKeys(st: &Interp, h: i64, enumOut: &mut Vec<bool>, propOut: &mut Vec<i64>): Vec<string>
```

[[OwnPropertyKeys]] over any value, as raw keys — symbols included, in the
"@@sym:" spelling they are stored under. A proxy consults its ownKeys trap
and with no trap forwards to its target, which may itself be a proxy.
The ONE answer to "which own string keys does this object have, and which of
them are enumerable", in [[OwnPropertyKeys]] order: integer indices first, then
`length` for an array, then the remaining string properties in insertion order.

It exists because that question was answered independently in five places --
ownKeysOf, Object.keys, Object.values/entries, for-in, and (through for-in) the
JS-level JSON.stringify -- each with its own idea of which representations
carry keys. When typed arrays grew index enumeration, four of the five were
still wrong, in four different ways. A new representation should have to be
taught this once.

Reads `st` only: no descriptors are built, no getters run, nothing is allocated
on the JS heap. That is what lets the hot callers (Object.keys, for-in) use it.
`enumOut` and `propOut` are filled in step with the returned keys: `propOut` is
the key's index in the object's property table, or -1 when the key came from
the element vector or a typed array's buffer. Callers need that to avoid
re-deriving it -- for-in wants only the keys the property table cannot hold,
and Object.values wants to read a data property's slot directly rather than
going through a full [[Get]]. Without it both paid a lookup per key and
enumeration ran 40% slower.

### `parkOnPromise`

```milo
pub fn parkOnPromise(st: &mut Interp, p: i64): bool
```

_Undocumented._

### `preventExtOf`

```milo
pub fn preventExtOf(prog: &Prog, st: &mut Interp, v: &JSValue, seal: bool): bool
```

_Undocumented._

### `registerUsing`

```milo
pub fn registerUsing(prog: &Prog, st: &mut Interp, scopeIdx: i64, name: &string)
```

_Undocumented._

### `resumeExecCtx`

```milo
pub fn resumeExecCtx(st: &mut Interp, task: *u8)
```

Take back the execution belonging to `task`, wherever it sits in the parked
set. Parks and wakes interleave, so position says nothing about ownership.

### `runDisposals`

```milo
pub fn runDisposals(prog: &Prog, st: &mut Interp, scopeIdx: i64)
```

_Undocumented._

### `runEvalSource`

```milo
pub fn runEvalSource(src: &string, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

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

### `sameValue`

```milo
pub fn sameValue(a: &JSValue, b: &JSValue): bool
```

SameValue: strict equality with the two exceptions the spec carves out —
NaN is equal to itself, and +0 is not equal to -0.

### `setMemberDyn`

```milo
pub fn setMemberDyn(prog: &Prog, o: i64, key: string, v: JSValue, st: &mut Interp)
```

_Undocumented._

### `setMemberOfValue`

```milo
pub fn setMemberOfValue(prog: &Prog, ov: JSValue, key: string, v: JSValue, st: &mut Interp): JSValue
```

The three largest arms of evalExprFallback, lifted out of it. Dispatch is
unchanged; the FRAME is the point. A function reserves the sum of every arm's
locals, so the biggest arms set the entry price every OTHER node routed through
the fallback pays. These three were chosen because the front dispatcher already
handles Bin directly and Un/New are not on any hot path, so none of them gains
a call it did not already make. ObjLit and SetMember were tried here too and
REVERTED: both are reached only through the fallback, so extracting them added
a real call to a hot node and cost 3-5% on objChurn for no further depth.

Effect: fallback frame 9264 -> ~2.9 KB, and max nested-expression depth roughly
triples (see docs/backlog.md).
The value-level half of a property WRITE: everything after the object, key and
value have been evaluated. Split out of the Expr.SetMember arm for the same
reason as memberOfValue and evalBinValues — the bytecode VM must hit the
Buffer/typed-array fast paths and the setter rules, not a second copy of them.

### `setProtoOf`

```milo
pub fn setProtoOf(prog: &Prog, st: &mut Interp, v: &JSValue, proto: &JSValue): bool
```

_Undocumented._

### `settlePromise`

```milo
pub fn settlePromise(st: &mut Interp, p: i64, state: i64, value: JSValue)
```

_Undocumented._

### `staticArityData`

```milo
pub fn staticArityData(): string
```

The table, embedded at compile time. A fn rather than a global because a
global string needs an initializer that runs, and the embeddable library is
built with --no-entry (same reason src/engine/uniprops.milo spells its data upData()).

### `symbolDisplay`

```milo
pub fn symbolDisplay(s: &string): string
```

What a symbol shows as: Symbol(desc). Without this the internal representation
leaks out of String(sym) and sym.toString().

### `symIteratorKey`

```milo
pub fn symIteratorKey(): string
```

_Undocumented._

### `symToPrimitiveKey`

```milo
pub fn symToPrimitiveKey(): string
```

_Undocumented._

### `symToStringTagKey`

```milo
pub fn symToStringTagKey(): string
```

_Undocumented._

### `taCurrentLen`

```milo
pub fn taCurrentLen(st: &Interp, o: i64): i64
```

_Undocumented._

### `taElem`

```milo
pub fn taElem(st: &Interp, view: i64, i: i64): f64
```

_Undocumented._

### `taElemValue`

```milo
pub fn taElemValue(st: &Interp, view: i64, i: i64): JSValue
```

The element as a JSValue. A BigInt-kind view yields JSValue.BigInt, and its
elements cannot go through the f64 path at all: the range runs to 2^64 and f64
loses integers past 2^53, so a round trip through a double would silently
corrupt the top bits.

### `taIsDetached`

```milo
pub fn taIsDetached(st: &Interp, o: i64): bool
```

new <T>Array(n | buffer | array) — allocates its own buffer except when handed
an existing ArrayBuffer, which it views in place (mutations are shared).
A view whose backing buffer has been detached (ArrayBuffer.prototype.transfer,
or the test262 host hook). The spec makes such a view behave as a zero-length
one for length/byteLength/byteOffset, undefined for every index, and a
TypeError from every %TypedArray%.prototype method.

### `taOutOfBounds`

```milo
pub fn taOutOfBounds(st: &Interp, o: i64): bool
```

A fixed-length view whose window no longer fits its buffer. Only a RESIZABLE
buffer can shrink under a view, and the spec then treats the view as out of
bounds: its length reads 0, its elements read undefined, and every prototype
method throws (ValidateTypedArray). A tracking view is never out of bounds by
length — it just gets shorter — but its OFFSET can fall off the end.

### `taSetElem`

```milo
pub fn taSetElem(st: &mut Interp, view: i64, i: i64, v: f64)
```

_Undocumented._

### `timeClip`

```milo
pub fn timeClip(t: f64): f64
```

The spec's TimeClip. A time value outside +/-8.64e15 ms (about 273790 years
either side of the epoch) is not representable as a Date and becomes NaN, and
so does a non-finite one. milojs had no clamp anywhere, so `new Date(9e15)`,
`Date.UTC(275760, 8, 14)` and `d.setFullYear(400000)` all produced a Date that
answers out-of-range milliseconds instead of Invalid Date.

### `toNumArg`

```milo
pub fn toNumArg(prog: &Prog, v: &JSValue, st: &mut Interp): f64
```

ToNumber for an ARGUMENT position, where a symbol is a TypeError rather than
NaN. toNumProg cannot do this for every caller: loose equality reaches it too,
and `Symbol() == 1` is false rather than an exception.

### `toNumProg`

```milo
pub fn toNumProg(prog: &Prog, v: &JSValue, st: &mut Interp): f64
```

ToNumber for the paths that DO have a Prog, so a user-defined valueOf is
honoured. The mirror of toStrProg.

### `toStrProg`

```milo
pub fn toStrProg(prog: &Prog, v: &JSValue, st: &mut Interp): string
```

ToString for the paths that DO have a Prog, so a user-defined toString is
honoured. `toStr` alone cannot call back into the interpreter and answers
"[object Object]" for any plain object.

### `typedArrayProtoFor`

```milo
pub fn typedArrayProtoFor(st: &mut Interp, kind: i64): i64
```

_Undocumented._

### `utcFromLocalSec`

```milo
pub fn utcFromLocalSec(localAsUtcSec: i64): i64
```

The inverse: given local wall-clock fields already folded into a would-be UTC
instant, find the real UTC instant. The offset depends on the instant, which is
what makes this circular, so it is resolved the standard way: guess with the
offset at the naive value, then re-read the offset at the guess. A second pass
is enough everywhere except inside a DST transition, where the spec allows
either side.

### `valueIsArrayLike`

```milo
pub fn valueIsArrayLike(st: &Interp, v: &JSValue): bool
```

IsArray per the spec: a Proxy is an array when its TARGET is, following the
chain through nested proxies. Reading `isArray` off the proxy object itself
answered false for every proxied array, which is not a cosmetic difference:
Array.isArray, JSON.stringify's array form, join/toString and concat's
spreadable check all branch on it, so `[...new Proxy([1,2,3], {})]` and
`JSON.stringify(proxiedArray)` produced object-shaped results.

### `valueIsConstructor`

```milo
pub fn valueIsConstructor(prog: &Prog, st: &Interp, v: &JSValue): bool
```

Is `new v()` allowed? Callable and constructable are different: arrows,
methods, generators, async functions and every built-in that is a plain
method (Math.sqrt, Array.prototype.map) can be called but not constructed.
Mirrors the arms of the `new` evaluation below, which is what makes the two
agree.
