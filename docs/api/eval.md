## eval

### `anyGenParked`

```milo
pub fn anyGenParked(st: &Interp): bool
```

True if any generator has been started but not run to completion, so its body
task is parked forever. Such a task keeps the scheduler's task count > 0, which
would block main's final -1 poll and hang the process at exit — Node instead
drops an unfinished generator, so the entry point exits directly when this holds.

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
