// How a for-in/for-of head BINDS its variable, and what may appear as the head.
// The AST used to store only a name, so every form got a fresh per-iteration
// binding and any target that was not a bare identifier failed to parse.

// `let`/`const` bind per iteration: each closure captures its own value.
const letCaps = [];
for (let k in { a: 1, b: 2 }) letCaps.push(() => k);
const constCaps = [];
for (const v of [1, 2, 3]) constCaps.push(() => v);
console.log(letCaps.map(f => f()).join(","), constCaps.map(f => f()).join(","));

// `var` is ONE function-scoped binding: the closures share it, and it outlives
// the loop holding the last value.
const varCaps = [];
for (var w of [1, 2]) varCaps.push(() => w);
for (var j in { a: 1, b: 2 }) {}
console.log(varCaps.map(f => f()).join(","), w, j);

// A bare head assigns an existing variable rather than declaring one.
var bare;
for (bare in { c: 1, d: 2 }) {}
console.log(bare);

// The head may be any assignment target, not just an identifier.
var obj = {}, arr = [];
for (obj.x in { p: 1, q: 2 }) {}
for (obj.y of [7, 8]) {}
for (arr[0] in { z: 1 }) {}
console.log(obj.x, obj.y, arr[0]);

// Annex B: a `var` head may carry an initializer. It really runs, which is only
// visible when the object is empty and no key overwrites it.
var t = [];
for (var k1 = 2 in { x: 0, y: 1 }) t.push(k1);
var u = [];
for (var k2 = 9 in {}) u.push(k2);
console.log(t.join(","), k1, u.length, k2);

// Destructuring heads still work.
for (const [a, b] of [[1, 2]]) console.log(a, b);
