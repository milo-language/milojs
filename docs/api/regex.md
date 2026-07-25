## regex

### `reAddNode`

```milo
fn reAddNode(p: &mut ReParse, n: ReNode): i64
```

_Undocumented._

### `reAddShorthand`

```milo
fn reAddShorthand(cls: &mut ReClass, kind: u8)
```

Add a shorthand's ranges into a class's lo/hi arrays. `kind`: 'd','w','s'.

### `reCharEq`

```milo
fn reCharEq(a: u8, b: u8, fold: bool): bool
```

_Undocumented._

### `reClassMatch`

```milo
fn reClassMatch(cls: &ReClass, c: u8, fold: bool): bool
```

_Undocumented._

### `reCloneNode`

```milo
fn reCloneNode(n: &ReNode): ReNode
```

_Undocumented._

### `reCompileNode`

```milo
fn reCompileNode(p: &ReParse, idx: i64, prog: &mut Vec<ReInst>)
```

_Undocumented._

### `reEmit`

```milo
fn reEmit(prog: &mut Vec<ReInst>, op: i32, a: i64, b: i64): i64
```

_Undocumented._

### `reEscapedChar`

```milo
fn reEscapedChar(e: u8): u8
```

_Undocumented._

### `regexCompile`

```milo
pub fn regexCompile(source: string, flags: string): Regex
```

_Undocumented._

### `regexExec`

```milo
pub fn regexExec(re: &Regex, s: &string, startPos: i64): Vec<i64>
```

Try to match anywhere at or after `startPos`. Returns a saves vector; saves[0] < 0
(and length 0) means no match. On success, saves has 2*(nGroups+1) entries.

### `reIsDigit`

```milo
fn reIsDigit(c: u8): bool
```

_Undocumented._

### `reIsSpace`

```milo
fn reIsSpace(c: u8): bool
```

_Undocumented._

### `reIsWord`

```milo
fn reIsWord(c: u8): bool
```

_Undocumented._

### `reIsWordAt`

```milo
fn reIsWordAt(s: &string, i: i64): bool
```

_Undocumented._

### `reLowerByte`

```milo
fn reLowerByte(c: u8): u8
```

_Undocumented._

### `reParseAlt`

```milo
fn reParseAlt(p: &mut ReParse): i64
```

_Undocumented._

### `reParseAtom`

```milo
fn reParseAtom(p: &mut ReParse): i64
```

_Undocumented._

### `reParseClass`

```milo
fn reParseClass(p: &mut ReParse): i64
```

Parse a bracketed [ ... ] class starting just after '['.

### `reParseConcat`

```milo
fn reParseConcat(p: &mut ReParse): i64
```

_Undocumented._

### `reParseRepeat`

```milo
fn reParseRepeat(p: &mut ReParse, atom: i64): i64
```

Parse a quantifier suffix on `atom`, if any.

### `reRun`

```milo
fn reRun(re: &Regex, pc: i64, s: &string, sp: i64, saves: &mut Vec<i64>): bool
```

Recursive backtracking. SAVE restores its slot on failure, so SPLIT needs no
snapshot. Returns true if the program matches starting at instruction `pc`,
input position `sp`.

### `reShorthandClass`

```milo
fn reShorthandClass(p: &mut ReParse, kind: u8, negated: bool): i64
```

Build a single-shorthand class node (\d \w \s and negations \D \W \S).
