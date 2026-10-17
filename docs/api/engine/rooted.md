## engine/rooted

### `rootedAt`

```milo
pub fn rootedAt(r: i64, j: i64): JSValue
```

_Undocumented._

### `rootedCount`

```milo
pub fn rootedCount(): i64
```

Collector interface: iterate every live RootedVec.

### `rootedLen`

```milo
pub fn rootedLen(r: i64): i64
```

_Undocumented._

### `RootedVec.clear`

```milo
fn RootedVec.clear(self: &mut RootedVec)
```

_Undocumented._

### `RootedVec.clone`

```milo
fn RootedVec.clone(self: &RootedVec): RootedVec
```

A new, separately registered RootedVec with cloned elements.

### `RootedVec.cloneToVec`

```milo
fn RootedVec.cloneToVec(self: &RootedVec): Vec<JSValue>
```

Escape hatch: an unrooted plain copy, this one stays intact.

### `RootedVec.fromClone`

```milo
fn RootedVec.fromClone(v: &Vec<JSValue>): RootedVec
```

A registered copy of a borrowed plain Vec. For eval.milo call sites that still hold their
arguments in a Vec<JSValue> (the originals stay with the caller); batch 2 deletes them.

### `RootedVec.fromVec`

```milo
fn RootedVec.fromVec(v: Vec<JSValue>): RootedVec
```

Takes ownership of a plain Vec. Values in it must be kept alive by the caller until this returns.

### `RootedVec.get`

```milo
fn RootedVec.get(self: &RootedVec, i: i64): JSValue
```

An owned copy of element i (traps when out of range, like Vec indexing).

### `RootedVec.len`

```milo
fn RootedVec.len(self: &RootedVec): i64
```

_Undocumented._

### `RootedVec.new`

```milo
fn RootedVec.new(): RootedVec
```

_Undocumented._

### `RootedVec.pop`

```milo
fn RootedVec.pop(self: &mut RootedVec): JSValue?
```

_Undocumented._

### `RootedVec.push`

```milo
fn RootedVec.push(self: &mut RootedVec, v: JSValue)
```

_Undocumented._

### `RootedVec.set`

```milo
fn RootedVec.set(self: &mut RootedVec, i: i64, v: JSValue)
```

_Undocumented._

### `RootedVec.toVec`

```milo
fn RootedVec.toVec(self: &mut RootedVec): Vec<JSValue>
```

Escape hatch: moves the elements out as a plain Vec and leaves this one empty.

### `RootedVec.withCapacity`

```milo
fn RootedVec.withCapacity(n: i64): RootedVec
```

_Undocumented._

### `RootedVec.withItems`

```milo
fn RootedVec.withItems(items: Vec<JSValue>): RootedVec
```

_Undocumented._
