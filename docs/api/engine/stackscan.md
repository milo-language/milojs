## engine/stackscan

### `gcSkipTempRoots`

```milo
pub fn gcSkipTempRoots(): bool
```

_Undocumented._

### `scanStacks`

```milo
pub fn scanStacks(st: &mut Interp)
```

The scan itself. `regs` receives the callee-saved registers (_setjmp), so a value the caller
of collect() keeps only in a register is in this frame when the running stack is read.

### `stackscanInit`

```milo
pub fn stackscanInit(skipTempRoots: bool, noScan: bool, mainLocal: i64)
```

Call once from each entry point's main, before any collection can run. `mainLocal` is the
address of a local in main's frame: only used if the OS stack top cannot be found by name.
