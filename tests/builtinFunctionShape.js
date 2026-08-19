// Two things every built-in function owes, and one idiom that reaches for them.
//
// 1. THE UNCURRY-THIS IDIOM. `Function.prototype.call.bind(f)` turns a method
//    into a standalone function taking the receiver as its first argument.
//    milojs returned undefined for it whenever `f` was a BUILT-IN (a plain JS
//    function worked), because the call arrived at the builtin dispatcher as
//    receiver = the builtin, name = "call", and nothing handled that. test262's
//    propertyHelper.js is built entirely out of this idiom, so every
//    verifyProperty test in the suite failed before looking at any property.
//
// 2. OWN `name` AND `length`, with the spec's
//    { writable: false, enumerable: false, configurable: true }. The arity table
//    is generated from node — see builtinArity / builtinStaticArity in
//    src/engine/eval.milo, and docs/backlog.md for how to regenerate it.
const hop = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
const join = Function.prototype.call.bind(Array.prototype.join);
const pie = Function.prototype.call.bind(Object.prototype.propertyIsEnumerable);
const applyJoin = Function.prototype.apply.bind(Array.prototype.join);
console.log(hop({ a: 1 }, 'a'), hop({ a: 1 }, 'b'));
console.log(join([1, 2, 3], '-'), applyJoin([4, 5], ['+']));
console.log(pie({ a: 1 }, 'a'), pie([], 'length'));
console.log(hop(Array.prototype.every, 'length'), hop(Array.prototype.every, 'name'));

// re-binding a built-in, and binding one with leading arguments
const boundJoin = Function.prototype.call.bind(Array.prototype.join);
console.log(boundJoin([7, 8], '|'));
const sliceOf = Function.prototype.call.bind(Array.prototype.slice);
console.log(sliceOf([1, 2, 3, 4], 1, 3).join(','));

// name / length as real own properties with the right attributes
const d = (o, k) => JSON.stringify(Object.getOwnPropertyDescriptor(o, k));
console.log(d(Array.prototype.every, 'length'), d(Array.prototype.every, 'name'));
console.log(JSON.stringify(Object.getOwnPropertyNames(Array.prototype.forEach).sort()));
console.log(Array.prototype.push.length, String.prototype.replace.length, String.prototype.padStart.length);
console.log(Int8Array.prototype.fill.length, Int8Array.prototype.set.length, DataView.prototype.setInt32.length);
console.log(Object.keys.length, Object.assign.length, Object.defineProperty.length);
console.log(Array.prototype.keys.length, Object.keys.length);

// configurable: deletable and redefinable, which is what verifyProperty checks
const f = Array.prototype.some;
console.log(delete f.length, Object.prototype.hasOwnProperty.call(f, 'length'));
Object.defineProperty(f, 'length', { value: 1, writable: false, enumerable: false, configurable: true });
console.log(f.length);

// Date instances link Date.prototype
const dt = new Date(0);
console.log(Object.getPrototypeOf(dt) === Date.prototype, dt instanceof Date);
console.log(Date.prototype.getTime.call(dt), dt.getTime.name, dt.getTime.length);
