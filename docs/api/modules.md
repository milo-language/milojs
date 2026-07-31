## modules

### `dirOf`

```milo
pub fn dirOf(path: &string): string
```

Directory portion of a path ("" when there is no separator).

### `fileExists`

```milo
pub fn fileExists(p: &string): bool
```

_Undocumented._

### `findModule`

```milo
pub fn findModule(st: &Interp, path: &string): i64
```

_Undocumented._

### `hasEsmSyntax`

```milo
pub fn hasEsmSyntax(toks: &Vec<Token>): bool
```

Does this token stream use ESM syntax? Only the `import`/`export` STATEMENT
forms make a file a module; dynamic `import()` is an ordinary expression and
is legal in a plain script.

### `preloadGraph`

```milo
pub fn preloadGraph(entryPath: string, prog: &mut Prog, st: &mut Interp): i64
```

Parse `path` (and everything it requires, transitively) into `prog`, filling
the interpreter's module registry. Returns the entry module's registry index,
or -1 if the entry could not be read.

### `reportUnresolved`

```milo
pub fn reportUnresolved(st: &mut Interp, spec: &string)
```

Each missing module is reported once; a package required from twenty places
otherwise produces twenty identical lines and buries the real failure.

### `resolveSpec`

```milo
pub fn resolveSpec(dir: &string, spec: &string): string
```

Resolve a require specifier against the requiring module's directory.
Relative specifiers resolve as files/directories; bare names walk node_modules.
