// `new` on a non-constructor built an object and ran the body against it. Every
// arrow, every method shorthand, and every plain built-in function — Math.max,
// JSON.parse, Object.keys — was constructible, so a typo like `new fn.map()`
// produced a value instead of failing.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };

t("new arrow", () => new (() => 1)());
t("new object method", () => new ({ m() { return 1; } }).m());
t("new class method", () => { class C { m() {} } return new (C.prototype.m)(); });
t("new getter fn", () => { const o = { get g() { return 1; } }; return new (Object.getOwnPropertyDescriptor(o, "g").get)(); });
t("new Math.max", () => new Math.max());
// NOT covered: `new JSON.parse(...)`. It throws in node because JSON.parse is a
// real built-in; here it is a JS function defined in the prelude (the native
// cannot call a reviver), and a JS function expression is constructible. Same
// class of limit as Temporal's methods — see docs/backlog.md.
t("new Object.keys", () => new Object.keys({}));
t("new Symbol", () => new Symbol());
t("new BigInt", () => new BigInt(1));
t("new Array.prototype.map", () => new (Array.prototype.map)());

// the real constructors keep working
t("new function decl", () => typeof new (function F() {})());
t("new function expr", () => typeof new (function () {})());
t("new class", () => { class C { constructor() { this.v = 1; } } return new C().v; });
t("new derived class", () => { class A { constructor() { this.v = 1; } } class B extends A {} return new B().v; });
t("new class no ctor", () => { class C {} return typeof new C(); });
t("new Object", () => typeof new Object());
t("new Array", () => new Array(3).length);
t("new Map", () => new Map().size);
t("new Set", () => new Set().size);
t("new Date", () => typeof new Date().getTime());
t("new RegExp", () => String(new RegExp("a")));
t("new Error", () => new Error("x").message);
t("new TypeError", () => new TypeError("x").name);
t("new Promise", () => typeof new Promise(r => r(1)));
t("new Proxy", () => new Proxy({ a: 1 }, {}).a);
t("new ArrayBuffer", () => new ArrayBuffer(8).byteLength);
t("new DataView", () => new DataView(new ArrayBuffer(8)).byteLength);
t("new Uint8Array", () => new Uint8Array(2).length);
t("new Function", () => new Function("return 7")());
t("new String", () => typeof new String("a"));
t("new bound function", () => { function C(x) { this.x = x; } const B = C.bind(null, 5); return new B().x; });
