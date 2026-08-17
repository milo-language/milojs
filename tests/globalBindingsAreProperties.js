// A top-level binding lives in the global scope but is still a property of the
// global object: own-key queries have to agree with a bare read. Indirect eval
// declares in global scope under node's module wrapper too, so this fixture
// means the same thing in both engines.
(0, eval)("function topFn() { return 1; } var topVar = 2;");

console.log(Object.prototype.hasOwnProperty.call(globalThis, "topFn"));
console.log(Object.prototype.hasOwnProperty.call(globalThis, "topVar"));
console.log("topVar" in globalThis, "nothingHere" in globalThis);
const d = Object.getOwnPropertyDescriptor(globalThis, "topVar");
console.log(d.value, d.writable, d.enumerable);
console.log(globalThis.topFn(), typeof globalThis.topVar);
globalThis.topVar = 5;
console.log((0, eval)("topVar"));
