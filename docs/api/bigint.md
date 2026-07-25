## bigint

### `bigNormalizeDec`

```milo
pub fn bigNormalizeDec(s: &string): string
```

_Undocumented._

### `bnAdd`

```milo
pub fn bnAdd(a: &string, b: &string): string
```

_Undocumented._

### `bnAddMag`

```milo
fn bnAddMag(a: &string, b: &string): string
```

_Undocumented._

### `bnBinPad`

```milo
fn bnBinPad(mag: &string, width: i64): string
```

pad a magnitude's binary form on the left to `width` bits

### `bnBitLen`

```milo
fn bnBitLen(mag: &string): i64
```

_Undocumented._

### `bnBitwise`

```milo
pub fn bnBitwise(op: u8, a: &string, b: &string): string
```

&, |, ^ over signed BigInts via fixed-width two's complement. width covers both
magnitudes plus one sign bit; each operand is mapped into that field, the op runs
bit-for-bit, then a set top bit is read back as negative (value − 2^width).

### `bnCmp`

```milo
pub fn bnCmp(a: &string, b: &string): i64
```

-1 / 0 / 1

### `bnCmpMag`

```milo
fn bnCmpMag(a: &string, b: &string): i64
```

-1 / 0 / 1 for a < / == / > b

### `bnDiv`

```milo
pub fn bnDiv(a: &string, b: &string): string
```

BigInt division truncates toward zero; remainder takes the DIVIDEND's sign.

### `bnDivModMag`

```milo
fn bnDivModMag(a: &string, b: &string): BnDivResult
```

long division of magnitudes: a / b, b != "0". quotient + remainder, both >= 0.

### `bnFromF64`

```milo
pub fn bnFromF64(n: f64): string
```

Number(str) truncated to a BigInt decimal string. Only used by BigInt(number):
the caller has already checked the value is a finite integer.

### `bnFromRadix`

```milo
pub fn bnFromRadix(s: &string, radix: i64): string
```

parse a base-`radix` magnitude string (no sign) into a canonical decimal
BigInt. Used for hex/oct/bin BigInt literals and BigInt("0x..").

### `bnIsNeg`

```milo
fn bnIsNeg(s: &string): bool
```

_Undocumented._

### `bnMag`

```milo
fn bnMag(s: &string): string
```

the magnitude (unsigned digits) of a canonical BigInt

### `bnMod`

```milo
pub fn bnMod(a: &string, b: &string): string
```

_Undocumented._

### `bnMul`

```milo
pub fn bnMul(a: &string, b: &string): string
```

_Undocumented._

### `bnMulMag`

```milo
fn bnMulMag(a: &string, b: &string): string
```

_Undocumented._

### `bnNeg`

```milo
pub fn bnNeg(s: &string): string
```

_Undocumented._

### `bnPow`

```milo
pub fn bnPow(a: &string, e: &string): string
```

a ** e, e >= 0 (the caller rejects a negative exponent). Square-and-multiply.

### `bnReverse`

```milo
fn bnReverse(v: &Vec<u8>): string
```

_Undocumented._

### `bnShl`

```milo
pub fn bnShl(a: &string, n: &string): string
```

a << n and a >> n, n given as a canonical BigInt string. `<<` is a*2^n;
`>>` is arithmetic floor-division by 2^n (matches JS for the values here).

### `bnShr`

```milo
pub fn bnShr(a: &string, n: &string): string
```

_Undocumented._

### `bnStrFrom`

```milo
pub fn bnStrFrom(s: &string, from: i64): string
```

_Undocumented._

### `bnSub`

```milo
pub fn bnSub(a: &string, b: &string): string
```

_Undocumented._

### `bnSubMag`

```milo
fn bnSubMag(a: &string, b: &string): string
```

a - b, requires a >= b (magnitudes)

### `bnToRadix`

```milo
pub fn bnToRadix(s: &string, radix: i64): string
```

canonical decimal BigInt → base-`radix` string (2..36), lowercase digits.
Repeated division of the magnitude by the radix; the remainder each step is
the next low-order digit. Arbitrary precision — no f64 round-trip.

### `bnTwosComp`

```milo
fn bnTwosComp(a: &string, width: i64): string
```

width-bit two's-complement magnitude of a (unsigned string). Non-negative → a;
negative → 2^width − |a|, which has the sign bit set.

### `isDecimalIntStr`

```milo
pub fn isDecimalIntStr(s: &string): bool
```

true if s is a plain base-10 integer: optional +/- then one or more digits.
(BigInt("123") is exact; BigInt("0xff")/"1.5"/"" are not decimal integers.)
