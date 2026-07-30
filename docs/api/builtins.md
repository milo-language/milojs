## builtins

### `byteToUtf16`

```milo
pub fn byteToUtf16(s: &string, at: i64): i64
```

byte offset -> UTF-16 index (the inverse, for indexOf-style results).

### `jsIndexOf`

```milo
pub fn jsIndexOf(s: &string, sub: &string, start: i64): i64
```

First index of `sub` in `s` at or after `start`, or -1. (`from` is a reserved keyword.)

### `jsStartsWith`

```milo
pub fn jsStartsWith(s: &string, sub: &string): bool
```

_Undocumented._

### `jsTrim`

```milo
pub fn jsTrim(s: &string): string
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

### `strSlice`

```milo
pub fn strSlice(s: &string, start: i64, end: i64): string
```

_Undocumented._

### `utf16Length`

```milo
pub fn utf16Length(s: &string): i64
```

`.length` is one of the hottest string reads, and the general path calls
decodeCodepoint per character. For an all-ASCII string — overwhelmingly the
common case — the UTF-16 length equals the byte length, and proving that is a
tight byte scan instead of a decode per character. Falls back to the general
path from the first non-ASCII byte, so no work is repeated.

### `utf16Slice`

```milo
pub fn utf16Slice(s: &string, start: i64, end: i64): string
```

Slice by UTF-16 indices, JS-style (negative counts from the end, bounds clamp).
