## complete

### `cmplAdd`

```milo
fn cmplAdd(out: &mut Vec<string>, kinds: &mut Vec<i64>, name: &string, prefix: &string, kind: i64)
```

push if it matches the prefix and isn't already present — property lookup walks
a proto chain, so a shadowed key would otherwise appear twice

### `cmplAddAll`

```milo
fn cmplAddAll(out: &mut Vec<string>, kinds: &mut Vec<i64>, names: &string, prefix: &string, kind: i64)
```

_Undocumented._

### `cmplArrayMethods`

```milo
fn cmplArrayMethods(): string
```

_Undocumented._

### `cmplCommonPrefix`

```milo
pub fn cmplCommonPrefix(cands: &Vec<string>): string
```

Longest byte prefix shared by every candidate — what tab expands to when the
match isn't unique.

### `cmplConsoleMethods`

```milo
fn cmplConsoleMethods(): string
```

_Undocumented._

### `cmplContains`

```milo
fn cmplContains(v: &Vec<string>, s: &string): bool
```

_Undocumented._

### `cmplFunctionMethods`

```milo
fn cmplFunctionMethods(): string
```

Every function value carries these regardless of what it is.

### `cmplGlobals`

```milo
fn cmplGlobals(st: &Interp, prefix: &string, out: &mut Vec<string>, kinds: &mut Vec<i64>, builtinCount: i64)
```

Bindings past `builtinCount` were defined by this session — setupGlobals only
ever appends, so the boundary index taken at REPL start stays valid.

### `cmplIsIdentByte`

```milo
pub fn cmplIsIdentByte(b: u8): bool
```

_Undocumented._

### `cmplKeywords`

```milo
fn cmplKeywords(): string
```

_Undocumented._

### `cmplLess`

```milo
fn cmplLess(a: &string, b: &string): bool
```

_Undocumented._

### `cmplMembers`

```milo
fn cmplMembers(st: &Interp, base: &string, prefix: &string, out: &mut Vec<string>, kinds: &mut Vec<i64>)
```

_Undocumented._

### `cmplObjectProps`

```milo
fn cmplObjectProps(st: &Interp, o: i64, prefix: &string, out: &mut Vec<string>, kinds: &mut Vec<i64>)
```

_Undocumented._

### `cmplPseudoGlobals`

```milo
fn cmplPseudoGlobals(): string
```

`console` and `require` are recognised by name at the call site in eval.milo
rather than being scope bindings, so they never show up in a scope walk —
completion has to know about them explicitly.

### `cmplResolveBase`

```milo
fn cmplResolveBase(st: &Interp, base: &string): JSValue
```

Resolve a dotted base like `foo.bar` by reading bindings/properties only.
Returns Undefined when any hop is missing or non-object.

### `cmplSlice`

```milo
pub fn cmplSlice(s: &string, from: i64, to: i64): string
```

_Undocumented._

### `cmplSort`

```milo
fn cmplSort(v: &mut Vec<string>, kinds: &mut Vec<i64>)
```

Sort by (kind, name) so each kind lands in one contiguous run the printer can
break into a group. Insertion sort: candidate lists are small and already
near-sorted (props come out in definition order).

### `cmplStartsWith`

```milo
fn cmplStartsWith(s: &string, pre: &string): bool
```

_Undocumented._

### `cmplStringMethods`

```milo
fn cmplStringMethods(): string
```

Kept in sync by hand with builtins.milo's stringMethod / eval.milo's
isArrayMethod — those dispatch on a name rather than holding a table, so
there's nothing to enumerate at runtime.

### `completeAt`

```milo
pub fn completeAt(st: &Interp, line: &string, out: &mut Vec<string>, kinds: &mut Vec<i64>, builtinCount: i64): i64
```

Fill `out` with sorted candidates for the word ending at the end of `line`, and
return the byte offset where that word starts (so the caller knows how much of
the line a chosen candidate replaces).
