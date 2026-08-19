## runtime/complete

### `cmplCommonPrefix`

```milo
pub fn cmplCommonPrefix(cands: &Vec<string>): string
```

Longest byte prefix shared by every candidate — what tab expands to when the
match isn't unique.

### `cmplIsIdentByte`

```milo
pub fn cmplIsIdentByte(b: u8): bool
```

_Undocumented._

### `cmplSlice`

```milo
pub fn cmplSlice(s: &string, from: i64, to: i64): string
```

_Undocumented._

### `completeAt`

```milo
pub fn completeAt(st: &Interp, line: &string, out: &mut Vec<string>, kinds: &mut Vec<i64>, builtinCount: i64): i64
```

Fill `out` with sorted candidates for the word ending at the end of `line`, and
return the byte offset where that word starts (so the caller knows how much of
the line a chosen candidate replaces).
