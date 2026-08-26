## engine/driver

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

### `interpStackBytes`

```milo
pub fn interpStackBytes(): i64
```

Native stack for the task the interpreter runs on. A JS frame costs ~7 KB of
tree-walker native stack, so the stack size decides where deep recursion dies:
below the 10k callDepthLimit backstop it is the byte-measured headroom guard
that fires, and that cutoff moves with every compiler's frame-size noise and
differs per arch (x86_64 frames run ~8% fatter than arm64, which is exactly
the historical darwin/linux gap in the package-suite numbers). 128 MB puts the
frame-count backstop first on every path (~10k frames * ~7 KB, with margin),
so recursion depth is exact and identical across platforms.

darwin cannot have that yet: Apple's makecontext writes through the whole
mapping (a 20-line C repro peaks at 135 MB for a do-nothing context on a
128 MB stack), so a big stack costs its full size in dirty pages per process.
glibc faults lazily (same repro: 1 MB). Until milo's scheduler replaces the
system ucontext on darwin, darwin keeps the 16 MB compromise: ~2.3k usable
frames, enough for the corpus tests short of the backstop.

### `makeInterp`

```milo
pub fn makeInterp(gcStats: bool, gcThreshold: i64, gcGrowth: i64): Interp
```

_Undocumented._
