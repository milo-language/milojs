// Strict mode turns silent failures into TypeErrors, and five of these 20 were
// still silent. The worst is not strict-specific: assigning to a property whose
// PROTOTYPE holds a non-writable one created an own property that shadowed it, so
// `c.k = 2` answered 2 in sloppy mode where the spec drops the write entirely.
// OrdinarySetWithOwnDescriptor consults the chain before creating anything.
//
// Two strict poison pills are deliberately absent and still open: `f.caller` and
// `arguments.callee` must throw in strict code and currently answer undefined.
// Both need a per-function accessor that knows the function's own strictness,
// which is a bigger change than the four fixed here.
"use strict";
function t(n, f) { try { const v = f(); console.log(n, "OK", String(v)); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
t("assign-frozen", () => { const o = Object.freeze({ a: 1 }); o.a = 2; return o.a; });
t("add-frozen", () => { const o = Object.freeze({}); o.b = 1; return o.b; });
t("add-sealed", () => { const o = Object.seal({ a: 1 }); o.b = 1; return o.b; });
t("assign-sealed", () => { const o = Object.seal({ a: 1 }); o.a = 2; return o.a; });
t("add-nonextensible", () => { const o = Object.preventExtensions({}); o.x = 1; return o.x; });
t("assign-readonly", () => { const o = {}; Object.defineProperty(o, "r", { value: 1, writable: false }); o.r = 2; return o.r; });
t("delete-nonconfig", () => { const o = {}; Object.defineProperty(o, "d", { value: 1, configurable: false }); delete o.d; return o.d; });
t("delete-var", () => { const g = globalThis; return delete g.undefinedThing; });
t("assign-getter-only", () => { const o = { get g() { return 1; } }; o.g = 2; return o.g; });
t("array-length-frozen", () => { const a = Object.freeze([1]); a.push(2); return a.length; });
t("proto-frozen", () => { const o = Object.freeze({}); Object.setPrototypeOf(o, { x: 1 }); return 1; });
t("defineProp-nonconfig-change", () => { const o = {}; Object.defineProperty(o, "p", { value: 1, configurable: false }); Object.defineProperty(o, "p", { value: 2 }); return o.p; });
t("defineProp-nonconfig-samevalue", () => { const o = {}; Object.defineProperty(o, "p", { value: 1, configurable: false, writable: false }); Object.defineProperty(o, "p", { value: 1 }); return o.p; });
t("undeclared-assign", () => { undeclaredGlobalXyz = 1; return 1; });
t("freeze-then-write-index", () => { const a = Object.freeze([1, 2]); a[0] = 9; return a[0]; });
t("string-index-write", () => { const s = Object("ab"); s[0] = "z"; return s[0]; });
t("write-to-primitive", () => { const n = 5; n.foo = 1; return n.foo; });
t("write-through-proto-readonly", () => { const p = {}; Object.defineProperty(p, "k", { value: 1, writable: false }); const c = Object.create(p); c.k = 2; return c.k; });
