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

### `saveRealm`

```milo
pub fn saveRealm(st: &mut Interp)
```

Write the running realm's cached intrinsics back into its Realm record.
