// `Foo.prototype.valueOf.call(wrapper)` returned the WRAPPER instead of the
// primitive it wraps. The direct form `wrapper.valueOf()` already worked, so the
// bug only showed through the uncurried call — which is how every library does
// it.
//
// The consequence found it: object-inspect unwraps a boxed primitive by calling
// valueOf and printing "Object(" around the result. A result that is still an
// object nests again, so `inspect(Object(42n))` recursed until the stack was
// gone. Symbol wrappers had the matching problem in toString, printing the
// object tag instead of the description.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
const b = Object(42n), s = Object(Symbol("x")), n = Object(7);
t("typeof boxed bigint", () => typeof b);
t("bigint valueOf", () => typeof BigInt.prototype.valueOf.call(b));
t("bigint valueOf value", () => String(BigInt.prototype.valueOf.call(b)));
t("symbol valueOf", () => typeof Symbol.prototype.valueOf.call(s));
t("symbol toString", () => Symbol.prototype.toString.call(s));
t("number valueOf", () => typeof Number.prototype.valueOf.call(n));
t("boxed bigint tag", () => Object.prototype.toString.call(b));
t("boxed symbol tag", () => Object.prototype.toString.call(s));
t("b.valueOf()", () => typeof b.valueOf());
t("s.valueOf()", () => typeof s.valueOf());
