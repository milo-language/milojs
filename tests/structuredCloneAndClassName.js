// structuredClone was missing entirely, and implementing it exposed a much wider
// bug: a class that declares a constructor took its NAME from that member, so
// `class B { constructor(){} }` had B.name === "constructor". Most classes declare
// one. It is how the existing DOMException came out calling itself "constructor",
// which is what made the structuredClone error compare wrong against node.
class A {}
class B { constructor() { this.x = 1; } }
class C { m() {} }
class D extends B { constructor() { super(); } }
const E = class {};
const F = class Named {};
console.log([A.name, B.name, C.name, D.name, E.name, F.name].join("|"));
console.log([new B().constructor.name, new D().constructor.name].join("|"));
var de = new DOMException("m", "N");
console.log([de.constructor.name, de.name, de.message, de instanceof Error].join("|"));

// structuredClone: a DEEP copy that preserves the reference GRAPH, which is what
// separates it from JSON round-tripping.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "ERR", e.constructor.name + ":" + e.name); } }
t("plain", () => structuredClone({ a: 1, b: [1, 2] }));
t("nested", () => structuredClone({ a: { b: { c: [1, { d: 2 }] } } }));
t("cycle", () => { var a = { x: 1 }; a.self = a; var c = structuredClone(a); return [c.x, c.self === c]; });
t("array-cycle", () => { var a = [1]; a.push(a); var c = structuredClone(a); return [c[0], c[1] === c]; });
t("shared-ref-preserved", () => { var x = { v: 1 }; var c = structuredClone({ p: x, q: x }); return c.p === c.q; });
t("not-the-same-object", () => { var x = { v: 1 }; return structuredClone(x) !== x; });
t("map", () => { var c = structuredClone(new Map([["a", 1]])); return [c instanceof Map, c.get("a")]; });
t("set", () => { var c = structuredClone(new Set([1, 2])); return [c instanceof Set, [...c]]; });
t("date", () => { var d = new Date(5); var c = structuredClone(d); return [c instanceof Date, c.getTime(), c !== d]; });
t("regexp", () => { var c = structuredClone(/ab/gi); return [c instanceof RegExp, c.source, c.flags]; });
t("typedarray", () => { var c = structuredClone(new Int32Array([1, 2])); return [c instanceof Int32Array, [...c]]; });
t("arraybuffer", () => { var c = structuredClone(new ArrayBuffer(4)); return [c instanceof ArrayBuffer, c.byteLength]; });
t("primitives", () => structuredClone([1, "s", true, null, undefined, NaN]));
t("bigint", () => String(structuredClone(1n)));
t("function-throws", () => structuredClone(function () {}));
t("symbol-throws", () => structuredClone(Symbol("x")));
t("nested-function-throws", () => structuredClone({ ok: 1, bad: function () {} }));
t("prototype-dropped", () => { class K { constructor() { this.v = 1; } } var c = structuredClone(new K()); return [c.v, c instanceof K, Object.getPrototypeOf(c) === Object.prototype]; });
t("getter-evaluated", () => { var o = { get g() { return 7; } }; var c = structuredClone(o); return [c.g, Object.getOwnPropertyDescriptor(c, "g").value]; });
