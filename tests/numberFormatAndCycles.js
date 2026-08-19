// Number/JSON differential findings. The first is a HANG, and the fixture is
// deliberately not run against a pre-fix engine to prove it: that engine spins
// forever on the first line rather than failing it.
//
//  - numToPrecision and numToFixed guarded NaN but not Infinity, and their
//    normalisation loops divide/multiply by ten. Infinity/10 is Infinity, so
//    `(Infinity).toPrecision(1)` never terminated.
//  - toFixed scaled by 10^digits into an i64, which wraps above 2^53:
//    `(9007199254740992).toFixed(6)` gave "9223372036854.775807". At and above
//    2^53 every double IS an integer, so the fraction is zeros.
//  - parseInt accepted a decimal point: `parseInt("0.5")` answered 0.5. The dot
//    travels with the exponent, and parseInt accepts neither.
//  - JSON.stringify recursed on a cycle until the call-depth guard fired, giving
//    RangeError where the spec requires TypeError.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "ERR", e.constructor.name); } }

t("inf-toPrecision", () => Infinity.toPrecision(1));
t("inf-toFixed", () => Infinity.toFixed(0));
t("inf-toExponential", () => Infinity.toExponential(0));
t("neginf-toPrecision", () => (-Infinity).toPrecision(3));
t("nan-formats", () => [NaN.toPrecision(2), NaN.toFixed(2), NaN.toExponential(2)]);
t("big-toFixed", () => (9007199254740992).toFixed(6));
t("1e21-toFixed", () => (1e21).toFixed(2));
t("1e21-toPrecision", () => (1e21).toPrecision(3));
t("normal-formats", () => [(123.456).toPrecision(4), (0.1).toFixed(3), (255).toString(16)]);
// toFixed and toString DIVERGE above 2^53: toString gives the shortest form that
// round-trips, toFixed the exact value of the double. Answering the short form for
// both is a regression this pins.
t("exact-vs-shortest", () => [(1000000000000000128).toFixed(0), String(1000000000000000128)]);
t("exact-beyond-i64", () => (18446744073709551616).toFixed(0));
t("exact-with-decimals", () => (1000000000000000128).toFixed(1));
t("exact-negative", () => (-1000000000000000128).toFixed(0));

t("parseInt-decimal", () => [parseInt("0.5"), parseInt("1.9"), parseInt("-1.9"), parseInt("12.5px")]);
t("parseInt-leading-dot", () => parseInt(".5"));
t("parseInt-exp", () => parseInt("1e3"));
t("parseInt-hex", () => parseInt("0x1f"));
t("parseFloat-still-decimal", () => [parseFloat(".5"), parseFloat("1.5e2"), Number(".5"), Number(" 2.5 ")]);

t("json-self-cycle", () => { var a = {}; a.self = a; return JSON.stringify(a); });
t("json-indirect-cycle", () => { var a = {}, b = { a: a }; a.b = b; return JSON.stringify(a); });
t("json-array-cycle", () => { var a = []; a.push(a); return JSON.stringify(a); });
t("json-sibling-twice", () => { var x = { v: 1 }; return JSON.stringify({ p: x, q: x }); });
t("json-array-sibling", () => { var x = [1]; return JSON.stringify([x, x]); });
t("json-deep-ok", () => JSON.stringify({ a: { b: { c: [1, 2, { d: 3 }] } } }));
t("json-indent", () => JSON.stringify({ a: [1] }, null, 2));
t("json-replacer", () => JSON.stringify({ a: 1, b: 2 }, ["a"]));
t("json-toJSON", () => JSON.stringify({ toJSON: function () { return "X"; } }));
