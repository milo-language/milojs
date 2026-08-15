// Number, Boolean, Symbol, BigInt, Map, Set and Promise had NO prototype
// object — `Number.prototype` read as undefined. That is the same gap the
// buffer family, Date and RegExp each turned out to have, and this is the sweep
// that finishes it: every remaining constructor now has one.
//
// Two more bugs fell out:
//   * A primitive receiver reaching a built-in method value fell through to the
//     generic tag, so Number.prototype.toString.call(255, 16) returned
//     '[object Number]' instead of 'ff'.
//   * Assigning to a native constructor's property ignored writability, so
//     `Boolean.prototype = x` replaced it even though a built-in prototype is
//     { writable: false, enumerable: false, configurable: false }.

const ctors = ['Object','Array','String','Number','Boolean','Symbol','Date','RegExp','Error','Map','Set','WeakMap','WeakSet','Promise','ArrayBuffer','DataView','Int8Array','BigInt'];
for (const n of ctors) { const C = globalThis[n]; console.log(n, typeof C.prototype); }

const m = new Map([['a',1]]); const s = new Set([1,2]);
console.log(Object.getPrototypeOf(m) === Map.prototype, Object.getPrototypeOf(s) === Set.prototype);
console.log(Map.prototype.get.call(m,'a'), Map.prototype.has.call(m,'a'));
console.log(Set.prototype.has.call(s,2), [...Set.prototype.values.call(s)].join(','));
console.log(m.get('a'), m.size, s.size, m instanceof Map, s instanceof Set);
const p = Promise.resolve(1);
console.log(Object.getPrototypeOf(p) === Promise.prototype, p instanceof Promise, typeof Promise.prototype.then);
console.log(Number.prototype.toFixed.call(1.2345, 2), Number.prototype.toString.call(255, 16));
console.log(Boolean.prototype.toString.call(true), Boolean.prototype.valueOf.call(false));
console.log((5).toFixed(1), (255).toString(16), true.toString());
console.log(typeof BigInt.prototype.toString, BigInt.prototype.toString.call(10n));
console.log(typeof Symbol.prototype.toString);
console.log(Object.getOwnPropertyDescriptor(Map.prototype,'get').enumerable, Map.prototype.get.name, Map.prototype.get.length);
p.then(v => console.log('then still works', v));

// a built-in prototype is non-writable, non-enumerable, non-configurable.
// Only the ATTRIBUTES are asserted: Number.prototype's VALUE is a Number object
// wrapping 0 in node and a plain object here — a separate gap, see
// docs/backlog.md — and JSON.stringify(Date.prototype) throws in node.
for (const n of ['Number','Boolean','Map','Set','RegExp','Date','Promise','ArrayBuffer']) {
  const d = Object.getOwnPropertyDescriptor(globalThis[n], 'prototype');
  console.log(n, d.writable, d.enumerable, d.configurable);
}
const before = Number.prototype;
Number.prototype = {};
console.log('write dropped:', Number.prototype === before);
