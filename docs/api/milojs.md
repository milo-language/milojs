## milojs

### `addEnvVar`

```milo
fn addEnvVar(st: &mut Interp, envObj: i64, name: string)
```

_Undocumented._

### `loadEnvFile`

```milo
fn loadEnvFile(st: &mut Interp, envPath: &string)
```

KEY=VALUE lines from a file into process.env, matching node's --env-file.
Blank lines and # comments are skipped; surrounding quotes are stripped.

### `main`

```milo
fn main(): i32
```

_Undocumented._

### `setupNodeGlobals`

```milo
fn setupNodeGlobals(st: &mut Interp, entryPath: string)
```

Install the Node-style globals a program reaches for before any user code runs.
