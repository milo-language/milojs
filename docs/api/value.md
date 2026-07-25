## value

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

### `floatG`

```milo
fn floatG(n: f64, prec: i32): string
```

_Undocumented._

### `fracToLimbs`

```milo
fn fracToLimbs(x0: f64, nLimbs: i64): Vec<i64>
```

Exact fixed-point fraction: 32-bit limbs, limbs[i] weighs 2^-(32*(i+1)).
A double's fraction part has < 1075 significant bits, so extraction by
repeated exact *2^32 scaling terminates (power-of-two scaling and
x - floor(x) are both exact in IEEE arithmetic).

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

### `hexByte`

```milo
fn hexByte(c: u8): string
```

_Undocumented._

### `hexDigitVal`

```milo
pub fn hexDigitVal(c: u8): i64
```

_Undocumented._

### `hexVal`

```milo
fn hexVal(c: u8): i64
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

### `isJsWs`

```milo
fn isJsWs(c: u8): bool
```

_Undocumented._

### `isNullish`

```milo
pub fn isNullish(v: &JSValue): bool
```

null or undefined — the nullish set that a `?.` link short-circuits on.

### `isNumericLiteral`

```milo
fn isNumericLiteral(t: &string): bool
```

_Undocumented._

### `isoNum`

```milo
fn isoNum(s: &string, from: i64, to: i64): i64
```

_Undocumented._

### `isStr`

```milo
pub fn isStr(v: &JSValue): bool
```

_Undocumented._

### `isUriReserved`

```milo
fn isUriReserved(c: u8): bool
```

_Undocumented._

### `isUriUnreserved`

```milo
fn isUriUnreserved(c: u8): bool
```

_Undocumented._

### `jsEquals`

```milo
pub fn jsEquals(a: &JSValue, b: &JSValue): bool
```

_Undocumented._

### `jsExpandExpForm`

```milo
fn jsExpandExpForm(s: &string): string
```

%g picks exponent form well before JS does. The spec uses plain decimal
whenever the decimal point lands in (-6, 21]: 1e16 prints as
"10000000000000000" and 1e-6 as "0.000001"; exponent form starts at 1e21 and
1e-7. Expand a %g exponent form back to plain decimal when JS requires it.

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

### `jsParseDigits`

```milo
fn jsParseDigits(s: &string, start: i64, radix: i64, neg: bool): f64
```

allowExp: parseFloat and ToNumber accept 1e3; parseInt does NOT (parseInt("12e3")
is 12, stopping at the 'e').

### `jsParseDigitsEx`

```milo
fn jsParseDigitsEx(s: &string, start: i64, radix: i64, neg: bool, allowExp: bool): f64
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

### `jsParsePrefixNumEx`

```milo
fn jsParsePrefixNumEx(s: &string, radix: i64, autoHex: bool): f64
```

_Undocumented._

### `jsStrictEquals`

```milo
pub fn jsStrictEquals(a: &JSValue, b: &JSValue): bool
```

JS loose equality, simplified: null==undefined, same-type direct, mixed via
numeric coercion.
Strict equality (===): same type, same value, no coercion. Objects, functions
and natives compare by identity (their handle/index).

### `limbsLess`

```milo
fn limbsLess(a: &Vec<i64>, b: &Vec<i64>): bool
```

_Undocumented._

### `limbsMulSmall`

```milo
fn limbsMulSmall(limbs: &mut Vec<i64>, m: i64): i64
```

limbs *= m (m <= 36); returns the integer carry-out (the next digit)

### `limbsSumOverflows`

```milo
fn limbsSumOverflows(a: &Vec<i64>, b: &Vec<i64>): bool
```

does a + b carry past 1.0?

### `nativeHandle`

```milo
pub fn nativeHandle(v: &JSValue): i64
```

native id if v is a builtin function/constructor, else -1

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

Number.prototype.toFixed — fixed-point with `digits` decimals, half-up.

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

### `radixDigitChar`

```milo
fn radixDigitChar(d: i64): u8
```

_Undocumented._

### `roundHalfAwayFromZero`

```milo
fn roundHalfAwayFromZero(x: f64): i64
```

_Undocumented._

### `startsWithInfinity`

```milo
fn startsWithInfinity(t: &string): bool
```

ToNumber requires the ENTIRE string to be a numeric literal — unlike
parseFloat, which happily stops at the first bad character. Without this
Number("12abc") would be 12 instead of NaN.

### `stripExpZeros`

```milo
fn stripExpZeros(s: &string): string
```

C's %g pads the exponent to at least two digits (1e-07); JS does not (1e-7).
Only leading zeros go — 1e+21 and 1e-100 are already correct.

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
