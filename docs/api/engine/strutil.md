## engine/strutil

### `clampIndex`

```milo
pub fn clampIndex(idx: i64, len: i64): i64
```

Normalize a possibly-negative slice index to [0, len], JS-style. The postcondition is the
safety contract every caller relies on: the returned index is always in bounds for a
buffer of `len`, so `s[clampIndex(..)]` up to (not including) `len` can never read OOB.

### `jsEndsWith`

```milo
pub fn jsEndsWith(s: &string, sub: &string): bool
```

_Undocumented._

### `jsIndexOf`

```milo
pub fn jsIndexOf(s: &string, sub: &string, start: i64): i64
```

First index of `sub` in `s` at or after `start`, or -1. (`from` is a reserved keyword.)

### `jsStartsWith`

```milo
pub fn jsStartsWith(s: &string, sub: &string): bool
```

_Undocumented._

### `strSlice`

```milo
pub fn strSlice(s: &string, start: i64, end: i64): string
```

_Undocumented._
