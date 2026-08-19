## engine/bytecode

### `compileBody`

```milo
pub fn compileBody(prog: &Prog, fIdx: i64): Option<Chunk>
```

Compile a whole function body, or answer None. Worth far more than the `for`
hook it sits beside: node's test/parallel has 618 loops and 21,617 function
bodies, and the same numeric subset covers 8.6% of the bodies against 1.0% of
the loops.

Generators and async bodies are rejected outright. Their control flow leaves
and re-enters the body, which a chunk that runs to completion cannot express.
So is a paramPrelude, which is the desugaring of destructured and defaulted
parameters and is a statement the caller runs, not part of the body.

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
pub fn runChunk(prog: &Prog, ch: &Chunk, st: &mut Interp, scope: i64): Option<JSValue>
```

Run a compiled loop. Answers false without touching anything when an outer
name the loop reads is missing or is not a number, in which case the caller
must run the tree walker instead.
Answers None when the chunk cannot run and the caller must fall back to the
tree walker; that decision is made before any side effect. Otherwise answers
the value the body returned, or Undefined for a loop chunk and for a body that
fell off its end.

### `tryRunBody`

```milo
pub fn tryRunBody(prog: &Prog, fIdx: i64, st: &mut Interp, scope: i64): Option<JSValue>
```

Run this function body as bytecode, or answer None to say the tree walker
still has to run it. Compilation happens once per function.

### `tryRunFor`

```milo
pub fn tryRunFor(prog: &Prog, id: StmtId, st: &mut Interp, scope: i64): bool
```

Run this `for` through the compiled path, or answer false to say the tree
walker still has to run it. Compilation happens once per statement.
