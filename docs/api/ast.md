## ast

### `addArgList`

```milo
pub fn addArgList(prog: &mut Prog, arguments: Vec<ExprId>): ArgListId
```

Append an argument list and publish its typed ID.

### `addArrLit`

```milo
pub fn addArrLit(prog: &mut Prog, elements: Vec<Option<ExprId>>): ArrLitId
```

Append an array/template-literal descriptor list and publish its typed ID.

### `addBlock`

```milo
pub fn addBlock(prog: &mut Prog, statements: Vec<StmtId>): BlockId
```

Append a statement list and publish its typed block ID.

### `addDeclList`

```milo
pub fn addDeclList(prog: &mut Prog, declarations: Vec<DeclItem>): DeclListId
```

Append a declaration descriptor list and publish its typed ID.

### `addExpr`

```milo
pub fn addExpr(prog: &mut Prog, e: Expr): ExprId
```

_Undocumented._

### `addObjLit`

```milo
pub fn addObjLit(prog: &mut Prog, properties: Vec<PropInit>): ObjLitId
```

Append an object-literal descriptor list and publish its typed ID.

### `addStmt`

```milo
pub fn addStmt(prog: &mut Prog, s: Stmt): StmtId
```

_Undocumented._

### `addSwitch`

```milo
pub fn addSwitch(prog: &mut Prog, cases: Vec<SwitchCase>): SwitchId
```

Append a switch-case descriptor list and publish its typed ID.

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
