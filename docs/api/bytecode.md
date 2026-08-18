## bytecode

### `compileFor`

```milo
pub fn compileFor(prog: &Prog, id: StmtId): Option<Chunk>
```

Compile a `for` statement, or answer None when any part of it falls outside
the subset.

### `resetLoopCache`

```milo
pub fn resetLoopCache()
```

Drop every cached chunk. The cache is keyed by an index into the program
arena, so a fresh program reusing those indices would otherwise run another
statement's code.

### `runChunk`

```milo
pub fn runChunk(ch: &Chunk, st: &mut Interp, scope: i64): bool
```

Run a compiled loop. Answers false without touching anything when an outer
name the loop reads is missing or is not a number, in which case the caller
must run the tree walker instead.

### `tryRunFor`

```milo
pub fn tryRunFor(prog: &Prog, id: StmtId, st: &mut Interp, scope: i64): bool
```

Run this `for` through the compiled path, or answer false to say the tree
walker still has to run it. Compilation happens once per statement.
