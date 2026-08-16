// `Function` was a plain object holding .prototype: calling it reported
// "Function is not a function". That is the classic globalThis probe
// (`Function("return this")()`), and es-get-iterator and function-bind both
// build their test subjects with it — 140 and 46 assertions that never ran.
//
// `f instanceof Function` was also false: functions are not objects in this
// engine's value model, so the instanceof walk never saw them.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "ERR", e.message); } };

t("typeof Function", () => typeof Function);
t("call form", () => Function("return 1")());
t("new form", () => new Function("a", "return a + 1")(2));
t("several params", () => new Function("a", "b", "c", "return a + b + c")(1, 2, 3));
t("no args", () => typeof Function()());
t("body only, no params", () => Function("return 'x'")());
t("closes over global not caller", () => { const hidden = 5; return Function("return typeof hidden")(); });
t("globalThis probe", () => Function("return this")() === globalThis);
// NOT covered here: Function.prototype.toString returning real source text.
// It answers "[object Function]" for every function, constructed or not, because
// the lexer records no byte offsets and nothing keeps the source span. See
// docs/backlog.md.

t("instanceof Function", () => (function () {}) instanceof Function);
t("arrow instanceof", () => (() => {}) instanceof Function);
t("built-in instanceof", () => Math.max instanceof Function);
t("constructed instanceof", () => new Function("") instanceof Function);
t("object is not", () => ({}) instanceof Function);
t("Function.prototype", () => typeof Function.prototype);
t("ctor round trip", () => (function () {}).constructor === Function);
