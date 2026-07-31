// A default on a nested sub-pattern: the `=` only appears after the sub-pattern's
// closing brace, so the temp holding it has to be bound with the default applied
// before the unpacking reads it.
const { b: { c } = { c: 2 } } = {};
const { b: { c: c2 } = { c: 9 } } = { b: { c: 7 } };
const [[x] = [9]] = [];
const { p = 1, q: { r } = { r: 2 }, s: [t] = [3] } = {};
console.log(c, c2, x, p, r, t);
function f({ b: { c } = { c: 4 } } = {}) { return c; }
console.log(f(), f({ b: { c: 1 } }), f({}));
const { a: { b: z } = { b: 8 } } = {};
console.log(z);
