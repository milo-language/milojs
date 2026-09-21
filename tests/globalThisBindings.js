// A builtin global's descriptor on globalThis is
// writable, non-enumerable, configurable, the value constants are frozen, and
// a program's own var is writable, enumerable, non-configurable.
console.log(typeof this, (() => this)() === this, typeof globalThis);
var d = Object.getOwnPropertyDescriptor(globalThis, "parseInt");
console.log(d.writable, d.enumerable, d.configurable, typeof d.value, d.value === parseInt);
for (const k of ["NaN", "Infinity", "undefined"]) { const c = Object.getOwnPropertyDescriptor(globalThis, k); console.log(k, c.writable, c.enumerable, c.configurable, String(c.value)); }
globalThis.mine2 = 2;
var m2 = Object.getOwnPropertyDescriptor(globalThis, "mine2"); console.log([m2.writable, m2.enumerable, m2.value].join(","), mine2);
console.log(Object.getOwnPropertyDescriptor(globalThis, "Array").enumerable, Object.getOwnPropertyDescriptor(globalThis, "nope"), "Math" in globalThis);
var o = { f() { return this; } }; console.log(o.f() === o, (0, o.f)() === globalThis, (function() { "use strict"; return this; })(), [1].map(function() { return this; })[0] === globalThis);
