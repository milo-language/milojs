// Number formatting, radix conversion, parsing and the Math edges. Only four of
// 21 disagreed with node, and the shortest-round-trip float printing -- the part
// most engines get wrong -- was already right.
//
// The interesting failure was toFixed. It scaled by 10^digits in DOUBLE
// arithmetic, and that multiply has its own rounding: 1.45 is really
// 1.44999999999999995559..., but `1.45 * 10` rounds UP to exactly 14.5, so the
// digit walk answered "1.5" where the spec says "1.4". A double is m * 2^k
// exactly, so the fraction is an exact ratio and the rounding decision is an
// integer comparison -- done through the bigint helpers rather than in floats.
//
// Math.f16round is not covered here: it is absent, and belongs to the documented
// Float16Array gap in docs/status.md rather than to this sweep.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
t("toString-basic", () => [255..toString(16), 255..toString(2), (-255).toString(16), (0.5).toString(2)]);
t("toString-radix-frac", () => [(0.1).toString(3), (255.5).toString(16), (1/3).toString(7)]);
t("toString-radix-bad", () => { try { return (5).toString(1); } catch (e) { return "THREW:" + e.constructor.name; } });
t("toFixed", () => [(1.005).toFixed(2), (0).toFixed(2), (-1.5).toFixed(0), (1e21).toFixed(2), (2.5).toFixed(0), (1.45).toFixed(1)]);
t("toFixed-range", () => { try { return (1).toFixed(101); } catch (e) { return "THREW:" + e.constructor.name; } });
t("toPrecision", () => [(123.456).toPrecision(4), (0.000123).toPrecision(2), (123).toPrecision(2), (0).toPrecision(1)]);
t("toExponential", () => [(123456).toExponential(2), (0.00012).toExponential(), (0).toExponential(2), (-1.5).toExponential(1)]);
t("shortest-roundtrip", () => [0.1 + 0.2, 1e21, 1e-7, 5e-324, 1.7976931348623157e308, 123456789012345678901234567890]);
t("negzero", () => [String(-0), (-0).toFixed(1), 1 / -0, Object.is(-0, 0)]);
t("parseInt-radix", () => [parseInt("0x1f"), parseInt("1f", 16), parseInt("08"), parseInt("0b11"), parseInt("z", 36), parseInt("", 10)]);
t("parseFloat", () => [parseFloat(".5"), parseFloat("1e"), parseFloat("Infinityx"), parseFloat("+.5e2"), parseFloat("1.2.3")]);
t("Number-coerce", () => [Number(""), Number("0x10"), Number("0b101"), Number("0o17"), Number("1_000"), Number("Infinity"), Number("1e999")]);
t("numeric-separators", () => { try { return eval("1_000 + 0x1_0"); } catch (e) { return "THREW:" + e.constructor.name; } });
t("int-limits", () => [Number.MAX_SAFE_INTEGER, Number.MIN_VALUE, Number.EPSILON, Number.MAX_VALUE]);
t("isInteger", () => [Number.isInteger(5.0), Number.isInteger(5.5), Number.isSafeInteger(2 ** 53), Number.isFinite("5")]);
t("bigint-ops", () => [String(10n ** 20n), String((-7n) / 2n), String(7n % 3n), String(BigInt("0x10"))]);
t("bigint-asIntN", () => [String(BigInt.asIntN(8, 255n)), String(BigInt.asUintN(8, -1n))]);
t("math-edge", () => [Math.round(-0.5), Math.round(0.5), Math.round(2.5), Math.sign(-0), Math.trunc(-0.9), Math.hypot(3,4)]);
t("math-fround", () => [Math.fround(1.1), Math.clz32(1), Math.imul(3, 4)]);
t("exp-operator", () => [2 ** 53, (-2) ** 2, 2 ** -1]);
const cases = [[1.45,1],[1.005,2],[2.5,0],[-1.5,0],[0,2],[1e20,2],[0.000001,7],[1.25,1],[1.35,1],[123.456,2],[-0.04,1],[8.575,2],[1e-7,10],[9.995,2]];
for (const [v,d] of cases) console.log(v, d, JSON.stringify(v.toFixed(d)));
