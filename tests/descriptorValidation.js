// Object.defineProperty accepted EVERYTHING. Ten of ten spec rejections were
// silently allowed, so a call that must throw returned the object unchanged and
// the caller carried on believing the property was defined.
//
// And a function's `name`/`length` were synthesised on READ only, so every
// getOwnPropertyDescriptor query answered undefined — which is how test262
// checks them, and how any library that copies function metadata reads them.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
const own = (o, k, l) => { const d = Object.getOwnPropertyDescriptor(o, k); console.log(l, d ? `v=${JSON.stringify(d.value)} w=${d.writable} e=${d.enumerable} c=${d.configurable}` : "MISSING"); };

t("on a primitive", () => Object.defineProperty(42, "x", { value: 1 }));
t("null descriptor", () => Object.defineProperty({}, "x", null));
t("primitive descriptor", () => Object.defineProperty({}, "x", 5));
t("get and value together", () => Object.defineProperty({}, "x", { get() {}, value: 1 }));
t("set and writable together", () => Object.defineProperty({}, "x", { set(v) {}, writable: true }));
t("non-callable get", () => Object.defineProperty({}, "x", { get: 5 }));
t("non-callable set", () => Object.defineProperty({}, "x", { set: "no" }));
t("undefined get is allowed", () => { const o = {}; Object.defineProperty(o, "x", { get: undefined }); return typeof Object.getOwnPropertyDescriptor(o, "x").get; });
t("redefine non-configurable", () => { const o = {}; Object.defineProperty(o, "x", { value: 1 }); return Object.defineProperty(o, "x", { value: 2 }); });
t("redefine to configurable", () => { const o = {}; Object.defineProperty(o, "x", { value: 1 }); return Object.defineProperty(o, "x", { configurable: true }); });
t("same value re-define is fine", () => { const o = {}; Object.defineProperty(o, "x", { value: 1 }); Object.defineProperty(o, "x", { value: 1 }); return o.x; });
t("configurable redefine is fine", () => { const o = {}; Object.defineProperty(o, "x", { value: 1, configurable: true }); Object.defineProperty(o, "x", { value: 2 }); return o.x; });
t("defineProperties null", () => Object.defineProperties({}, null));
t("defineProperties on primitive", () => Object.defineProperties("s", {}));
t("defineProperties bad member", () => Object.defineProperties({}, { a: 5 }));
t("defineProperties works", () => { const o = Object.defineProperties({}, { a: { value: 1 }, b: { value: 2 } }); return o.a + o.b; });

// a function IS an object here, so defineProperty on one must work — the first
// guard used objHandle, which is -1 for a Func, and rejected every call
t("defineProperty on a function", () => { function f() {} Object.defineProperty(f, "x", { value: 1 }); return f.x; });
t("defineProperty on a native", () => { Object.defineProperty(Math.max, "y", { value: 1 }); return Math.max.y; });
t("redefined length is read back", () => { function f(a) {} Object.defineProperty(f, "length", { value: 5 }); return f.length; });
own(function foo(a, b) {}, "name", "fn decl name");
own(function foo(a, b) {}, "length", "fn decl length");
own(() => {}, "name", "arrow name");
own(class K {}, "name", "class name");
own({ m() {} }.m, "name", "shorthand method name");
own(Math.cos, "name", "native name");
own(Math.cos, "length", "native length");
console.log("hasOwn name:", Object.prototype.hasOwnProperty.call(function f() {}, "name"));
console.log("name not enumerable:", JSON.stringify(Object.keys(function f() {})));
