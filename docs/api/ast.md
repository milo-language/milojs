## ast

### `newProg`

```milo
pub fn newProg(): Prog
```

Create an empty program arena.

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

### `cloneExpr`

```milo
fn cloneExpr(e: &Expr): Expr
```

_Undocumented._

### `cloneStmt`

```milo
fn cloneStmt(s: &Stmt): Stmt
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
