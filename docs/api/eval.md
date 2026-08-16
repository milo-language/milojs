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
pub fn callNativeProg(prog: &Prog, id: i64, argVals: &Vec<JSValue>, st: &mut Interp): JSValue
```

Native dispatch for the call sites that hold a Prog. callNative itself does
not, so any native whose answer depends on re-entering user code has to be
intercepted here — otherwise `String(obj)` reports "[object Object]" for an
object whose toString says otherwise, while `${obj}` and `"" + obj` (both of
which run the full ToPrimitive) disagree with it.

### `evalExpr`

```milo
pub fn evalExpr(prog: &Prog, id: ExprId, st: &mut Interp, scope: i64): JSValue
```

Hot recursive nodes bypass the full dispatcher. The fallback contains large
await/literal/construction arms whose locals otherwise reserve stack space on
every simple call, even when those arms are not selected.

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

### `hoistBlock`

```milo
pub fn hoistBlock(prog: &Prog, blockId: BlockId, st: &mut Interp, scope: i64)
```

Bind `var` declarations and function declarations for a whole function body
before it runs. JS hoists both to the function scope through arbitrary
nesting, so this walks into blocks, loops, if/else, switch and try — unlike
let/const, which stay in the block they are written in.

### `inspectTop`

```milo
pub fn inspectTop(st: &Interp, v: &JSValue): string
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

### `nativeSourceText`

```milo
pub fn nativeSourceText(st: &mut Interp, nid: i64): string
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

### `parkOnPromise`

```milo
pub fn parkOnPromise(st: &mut Interp, p: i64): bool
```

_Undocumented._

### `resumeExecCtx`

```milo
pub fn resumeExecCtx(st: &mut Interp, task: *u8)
```

Take back the execution belonging to `task`, wherever it sits in the parked
set. Parks and wakes interleave, so position says nothing about ownership.

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
