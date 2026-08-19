// Both found by the crash fuzzer (tools/fuzz.sh), neither by any conformance
// suite or by the differential sweeps.
//
// A SYMBOL has no implicit conversion: ToString and ToNumber of one both throw,
// and only String(sym) and sym.toString() are allowed. Symbols are modelled here
// as tagged strings, so `"x" + sym` took the ordinary concatenation path and
// produced "x@@sym:s:3", LEAKING the internal tag into user output.
//
// And null/undefined are not primitives that box, so `(null).toString()` is the
// same TypeError plain property access already raised. The fast path only asked
// "not an object and not a function", which both satisfy.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "ERR", e.constructor.name); } }
var S = Symbol("s");

t("String-of-symbol-allowed", () => String(S));
t("toString-method-allowed", () => S.toString());
t("description", () => S.description);
t("as-key", () => { var o = {}; o[S] = 1; return o[S]; });
t("template", () => `${S}`);
t("concat", () => "x" + S);
t("concat-reversed", () => S + "x");
t("array-join", () => [S].join(","));
t("array-toString", () => [S].toString());
t("String-of-array", () => String([S]));
t("nested-array", () => String([[S]]));
t("unary-plus", () => +S);
t("unary-minus", () => -S);
t("bitwise-not", () => ~S);
t("relational", () => S < S);
t("strict-equal-allowed", () => [S === S, S !== S]);
t("json-drops", () => [JSON.stringify({ k: S }), JSON.stringify([S])]);
t("tag", () => Object.prototype.toString.call(S));

t("null.toString", () => (null).toString());
t("undefined.toString", () => (undefined).toString());
t("null.valueOf", () => (null).valueOf());
t("null.prop", () => (null).x);
t("null-index", () => (null)[0]);
t("optional-chain-allowed", () => (null)?.x);
t("String(null)-allowed", () => [String(null), String(undefined)]);
t("primitives-still-work", () => [(5).toString(), ("a").toString(), (true).toString(), (5).toFixed(1)]);
