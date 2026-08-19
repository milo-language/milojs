## engine/bytecode

### `bodyChunkOf`

```milo
pub fn bodyChunkOf(prog: &Prog, fIdx: i64): i64
```

The chunk index for this function's body, or -1 if its body does not compile.
Compilation happens once per function, and the answer is cached either way.
This is also the single point MILOJS_NO_BYTECODE turns the VM off at: with no
chunk index there is no frame for the evaluator to enter and none for the VM's
own Op.Call to enter either.

### `chunkUsesArguments`

```milo
pub fn chunkUsesArguments(cid: i64): bool
```

Does this chunk name `arguments`? The activation an ordinary call builds can
skip materialising one when it does not.

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
pub fn runChunk(prog: &Prog, cid: i64, st: &mut Interp, scope: i64): Option<JSValue>
```

Run a compiled chunk, and every compiled chunk it calls, in ONE dispatch loop.
Answers None when the chunk cannot run and the caller must fall back to the
tree walker; that decision is made before any side effect. Otherwise answers
the value the body returned, or Undefined for a loop chunk and for a body that
fell off its end.

### `tryRunFor`

```milo
pub fn tryRunFor(prog: &Prog, id: StmtId, st: &mut Interp, scope: i64): bool
```

Run this `for` through the compiled path, or answer false to say the tree
walker still has to run it. Compilation happens once per statement.
