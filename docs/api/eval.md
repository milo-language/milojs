## eval

### `anyGenParked`

```milo
pub fn anyGenParked(st: &Interp): bool
```

True if any generator has been started but not run to completion, so its body
task is parked forever. Such a task keeps the scheduler's task count > 0, which
would block main's final -1 poll and hang the process at exit — Node instead
drops an unfinished generator, so the entry point exits directly when this holds.

### `awaitValue`

```milo
pub fn awaitValue(prog: &Prog, va: &JSValue, st: &mut Interp): JSValue
```

`await v`, factored out of the Unary branch so `for await (… of …)` can reuse
it verbatim rather than growing a second, drifting copy of the thenable
unwrapping, the activation park, and the main-task drain.

### `callNativeProg`

```milo
pub fn callNativeProg(prog: &Prog, n: &Native, argVals: &Vec<JSValue>, st: &mut Interp): JSValue
```

Native dispatch for the call sites that hold a Prog. callNative itself does
not, so any native whose answer depends on re-entering user code has to be
intercepted here — otherwise `String(obj)` reports "[object Object]" for an
object whose toString says otherwise, while `${obj}` and `"" + obj` (both of
which run the full ToPrimitive) disagree with it.

### `constructValue`

```milo
pub fn constructValue(prog: &Prog, st: &mut Interp, ctor: &JSValue, argVals: Vec<JSValue>, newTarget: &JSValue): JSValue
```

_Undocumented._

### `definePropOf`

```milo
pub fn definePropOf(prog: &Prog, st: &mut Interp, v: &JSValue, key: &string, d: i64): bool
```

_Undocumented._

### `evalExpr`

```milo
pub fn evalExpr(prog: &Prog, id: ExprId, st: &mut Interp, scope: i64): JSValue
```

_Undocumented._

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

### `isExtensibleOf`

```milo
pub fn isExtensibleOf(prog: &Prog, st: &mut Interp, v: &JSValue): bool
```

_Undocumented._

### `localOffsetSecAt`

```milo
pub fn localOffsetSecAt(epochSec: i64): i64
```

_Undocumented._

### `makeError`

```milo
pub fn makeError(st: &mut Interp, kind: string, msg: string): JSValue
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

### `msFloorSec`

```milo
pub fn msFloorSec(ms: f64): i64
```

Seconds to ADD to a UTC instant to get local wall-clock time at that instant.
Computed by decomposing with the host's localtime and recomposing the fields as
if they were UTC, so it follows the real timezone database including DST: this
machine answers -28800 in winter and -25200 in summer.
Whole seconds of an epoch-millisecond value, rounding toward NEGATIVE infinity
so a pre-epoch fractional value lands in the right second. `(ms / 1000.0) as i64`
truncates toward zero, which is off by one for negative times.

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

### `ownKeysOf`

```milo
pub fn ownKeysOf(prog: &Prog, st: &mut Interp, v: &JSValue): Vec<string>
```

[[OwnPropertyKeys]] over any value, as raw keys — symbols included, in the
"@@sym:" spelling they are stored under. A proxy consults its ownKeys trap
and with no trap forwards to its target, which may itself be a proxy.

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

### `setupGlobals`

```milo
pub fn setupGlobals(st: &mut Interp)
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

### `valueIsConstructor`

```milo
pub fn valueIsConstructor(prog: &Prog, st: &Interp, v: &JSValue): bool
```

Is `new v()` allowed? Callable and constructable are different: arrows,
methods, generators, async functions and every built-in that is a plain
method (Math.sqrt, Array.prototype.map) can be called but not constructed.
Mirrors the arms of the `new` evaluation below, which is what makes the two
agree.
