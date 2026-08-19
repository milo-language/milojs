// console.log of a cyclic value printed a depth-limited EXPANSION,
// `{ x: 1, self: { x: 1, self: [Object] } }`, which reads as real nesting that is
// not there. node marks the cycle instead, and numbering the reference needs two
// passes: the `<ref *N>` marker belongs on the object referred BACK to, which is
// only known once the whole graph has been walked.
//
// Map and Set entries live in the side table rather than in props or elems, so the
// first pass has to walk those separately; without it a Map cycle printed
// `[Circular *0]` with no matching `<ref *1>`.
var a = { x: 1 }; a.self = a; console.log(a);
var b = [1]; b.push(b); console.log(b);
var c = {}, d = { c: c }; c.d = d; console.log(c);
var deep = { l1: { l2: {} } }; deep.l1.l2.back = deep; console.log(deep);
var m = new Map(); m.set("k", m); console.log(m);
var s = new Set(); s.add(s); console.log(s);
var arrPair = []; var holder = { arr: arrPair }; arrPair.push(holder); console.log(holder);

// Repeats that are NOT cycles must still print in full, twice.
var x = { v: 1 }; console.log({ p: x, q: x });
var y = [1]; console.log([y, y]);

// and ordinary nesting is unchanged
console.log({ a: { b: { c: 1 } } });
console.log([1, [2, [3]]]);
console.log(new Map([["a", 1]]), new Set([1, 2]));
