## builtins

### `argNum`

```milo
fn argNum(args: &Vec<JSValue>, i: i64, dflt: i64): i64
```

_Undocumented._

### `argStr`

```milo
fn argStr(args: &Vec<JSValue>, i: i64): string
```

_Undocumented._

### `byteToUtf16`

```milo
pub fn byteToUtf16(s: &string, at: i64): i64
```

byte offset -> UTF-16 index (the inverse, for indexOf-style results).

### `clampIndex`

```milo
fn clampIndex(idx: i64, len: i64): i64
```

Normalize a possibly-negative slice index to [0, len], JS-style. The postcondition is the
safety contract every caller relies on: the returned index is always in bounds for a
buffer of `len`, so `s[clampIndex(..)]` up to (not including) `len` can never read OOB.

### `isJsSpace`

```milo
fn isJsSpace(c: u8): bool
```

Dispatch a String method by name. Callback-taking methods don't exist on
strings, so this needs nothing from eval — only heap access for split.

### `isWs`

```milo
fn isWs(c: u8): bool
```

_Undocumented._

### `jsCharAt`

```milo
fn jsCharAt(s: &string, idx: i64): string
```

_Undocumented._

### `jsContains`

```milo
fn jsContains(s: &string, sub: &string): bool
```

_Undocumented._

### `jsEndsWith`

```milo
fn jsEndsWith(s: &string, sub: &string): bool
```

_Undocumented._

### `jsIndexOf`

```milo
pub fn jsIndexOf(s: &string, sub: &string, start: i64): i64
```

First index of `sub` in `s` at or after `start`, or -1. (`from` is a reserved keyword.)

### `jsonHex4`

```milo
fn jsonHex4(s: &string, at: i64): i64
```

Four hex digits at `at`, or -1 if they are not all hex.

### `jsRepeat`

```milo
fn jsRepeat(s: &string, count: i64): string
```

_Undocumented._

### `jsSplit`

```milo
fn jsSplit(s: &string, args: &Vec<JSValue>, st: &mut Interp): i64
```

_Undocumented._

### `jsStartsWith`

```milo
pub fn jsStartsWith(s: &string, sub: &string): bool
```

_Undocumented._

### `jsSubstringAt`

```milo
fn jsSubstringAt(s: &string, needle: &string, at: i64): bool
```

Does `needle` occur in `s` starting exactly at `at`?

### `jsTrim`

```milo
pub fn jsTrim(s: &string): string
```

_Undocumented._

### `lowerCp`

```milo
fn lowerCp(cp: i32): i32
```

_Undocumented._

### `mjAbs`

```milo
pub fn mjAbs(x: f64): f64
```

_Undocumented._

### `mjCeil`

```milo
pub fn mjCeil(x: f64): f64
```

_Undocumented._

### `mjFloor`

```milo
pub fn mjFloor(x: f64): f64
```

_Undocumented._

### `mjHexNibble`

```milo
fn mjHexNibble(v: i64): u8
```

mj-prefixed like the JSON helpers above: std/http defines its own hexNibble
going the OTHER direction (hex char -> int), and Milo's flat namespace has no
way to keep both.

### `mjIsNan`

```milo
fn mjIsNan(x: f64): bool
```

_Undocumented._

### `mjJsonEscape`

```milo
fn mjJsonEscape(s: &string): string
```

_Undocumented._

### `mjJsonOmitted`

```milo
pub fn mjJsonOmitted(v: &JSValue): bool
```

_Undocumented._

### `mjJsonParse`

```milo
pub fn mjJsonParse(s: &string, st: &mut Interp): JSValue
```

_Undocumented._

### `mjNextRandom`

```milo
pub fn mjNextRandom(state: i64): i64
```

xorshift64 — a pure-Milo PRNG for Math.random(). Deterministic seed (a real
runtime would seed from entropy); good enough for [0,1) values, not crypto.

### `mjParseArray`

```milo
fn mjParseArray(s: &string, c: &mut JCur, st: &mut Interp): JSValue
```

_Undocumented._

### `mjParseNumber`

```milo
fn mjParseNumber(s: &string, c: &mut JCur): JSValue
```

_Undocumented._

### `mjParseObject`

```milo
fn mjParseObject(s: &string, c: &mut JCur, st: &mut Interp): JSValue
```

_Undocumented._

### `mjParseString`

```milo
fn mjParseString(s: &string, c: &mut JCur): string
```

_Undocumented._

### `mjParseVal`

```milo
fn mjParseVal(s: &string, c: &mut JCur, st: &mut Interp): JSValue
```

_Undocumented._

### `mjPushJsonEscaped`

```milo
fn mjPushJsonEscaped(out: &mut string, s: &string)
```

_Undocumented._

### `mjPushStringified`

```milo
fn mjPushStringified(out: &mut string, v: &JSValue, st: &Interp)
```

Appends into a single growing buffer rather than returning a string per node.
Returning strings made the top-level accumulator `out = out + piece` copy the
whole prefix once per element — quadratic, and it allocated ~35x the output
size in short-lived intermediates that the allocator never returned to the OS.

### `mjRound`

```milo
pub fn mjRound(x: f64): f64
```

_Undocumented._

### `mjSign`

```milo
pub fn mjSign(x: f64): f64
```

_Undocumented._

### `mjSkipWs`

```milo
fn mjSkipWs(s: &string, c: &mut JCur)
```

_Undocumented._

### `mjStringifyVal`

```milo
pub fn mjStringifyVal(v: &JSValue, st: &Interp): string
```

Compact JSON text for a value (no indentation). undefined/function become
"null" in arrays; object props holding them are omitted. NaN/Infinity → null.

### `mjTrunc`

```milo
pub fn mjTrunc(x: f64): f64
```

_Undocumented._

### `strCodePoints`

```milo
pub fn strCodePoints(s: &string): Vec<string>
```

s.split(sep) → a new heap array. No arg → [s]; empty sep → one entry per char.
A string's Unicode code points, one substring each. JS string iteration
(for-of, spread, Array.from) yields code points — since milojs strings are
UTF-8, that means walking by decoded codepoint width, NOT by byte, or a
multibyte char (é = 2 bytes, 😀 = 4) is chopped into invalid pieces that
render as U+FFFD. Shared so every iteration site behaves identically.

### `stringFromUtf16Units`

```milo
pub fn stringFromUtf16Units(units: &Vec<i64>): string
```

Build a string from UTF-16 code units, combining surrogate pairs into one
codepoint and UTF-8 encoding the result. String.fromCharCode used to push each
unit as a raw BYTE, so fromCharCode(0x4E2D) truncated to '-' and anything above
U+00FF was destroyed.

### `stringMethod`

```milo
pub fn stringMethod(name: &string, s: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `strLower`

```milo
fn strLower(s: &string): string
```

_Undocumented._

### `strSlice`

```milo
pub fn strSlice(s: &string, start: i64, end: i64): string
```

_Undocumented._

### `strUpper`

```milo
fn strUpper(s: &string): string
```

_Undocumented._

### `throwRange`

```milo
fn throwRange(st: &mut Interp, msg: string): JSValue
```

A minimal error object (same shape makeError in eval.milo builds — that one
can't be imported here without a cycle).

### `upperCp`

```milo
fn upperCp(cp: i32): i32
```

Case mapping over code points, covering ASCII and the Latin-1 Supplement
letters (À-Þ / à-þ, the accented characters French/Spanish/Portuguese/German
use), with the ÷/× math-symbol holes skipped and ÿ→Ÿ's irregular target. Wider
scripts (Latin Extended, Greek, Cyrillic) are not mapped — a documented limit.

### `utf16CodePointAt`

```milo
fn utf16CodePointAt(s: &string, idx: i64): i64
```

The full codepoint at `idx` — like utf16UnitAt, except that landing on a high
surrogate returns the whole codepoint rather than the half.

### `utf16Length`

```milo
pub fn utf16Length(s: &string): i64
```

`.length` is one of the hottest string reads, and the general path calls
decodeCodepoint per character. For an all-ASCII string — overwhelmingly the
common case — the UTF-16 length equals the byte length, and proving that is a
tight byte scan instead of a decode per character. Falls back to the general
path from the first non-ASCII byte, so no work is repeated.

### `utf16LengthFrom`

```milo
fn utf16LengthFrom(s: &string, from: i64): i64
```

Total length in UTF-16 code units — what JS reports as .length.
Counts from `from`, whose prefix is known to be `from` ASCII units.

### `utf16Locate`

```milo
fn utf16Locate(s: &string, idx: i64): Utf16Pos
```

_Undocumented._

### `utf16Slice`

```milo
pub fn utf16Slice(s: &string, start: i64, end: i64): string
```

Slice by UTF-16 indices, JS-style (negative counts from the end, bounds clamp).

### `utf16ToByte`

```milo
fn utf16ToByte(s: &string, idx: i64): i64
```

UTF-16 index -> byte offset. Past the end returns s.len(), so callers can use
it directly as a slice bound.

### `utf16UnitAt`

```milo
fn utf16UnitAt(s: &string, idx: i64): i64
```

The UTF-16 code unit at `idx`, or -1 when out of range. A supplementary
codepoint yields its high surrogate at the first index and its low at the next.
