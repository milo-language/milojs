// A function is an object: it is extensible, freezable, and inherits the
// Object.prototype methods through Function.prototype, by dot and by index.
function f(a, b) {}

console.log(typeof f.hasOwnProperty, typeof f["hasOwnProperty"], typeof f.isPrototypeOf, typeof f.propertyIsEnumerable);
console.log(f.hasOwnProperty("name"), f.hasOwnProperty("nope"));
console.log(Object.isExtensible(f), Object.isFrozen(f), Object.isSealed(f));
console.log(Object.isExtensible(Object), Object.isExtensible(String), Object.isExtensible(Symbol), Object.isExtensible(Math.max));

const g = function () {};
Object.preventExtensions(g);
console.log(Object.isExtensible(g));
try { Object.defineProperty(g, "zz", { value: 1 }); console.log("added"); }
catch (e) { console.log("threw", e.constructor.name); }

const h = function () {};
Object.freeze(h);
h.q = 1;
console.log(h.q, Object.isFrozen(h));
console.log(Object.isExtensible(42), Object.isExtensible("s"));
