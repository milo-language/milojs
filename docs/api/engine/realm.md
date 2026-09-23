## engine/realm

### `addRealm`

```milo
pub fn addRealm(st: &mut Interp, globalScope: i64): i64
```

Register a new, empty realm whose global scope is `globalScope`, and answer
its index. Does not enter it.

### `bootFirstRealm`

```milo
pub fn bootFirstRealm(st: &mut Interp, globalScope: i64)
```

The first realm, the one every binary boots into.

### `calleeRealm`

```milo
pub fn calleeRealm(st: &Interp, v: &JSValue): i64
```

The [[Realm]] of a callable: the realm its function object was allocated in,
which a call has to enter. -1 for anything that is not a function object.

### `createRealm`

```milo
pub fn createRealm(prog: &Prog, st: &mut Interp): i64
```

A new realm: its own global scope and global object, every built-in installed
by the same bootstrap the first realm ran, then the same JS-written built-ins.
Answers the realm's index, or -1 with the exception pending. The running realm
is unchanged on return.

### `emptyRealm`

```milo
pub fn emptyRealm(globalScope: i64): Realm
```

A realm that has not been booted yet: no intrinsics, every fast-path guard
down until setupGlobals raises it. Object.prototype's guard starts UP because
the object it guards starts with no non-writable data property at all.

### `enterRealm`

```milo
pub fn enterRealm(st: &mut Interp, r: i64): i64
```

Make realm r the running one and answer the realm that was running, for the
caller to hand back to enterRealm when it is done. Entering the running realm
costs one compare.

### `globalScopeOfObj`

```milo
pub fn globalScopeOfObj(st: &Interp, o: i64): i64
```

The global scope a global object mirrors: its own realm's. A realm's global
object may be read from code running in another realm, and must still answer
with its own bindings.

### `isArrayCtorObj`

```milo
pub fn isArrayCtorObj(st: &Interp, o: i64): bool
```

Is `o` some realm's %Array% (or %Promise%)? These two constructors are plain
objects rather than natives, so call and construct recognise them by
identity, and a cross-realm call must still find them.

### `isPromiseCtorObj`

```milo
pub fn isPromiseCtorObj(st: &Interp, o: i64): bool
```

_Undocumented._

### `objRealm`

```milo
pub fn objRealm(st: &Interp, o: i64): i64
```

The realm object `o` was allocated in.

### `realmArrayProto`

```milo
pub fn realmArrayProto(st: &Interp, r: i64): i64
```

_Undocumented._

### `realmBuiltinGlobals`

```milo
pub fn realmBuiltinGlobals(st: &Interp, r: i64): i64
```

_Undocumented._

### `realmFunctionProto`

```milo
pub fn realmFunctionProto(st: &Interp, r: i64): i64
```

_Undocumented._

### `realmGlobalObject`

```milo
pub fn realmGlobalObject(st: &Interp, r: i64): JSValue
```

Realm r's global object: what its `globalThis` is bound to.

### `realmGlobalScope`

```milo
pub fn realmGlobalScope(st: &Interp, r: i64): i64
```

Realm r's view of an intrinsic. The running realm's live value is the Interp
cache; every other realm's is its saved record, current since it was left.

### `realmObjectProto`

```milo
pub fn realmObjectProto(st: &Interp, r: i64): i64
```

_Undocumented._

### `runRealmPrelude`

```milo
pub fn runRealmPrelude(prog: &Prog, block: BlockId, st: &mut Interp)
```

Run one JS-written built-in block (the engine prelude, Temporal) in the
running realm's global scope, and remember it so createRealm runs it in every
later realm too.

### `saveRealm`

```milo
pub fn saveRealm(st: &mut Interp)
```

Write the running realm's cached intrinsics back into its Realm record.
