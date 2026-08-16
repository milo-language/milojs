// Two defects that both stop a package on its first line.
//
// 1. `Object.assign` did no ToObject on its target: a nullish target returned
//    quietly instead of throwing, and a PRIMITIVE target came back unboxed, so
//    `typeof Object.assign(1, {})` was "number".
// 2. `Array` and `Promise` are constructor OBJECTS in this engine, not Natives,
//    so the native naming pass never reached them and neither had an own
//    `length` or `name`. get-intrinsic resolves %Array.length% and reports
//    "base intrinsic exists, but the property is not available" without it —
//    which is exactly where call-bound stopped.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
const d = (o, k, l) => { const x = Object.getOwnPropertyDescriptor(o, k); console.log(l, x ? `v=${x.value} w=${x.writable} e=${x.enumerable} c=${x.configurable}` : "MISSING"); };

t("assign undefined target", () => Object.assign(undefined, {}));
t("assign null target", () => Object.assign(null, {}));
t("assign no args", () => Object.assign());
t("number target is boxed", () => typeof Object.assign(1, {}));
t("string target is boxed", () => typeof Object.assign("s", {}));
t("boolean target is boxed", () => typeof Object.assign(true, {}));
t("boxed target keeps its value", () => Object.assign(5, {}).valueOf());
t("nullish SOURCE is skipped", () => JSON.stringify(Object.assign({ a: 1 }, null, undefined)));
t("copies own enumerable", () => JSON.stringify(Object.assign({}, { a: 1 }, { b: 2 })));
t("later sources win", () => JSON.stringify(Object.assign({}, { a: 1 }, { a: 2 })));
t("returns the target", () => { const o = {}; return Object.assign(o, { a: 1 }) === o; });

for (const [n, C] of [["Array", Array], ["Promise", Promise], ["Object", Object], ["Map", Map], ["Set", Set], ["Error", Error]]) {
  d(C, "length", n + ".length");
}
d(Array, "name", "Array.name");
d(Promise, "name", "Promise.name");
