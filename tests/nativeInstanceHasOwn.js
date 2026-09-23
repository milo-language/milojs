// Answers the engine got wrong on its own, found while rebuilding node:vm.

// An Error is an instance of the error constructors on its chain, and of
// nothing else: a name match ("Error") used to make it an instance of every
// native, so assert.throws(fn, new Error("x")) took the RegExp branch.
const e = new Error("x");
const te = new TypeError("t");
console.log("Error vs natives:", e instanceof RegExp, e instanceof Map, e instanceof Date, e instanceof Promise);
console.log("Error family:", e instanceof Error, te instanceof Error, te instanceof TypeError, te instanceof RangeError, e instanceof TypeError);
class MyError extends RangeError {}
const me = new MyError("m");
console.log("subclass:", me instanceof MyError, me instanceof RangeError, me instanceof Error, me instanceof TypeError);

// Calling a method a string primitive does not have is a TypeError, not undefined.
try {
  "abc".nope();
  console.log("no throw");
} catch (err) {
  console.log("missing string method:", err instanceof TypeError);
}
console.log("own string methods:", "abc".toUpperCase(), "a-b".split("-").length, "abc".at(-1));

// Object.hasOwn is HasOwnProperty, the same as hasOwnProperty: a proxy answers
// through its getOwnPropertyDescriptor trap, the global object's bindings are
// its own properties, and so is an array's length.
const seen = [];
const p = new Proxy({}, {
  getOwnPropertyDescriptor(t, k) {
    seen.push(k);
    return k === "virtual" ? { value: 1, configurable: true, enumerable: true, writable: true } : undefined;
  },
});
console.log("proxy:", Object.hasOwn(p, "virtual"), Object.hasOwn(p, "other"), Object.prototype.hasOwnProperty.call(p, "virtual"), seen.join(","));
globalThis.assignedGlobal = 1;
console.log("global bindings:", Object.hasOwn(globalThis, "assignedGlobal"), Object.hasOwn(globalThis, "Array"), Object.hasOwn(globalThis, "nope"));
console.log("arrays:", Object.hasOwn([1, , 3], 0), Object.hasOwn([1, , 3], 1), Object.hasOwn([1], "length"));
