// Array.prototype methods applied to a generic array-like receiver, which is
// what test262 does constantly and what a polyfill does to `arguments`. milojs
// adapts such a receiver into a scratch array and writes back afterwards, and two
// things were wrong with that: reverse/sort/fill/copyWithin returned the SCRATCH
// instead of the receiver the spec says they return, so the caller got a plain
// array and lost every non-index property; and concat saw a real array and
// spread it, where IsConcatSpreadable is false for a plain object receiver.
const A = Array.prototype;
const OPS = [
  ["at", o => A.at.call(o, 1)],
  ["indexOf", o => A.indexOf.call(o, 3)],
  ["lastIndexOf", o => A.lastIndexOf.call(o, 3)],
  ["includes", o => A.includes.call(o, 3)],
  ["find", o => A.find.call(o, x => x === 3)],
  ["findIndex", o => A.findIndex.call(o, x => x === 3)],
  ["findLast", o => A.findLast.call(o, x => x === 3)],
  ["slice", o => A.slice.call(o, 0, 3)],
  ["concat", o => A.concat.call(o, [9])],
  ["join", o => A.join.call(o, ",")],
  ["toString", o => A.toString.call(o)],
  ["map", o => A.map.call(o, x => x)],
  ["filter", o => A.filter.call(o, () => true)],
  ["forEach", o => { const r = []; A.forEach.call(o, x => r.push(x)); return r; }],
  ["reduce", o => A.reduce.call(o, (s, x) => s + x, 0)],
  ["reduceRight", o => A.reduceRight.call(o, (s, x) => s + x, 0)],
  ["some", o => A.some.call(o, x => x === 3)],
  ["every", o => A.every.call(o, x => x > 0)],
  ["reverse", o => JSON.stringify(A.reverse.call(o))],
  ["sort", o => JSON.stringify(A.sort.call(o))],
  ["flat", o => A.flat.call(o)],
  ["flatMap", o => A.flatMap.call(o, x => [x])],
  ["fill", o => JSON.stringify(A.fill.call(o, 7, 3))],
  ["copyWithin", o => JSON.stringify(A.copyWithin.call(o, 0, 1))],
  ["push", o => { const n = A.push.call(o, 5); return n + ":" + o.length; }],
  ["pop", o => A.pop.call(o) + ":" + o.length],
  ["shift", o => A.shift.call(o) + ":" + o.length],
  ["unshift", o => A.unshift.call(o, 0) + ":" + o.length],
  ["splice", o => JSON.stringify(A.splice.call(o, 1, 1))],
  ["toSorted", o => A.toSorted.call(o)],
  ["toReversed", o => A.toReversed.call(o)],
  ["with", o => A.with.call(o, 0, 5)],
  ["keys", o => [...A.keys.call(o)].length],
  ["entries", o => [...A.entries.call(o)].length],
  ["values", o => [...A.values.call(o)].join("|")],
  ["ArrayFrom", o => Array.from(o).join("|")],
];
for (const [name, fn] of OPS) {
  const o = { 0: 1, 1: 2, 2: 3, 3: 4, length: 4 };
  let out;
  try { out = JSON.stringify(fn(o)); } catch (e) { out = "threw:" + e.constructor.name; }
  console.log(name, out);
}
