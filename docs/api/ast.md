## ast

### `addBlock`

```milo
pub fn addBlock(prog: &mut Prog, statements: Vec<StmtId>): BlockId
```

Append a statement list and publish its typed block ID.

### `addExpr`

```milo
pub fn addExpr(prog: &mut Prog, e: Expr): ExprId
```

_Undocumented._

### `addStmt`

```milo
pub fn addStmt(prog: &mut Prog, s: Stmt): StmtId
```

_Undocumented._

### `getExpr`

```milo
pub fn getExpr(prog: &Prog, id: ExprId): Expr
```

_Undocumented._

### `getStmt`

```milo
pub fn getStmt(prog: &Prog, id: StmtId): Stmt
```

_Undocumented._

### `newProg`

```milo
pub fn newProg(): Prog
```

Create an empty program arena.
