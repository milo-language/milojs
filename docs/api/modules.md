## modules

### `builtinNameOf`

```milo
fn builtinNameOf(path: &string): string
```

_Undocumented._

### `builtinSource`

```milo
fn builtinSource(name: &string): string
```

_Undocumented._

### `dirOf`

```milo
pub fn dirOf(path: &string): string
```

Directory portion of a path ("" when there is no separator).

### `endsWithJs`

```milo
fn endsWithJs(p: &string): bool
```

A CommonJS source file: .js or .cjs. Packages that ship both ESM and CJS name
the CommonJS entry .cjs, and their package.json "main" points at it.

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

### `hasJsonExt`

```milo
fn hasJsonExt(path: &string): bool
```

_Undocumented._

### `isBuiltinPath`

```milo
fn isBuiltinPath(path: &string): bool
```

_Undocumented._

### `normalizePath`

```milo
fn normalizePath(path: &string): string
```

Collapse a path containing "." and ".." segments.

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

### `resolveAsFileOrDir`

```milo
fn resolveAsFileOrDir(base: &string): string
```

Node's file/directory resolution: exact file, then +.js, then the directory's
package.json "main", then index.js.

### `resolveBare`

```milo
fn resolveBare(dir: &string, spec: &string): string
```

A bare specifier (an npm package): walk up from `dir` looking in node_modules.

### `resolveSpec`

```milo
pub fn resolveSpec(dir: &string, spec: &string): string
```

Resolve a require specifier against the requiring module's directory.
Relative specifiers resolve as files/directories; bare names walk node_modules.

### `scanPkgMain`

```milo
fn scanPkgMain(txt: &string): string
```

Pull the "main" field out of a package.json without a full JSON parse (this
runs during pre-load, before any interpreter state exists).

### `scanRequires`

```milo
fn scanRequires(toks: &Vec<Token>): Vec<string>
```

Find every `require("literal")` in a token stream.

### `stripNodePrefix`

```milo
fn stripNodePrefix(spec: &string): string
```

Node builtin modules, written in JS and embedded at compile time so the
runtime is a single self-contained binary. Registered under "builtin:<name>".
Strip a "node:" prefix if present.
