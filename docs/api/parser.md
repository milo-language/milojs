## parser

### `advance`

```milo
fn advance(p: &mut PState)
```

_Undocumented._

### `atStatementEnd`

```milo
fn atStatementEnd(p: &PState): bool
```

Is the parser at a point where a statement may legally end? JS accepts an
explicit `;`, the `}` closing the enclosing block, end of input, or a line
break before the next token (automatic semicolon insertion). Anything else
means the statement ran into a token that does not belong to it.

### `compoundOp`

```milo
fn compoundOp(k: i32): string
```

_Undocumented._

### `declsToStmt`

```milo
fn declsToStmt(prog: &mut Prog, items: Vec<DeclItem>): i64
```

Wrap desugared declarators into one statement.

### `expect`

```milo
fn expect(p: &mut PState, kind: i32)
```

Consume `kind` if present; parser is forgiving (bad input still terminates).
Only the first mismatch of a parse is reported: with no error recovery, every
later `expect` is reacting to the same original mistake.

### `expectStatementEnd`

```milo
fn expectStatementEnd(p: &mut PState)
```

Report a token that has no business continuing the current statement.

### `exportAssign`

```milo
fn exportAssign(prog: &mut Prog, name: string, local: string): i64
```

`exports.name = local` as a statement — the desugaring target for every
`export` form.

### `inferFuncName`

```milo
fn inferFuncName(prog: &mut Prog, initIdx: i64, name: &string)
```

function [name] ( params ) { body } — returns index into prog.funcs
JS NamedEvaluation: `const f = () => {}` gives the arrow the name "f". The
binding name is known statically, so set it on the anonymous FuncDef at parse
time — no per-instance runtime name slot needed. Only anonymous functions are
affected; a named function expression keeps its own name.

### `isPatternStart`

```milo
fn isPatternStart(p: &PState): bool
```

_Undocumented._

### `isPropName`

```milo
fn isPropName(p: &PState): bool
```

Can the current token serve as a property name? Identifiers and any keyword
(obj.catch / obj.default / obj.function are all legal JS), but not literals.

### `isSyntheticTemp`

```milo
fn isSyntheticTemp(name: &string): bool
```

Destructuring lowers to a hidden temp plus one declarator per bound name
(`__d12`, `__a3`, `__f7`). Those temps are declarators like any other, so
`export const { a, b } = obj` would otherwise export them alongside a and b.

### `looksLikeArrow`

```milo
fn looksLikeArrow(p: &PState): bool
```

Try to read `( id, id, ... ) =>` starting at a '('. On success, consumes
through `=>` and returns true with params in `out`. On failure, restores the
position so the caller can parse a normal parenthesized expression.

### `makeArrow`

```milo
fn makeArrow(p: &mut PState, prog: &mut Prog, params: Vec<string>, isAsync: bool, prelude: Vec<DeclItem>, mkRestFrom: i64): i64
```

Build an arrow function from its parameter list; the caller has consumed `=>`.
Body is a block `{ }` or a single expression (implicit return). isArrow=true so
it doesn't bind its own `this`.

### `parseAdd`

```milo
fn parseAdd(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseAnd`

```milo
fn parseAnd(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseArg`

```milo
fn parseArg(p: &mut PState, prog: &mut Prog): i64
```

One call-argument or array element, possibly a `...spread`.

### `parseArrayLiteral`

```milo
fn parseArrayLiteral(p: &mut PState, prog: &mut Prog): i64
```

[ expr, expr, ... ] — element expressions, trailing comma tolerated

### `parseArrowHead`

```milo
fn parseArrowHead(p: &mut PState, prog: &mut Prog, params: &mut Vec<string>, prelude: &mut Vec<DeclItem>): i64
```

Consume `( params ) =>`, which looksLikeArrow has already confirmed.

### `parseBitAnd`

```milo
fn parseBitAnd(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseBitOr`

```milo
fn parseBitOr(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseBitXor`

```milo
fn parseBitXor(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseBraceBlock`

```milo
fn parseBraceBlock(p: &mut PState, prog: &mut Prog): i64
```

{ stmt* } — returns index into prog.blocks

### `parseClass`

```milo
fn parseClass(p: &mut PState, prog: &mut Prog): i64
```

class Name [extends Base] { [static] [async] name(params) { body } ... }
Class fields and getters are not supported; a getter parses as a method.

### `parseCommaSeq`

```milo
fn parseCommaSeq(p: &mut PState, prog: &mut Prog): i64
```

`a = 1, b = 2` in a for-init or for-update. parseExpr deliberately stops at a
comma (declarator lists need that), so sequences are stitched up here.

### `parseEq`

```milo
fn parseEq(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseExport`

```milo
fn parseExport(p: &mut PState, prog: &mut Prog, list: &mut Vec<i64>)
```

ESM `export` is only legal at the top level, so it is handled here rather than
in parseStmt: the declaration is parsed normally and the matching
`exports.x = x` statements are appended to the same statement list. Bindings
are therefore snapshots, not ESM live bindings — see docs/milojs-quickjs-plan.md.

### `parseExpr`

```milo
fn parseExpr(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseFunction`

```milo
fn parseFunction(p: &mut PState, prog: &mut Prog, isAsync: bool): i64
```

_Undocumented._

### `parseImport`

```milo
fn parseImport(p: &mut PState, prog: &mut Prog): i64
```

ESM `import` desugared onto the CommonJS loader:

  import { a, b as c } from "m"   →   const __esm_N = require("m"),
                                            a = __esm_N.a, c = __esm_N.b
  import * as ns from "m"         →   const ns = require("m")
  import "m"                      →   const __esm_N = require("m")

One MultiDecl covers every form, which keeps this a single statement and so
avoids threading extra statements out of parseStmt. Default imports are not
used by the QuickJS suite and are not supported.

### `parseMul`

```milo
fn parseMul(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseNew`

```milo
fn parseNew(p: &mut PState, prog: &mut Prog): i64
```

new Ctor(args) — the constructor may be a member chain (new a.b.C()). The arg
list is parsed here; a following postfix chain (new C().x) is left to the caller.

### `parseObjectLiteral`

```milo
fn parseObjectLiteral(p: &mut PState, prog: &mut Prog): i64
```

{ key: expr, key: expr, ... } — keys are identifiers or string literals

### `parseOr`

```milo
fn parseOr(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseParam`

```milo
fn parseParam(p: &mut PState, prog: &mut Prog, params: &mut Vec<string>, prelude: &mut Vec<DeclItem>): bool
```

Parse one parameter. A destructuring pattern becomes a synthetic parameter
name plus declarators that unpack it at the top of the body.

### `parsePostfix`

```milo
fn parsePostfix(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parsePrimary`

```milo
fn parsePrimary(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseProgram`

```milo
pub fn parseProgram(p: &mut PState, prog: &mut Prog): BlockId
```

_Undocumented._

### `parseRel`

```milo
fn parseRel(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseShift`

```milo
fn parseShift(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseStmt`

```milo
fn parseStmt(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `parseTaggedTemplate`

```milo
fn parseTaggedTemplate(p: &mut PState, prog: &mut Prog, tagExpr: i64): i64
```

`tag`a${x}b`` calls tag(["a","b"], x). The strings array is built as an array
literal and the hole expressions become the remaining arguments; there is no
separate .raw, which nothing in the target reads.

### `parseTemplate`

```milo
fn parseTemplate(p: &mut PState, prog: &mut Prog): i64
```

A template literal desugars to string concatenation, starting from a string
chunk so the whole chain coerces to string: `a${x}b` → "a" + x + "b".

### `parseTernary`

```milo
fn parseTernary(p: &mut PState, prog: &mut Prog): i64
```

c ? a : b — sits between the logical operators and assignment

### `parseUnary`

```milo
fn parseUnary(p: &mut PState, prog: &mut Prog): i64
```

_Undocumented._

### `patternDecls`

```milo
fn patternDecls(p: &mut PState, prog: &mut Prog, srcName: string, out: &mut Vec<DeclItem>)
```

Destructuring is desugared at parse time into a flat list of declarators that
read out of `srcName`. Nested patterns bind an intermediate temp and recurse;
the temp name is keyed on token position so it can't collide.

### `peekKind`

```milo
fn peekKind(p: &PState): i32
```

_Undocumented._

### `prependStmt`

```milo
fn prependStmt(prog: &mut Prog, blockIdx: i64, stmtIdx: i64)
```

Put a statement at the front of an already-parsed block (used to unpack
destructured parameters and for-of bindings before the body runs).

### `requireCall`

```milo
fn requireCall(prog: &mut Prog, spec: string): i64
```

require("<spec>") as an expression.

### `tokenContext`

```milo
fn tokenContext(p: &PState): string
```

The offending token with a couple on each side, so an error points at
recognisable source text rather than a bare token index.
A wide window matters more than a line number: the files this fails on are
minified into a few enormous lines, so "line 3" locates nothing. Twelve tokens
either side is usually enough to grep the construct out of the bundle.

### `tokenDesc`

```milo
fn tokenDesc(p: &PState, i: i64): string
```

Human-readable text for a token, for diagnostics.

### `withDefault`

```milo
fn withDefault(prog: &mut Prog, valExpr: i64, dflt: i64): i64
```

`x = <default>` in a pattern: JS only substitutes on undefined. This compares
loosely, so an explicit null also takes the default — a small deviation.
