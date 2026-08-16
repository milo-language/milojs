// The wrapper prototypes' valueOf/toString and every Date getter are brand
// checked in the spec: they require the receiver to carry the matching internal
// slot rather than coercing whatever they are given. milojs accepted any
// receiver, which is not a quiet deviation — it is precisely the detector the
// is-string / is-number-object / is-boolean-object / is-date-object family uses,
// so every one of them answered `true` for arrays, objects and regexes.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };

for (const v of [[], {}, /r/, 42, "s"]) {
  const tag = Object.prototype.toString.call(v);
  t("String.valueOf " + tag, () => String.prototype.valueOf.call(v));
  t("Number.valueOf " + tag, () => Number.prototype.valueOf.call(v));
  t("Boolean.valueOf " + tag, () => Boolean.prototype.valueOf.call(v));
  t("Date.getDay " + tag, () => Date.prototype.getDay.call(v));
}
// the matching receivers, primitive and boxed alike
t("String.valueOf primitive", () => String.prototype.valueOf.call("abc"));
t("String.valueOf wrapper", () => String.prototype.valueOf.call(new String("abc")));
t("Number.valueOf primitive", () => Number.prototype.valueOf.call(5));
t("Boolean.valueOf wrapper", () => Boolean.prototype.valueOf.call(new Boolean(true)));
t("Date.getDay date", () => typeof Date.prototype.getDay.call(new Date(0)));
t("Number.toFixed on []", () => Number.prototype.toFixed.call([], 2));

// String.prototype, Number.prototype and Boolean.prototype are themselves
// wrapper objects holding "", 0 and false; Symbol/BigInt/Date prototypes are
// ordinary objects and throw for their own branded methods.
t("String.prototype + ''", () => typeof (String.prototype + ""));
t("Number.prototype + 0", () => Number.prototype + 0);
t("Boolean.prototype valueOf", () => Boolean.prototype.valueOf.call(Boolean.prototype));
t("tag of String.prototype", () => Object.prototype.toString.call(String.prototype));
t("String.prototype.length", () => String.prototype.length);
t("Symbol.prototype valueOf", () => Symbol.prototype.valueOf.call(Symbol.prototype));
t("BigInt.prototype valueOf", () => BigInt.prototype.valueOf.call(BigInt.prototype));
t("Date.prototype getDay", () => Date.prototype.getDay.call(Date.prototype));

// The rest of String.prototype stays GENERIC: it ToStrings its receiver, which
// is what the uncurry-this idiom depends on.
t("String.indexOf on array", () => String.prototype.indexOf.call(["a", "b"], "b"));
t("String.slice on number", () => String.prototype.slice.call(12345, 1, 3));

// `x == null` is false for any object WITHOUT converting it, so a valueOf that
// throws must never run. This is the null guard every intrinsic resolver opens
// with, and coercing there broke get-intrinsic outright.
t("Date.prototype != null", () => Date.prototype != null);
t("String.prototype == null", () => String.prototype == null);
t("throwing valueOf == null", () => ({ valueOf() { throw new Error("no"); },
                                       toString() { throw new Error("no"); } }) == null);
t("throwing valueOf == undefined", () => ({ valueOf() { throw new Error("no"); },
                                            toString() { throw new Error("no"); } }) == undefined);
// but it IS converted against a number or a string
t("obj == number", () => ({ valueOf() { return 7; } }) == 7);
t("obj == string", () => ({ toString() { return "z"; } }) == "z");

t("WeakRef.deref on {}", () => WeakRef.prototype.deref.call({}));
t("FinReg.register on {}", () => FinalizationRegistry.prototype.register.call({}, {}, 1));
