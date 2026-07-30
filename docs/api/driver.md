## driver

### `bootInterp`

```milo
pub fn bootInterp(st: &mut Interp)
```

scope 0 = global (never collected — always a GC root), then install builtins

### `describeThrown`

```milo
pub fn describeThrown(st: &Interp, v: &JSValue): string
```

gcThreshold is the allocation count that triggers a collection. Lowering it to
1 collects at every safepoint, which is how GC-rooting bugs are shaken out —
see MILOJS_GC_THRESHOLD.
An Error object stringifies as [object Object], which says nothing about what
went wrong. Report name and message when the thrown value is an error.

### `evalSourceValue`

```milo
pub fn evalSourceValue(src: &string, prog: &mut Prog, st: &mut Interp): JSValue
```

Evaluate one script into a persistent program and return its completion value.
Unlike the CLI path, this never prints an uncaught exception: callers inspect
st.throwing/st.thrownValue. Keeping `prog` alive is required because functions
retain indices into its arenas after evaluation returns.

### `makeInterp`

```milo
pub fn makeInterp(gcStats: bool, gcThreshold: i64, gcGrowth: i64): Interp
```

_Undocumented._
