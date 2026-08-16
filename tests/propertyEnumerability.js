// Almost nothing that should be non-enumerable was. The visible consequence is
// not a descriptor mismatch, it is that `for (k in obj)` over ANY class instance
// listed every method it inherits — so object iteration over user classes was
// simply wrong. test262 has a prop-desc.js per built-in member and 29 of them
// failed in the sample.
const d = (o, k, label) => {
  const x = Object.getOwnPropertyDescriptor(o, k);
  console.log(label, x ? `w=${x.writable} e=${x.enumerable} c=${x.configurable}` : "MISSING");
};
d(Math, "E", "Math.E");
d(Math, "PI", "Math.PI");
d(Math, "LN2", "Math.LN2");
d(Math, "random", "Math.random");
d(Math, "max", "Math.max");
d(Date.prototype, "toLocaleTimeString", "Date.p.toLocaleTimeString");
d(Date.prototype, "getTime", "Date.p.getTime");
d(Error.prototype, "message", "Error.p.message");
d(Error.prototype, "name", "Error.p.name");
d(TypeError.prototype, "message", "TypeError.p.message");
d(TypeError.prototype, "name", "TypeError.p.name");
d(RangeError.prototype, "name", "RangeError.p.name");
d(FinalizationRegistry.prototype, "unregister", "FinReg.p.unregister");
d(Object.prototype, "hasOwnProperty", "Object.p.hasOwnProperty");
d(Array.prototype, "map", "Array.p.map");
d(String.prototype, "slice", "String.p.slice");

class C { m() {} static s() {} get g() { return 1; } set g(v) {} #p = 1; field = 2; }
d(C.prototype, "m", "class method");
d(C, "s", "class static");
d(C.prototype, "g", "class accessor");
d(C.prototype, "constructor", "class constructor");
console.log("for-in over instance:", JSON.stringify((() => { const r = []; for (const k in new C()) r.push(k); return r; })()));
console.log("Object.keys of instance:", JSON.stringify(Object.keys(new C())));
console.log("JSON of instance:", JSON.stringify(new C()));

class D extends C { n() {} }
console.log("for-in over subclass:", JSON.stringify((() => { const r = []; for (const k in new D()) r.push(k); return r; })()));
// a plain object literal's members ARE enumerable — the change must not leak
const lit = { a: 1, m() {}, get g() { return 1; } };
console.log("literal for-in:", JSON.stringify((() => { const r = []; for (const k in lit) r.push(k); return r; })()));
// Math constants are frozen
console.log("Math.PI write ignored:", (() => { try { Math.PI = 3; } catch (e) {} return Math.PI === 3.141592653589793; })());
