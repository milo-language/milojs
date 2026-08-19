## value

### `cloneNative`

```milo
pub fn cloneNative(n: &Native): Native
```

_Undocumented._

### `cloneValue`

```milo
pub fn cloneValue(v: &JSValue): JSValue
```

_Undocumented._

### `daysFromCivil`

```milo
pub fn daysFromCivil(y: i64, m: i64, d: i64): i64
```

Days since 1970-01-01 (Howard Hinnant's civil-from-days, inverted).

### `exactIntDecimal`

```milo
pub fn exactIntDecimal(n: f64): string
```

Number.prototype.toFixed — fixed-point with `digits` decimals, half-up.
The EXACT decimal value of an integer-valued double, which is not the same as
its shortest round-trip form: (1000000000000000128).toString() is
"1000000000000000100" while .toFixed(0) must be "1000000000000000128".
numToStr answers the first, so it cannot be used for the second.

Halving a double is exact (it only decrements the exponent), so the value is
reduced until it fits an i64 -- where the cast is exact -- and the powers of two
taken out are multiplied back with bigint arithmetic.

### `funcEnv`

```milo
pub fn funcEnv(v: &JSValue): i64
```

The closure env (scope index) of a function value, or -1 for non-functions.
Function statics are keyed by (fnIdx, env) so per-call closures stay distinct.

### `funcHandle`

```milo
pub fn funcHandle(v: &JSValue): i64
```

function index if v is a user function, else -1

### `hexDigitVal`

```milo
pub fn hexDigitVal(c: u8): i64
```

_Undocumented._

### `i64ToStr`

```milo
pub fn i64ToStr(n: i64): string
```

_Undocumented._

### `isFiniteF`

```milo
pub fn isFiniteF(n: f64): bool
```

_Undocumented._

### `isNativeValue`

```milo
pub fn isNativeValue(v: &JSValue): bool
```

_Undocumented._

### `isNullish`

```milo
pub fn isNullish(v: &JSValue): bool
```

null or undefined — the nullish set that a `?.` link short-circuits on.

### `isStr`

```milo
pub fn isStr(v: &JSValue): bool
```

_Undocumented._

### `jsEquals`

```milo
pub fn jsEquals(a: &JSValue, b: &JSValue): bool
```

_Undocumented._

### `jsInf`

```milo
pub fn jsInf(): f64
```

_Undocumented._

### `jsInfinity`

```milo
pub fn jsInfinity(): f64
```

object handle if v is an object, else -1 — lets callers test a value's shape
without moving it into a match

### `jsNan`

```milo
pub fn jsNan(): f64
```

_Undocumented._

### `jsParseFloatPrefix`

```milo
pub fn jsParseFloatPrefix(s: &string): f64
```

_Undocumented._

### `jsParsePrefixNum`

```milo
pub fn jsParsePrefixNum(s: &string, radix: i64): f64
```

parseInt/parseFloat: read the longest valid numeric prefix, NaN if none.
Unlike toNum, trailing garbage is ignored rather than poisoning the result.
parseInt auto-detects an 0x prefix; parseFloat must NOT (parseFloat("0x1234")
is 0, because it stops at the 'x'). autoHex distinguishes the two callers.

### `jsStrictEquals`

```milo
pub fn jsStrictEquals(a: &JSValue, b: &JSValue): bool
```

JS loose equality, simplified: null==undefined, same-type direct, mixed via
numeric coercion.
Strict equality (===): same type, same value, no coercion. Objects, functions
and natives compare by identity (their handle/index).

### `nativeEq`

```milo
pub fn nativeEq(a: &Native, b: &Native): bool
```

Two natives are the same built-in. Milo has no `==` on an enum with
payload-bearing variants, and the payload-free half (Builtin) is exactly the
half that can use it.

### `nativeHandle`

```milo
pub fn nativeHandle(v: &JSValue): Option<Native>
```

which built-in v is, or None if it is not one

### `numToExponential`

```milo
pub fn numToExponential(n: f64, digits: i64, haveDigits: bool): string
```

Number.prototype.toExponential — d.dddde±x, with `digits` fraction digits
(or the shortest form that round-trips when the argument is omitted).

### `numToFixed`

```milo
pub fn numToFixed(n: f64, digits: i64): string
```

_Undocumented._

### `numToPrecision`

```milo
pub fn numToPrecision(n: f64, digits: i64): string
```

Number.prototype.toPrecision — `digits` SIGNIFICANT digits, not decimal places.
(It was previously aliased to toFixed, which is a different function entirely:
(123.456).toPrecision(4) is 123.5, whereas toFixed(4) is 123.4560.)
Fixed-notation only; JS switches to exponential when the exponent is < -6 or
>= precision, which this does not implement.

### `numToRadix`

```milo
pub fn numToRadix(n: f64, radix: i64): string
```

Number.prototype.toString(radix). Fraction digits via the free-format
(Steele-White) loop over EXACT fixed-point arithmetic: emit digits until the
remainder is within half an ulp of the source double, then round to nearest
(ties to even). This matches QuickJS/JSC shortest-round-trip output; V8's
double-loop version differs in the last digit for some inputs.

### `numToStr`

```milo
pub fn numToStr(n: f64): string
```

JS Number→string: integrals without ".0", otherwise the shortest decimal
text that round-trips to the same double (probe %g precision 1..17).

### `objHandle`

```milo
pub fn objHandle(v: &JSValue): i64
```

_Undocumented._

### `pad2`

```milo
pub fn pad2(n: i64): string
```

Zero-padded decimal, for ISO timestamps.

### `pad3`

```milo
pub fn pad3(n: i64): string
```

_Undocumented._

### `parseIsoDate`

```milo
pub fn parseIsoDate(s: &string): f64
```

Parse the ISO-8601 forms JS accepts from a string: YYYY-MM-DD with an optional
THH:MM:SS(.mmm)(Z). Anything else is NaN, matching Invalid Date.

### `strLess`

```milo
pub fn strLess(a: &string, b: &string): bool
```

_Undocumented._

### `strToNum`

```milo
pub fn strToNum(s: &string): f64
```

ToNumber on a string. Surrounding whitespace is ignored ("  12  " is 12, and
an all-whitespace string is 0), and the 0x/0o/0b radix prefixes are honored —
none of which plain parseFloat does.

### `toInt32`

```milo
pub fn toInt32(v: &JSValue): i64
```

JS ToInt32 / ToUint32: truncate toward zero, wrap modulo 2^32. Every bitwise
operator coerces through these, which is why 1e10 | 0 is 1410065408 and not 1e10.

### `toNum`

```milo
pub fn toNum(v: &JSValue): f64
```

_Undocumented._

### `toStr`

```milo
pub fn toStr(v: &JSValue): string
```

_Undocumented._

### `toUint32`

```milo
pub fn toUint32(v: &JSValue): i64
```

_Undocumented._

### `truthy`

```milo
pub fn truthy(v: &JSValue): bool
```

_Undocumented._

### `uriDecode`

```milo
pub fn uriDecode(s: &string): string
```

_Undocumented._

### `uriEncode`

```milo
pub fn uriEncode(s: &string, keepReserved: bool): string
```

Percent-encode, byte by byte, so multi-byte UTF-8 encodes correctly.

### `uriHasBadEscape`

```milo
pub fn uriHasBadEscape(s: &string): bool
```

A '%' not followed by two hex digits is a URIError in JS, not a literal.
