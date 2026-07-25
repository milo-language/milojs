## milojs-engine

### `main`

```milo
fn main(): i32
```

_Undocumented._

### `preloadWithImports`

```milo
fn preloadWithImports(entryPath: string, prog: &mut Prog, st: &mut Interp): i64
```

Register the entry module and everything it imports, transitively.
preloadGraph already follows require() edges; this walks the ESM ones.

### `scanImports`

```milo
fn scanImports(toks: &Vec<Token>): Vec<string>
```

Specifiers of every `import ... from "spec"` / `import "spec"` in a token
stream. The parser desugars ESM imports to require() calls, but module
discovery runs on tokens *before* parsing — so modules.milo's require scan
cannot see them and this finds them instead.
