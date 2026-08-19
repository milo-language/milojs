// Every Array method that does a real [[Get]] per index, against an array with
// an own ACCESSOR at index 1. Two things are observable and both were wrong: the
// value the method sees (a raw element read returned the stale dense slot, so 22
// of these 38 disagreed with node) and HOW MANY TIMES the getter runs, which the
// spec fixes at one per index. `find` re-read the element after the loop and
// `filter` read it separately from the callback arguments, so both called the
// getter twice.
const METHODS = [
  ["at", a => a.at(1)],
  ["indexOf", a => a.indexOf(42)],
  ["lastIndexOf", a => a.lastIndexOf(42)],
  ["includes", a => a.includes(42)],
  ["find", a => a.find(x => x === 42)],
  ["findIndex", a => a.findIndex(x => x === 42)],
  ["findLast", a => a.findLast(x => x === 42)],
  ["findLastIndex", a => a.findLastIndex(x => x === 42)],
  ["slice", a => a.slice(0, 3)],
  ["concat", a => a.concat([9])],
  ["join", a => a.join(",")],
  ["map", a => a.map(x => x)],
  ["filter", a => a.filter(() => true)],
  ["forEach", a => { const o = []; a.forEach(x => o.push(x)); return o; }],
  ["reduce", a => a.reduce((s, x) => s + String(x), "")],
  ["reduceRight", a => a.reduceRight((s, x) => s + String(x), "")],
  ["some", a => a.some(x => x === 42)],
  ["every", a => a.every(x => x !== undefined)],
  ["reverse", a => a.reverse()],
  ["sort", a => a.sort()],
  ["flat", a => a.flat()],
  ["flatMap", a => a.flatMap(x => [x])],
  ["fill", a => a.fill(7, 2)],
  ["copyWithin", a => a.copyWithin(0, 1)],
  ["pop", a => a.pop()],
  ["shift", a => a.shift()],
  ["splice", a => a.splice(1, 1)],
  ["toString", a => a.toString()],
  ["toSorted", a => a.toSorted()],
  ["toReversed", a => a.toReversed()],
  ["toSpliced", a => a.toSpliced(1, 1)],
  ["with", a => a.with(0, 5)],
  ["entries", a => [...a.entries()].length],
  ["keys", a => [...a.keys()].length],
  ["values", a => [...a.values()].join("|")],
  ["ArrayFrom", a => Array.from(a).join("|")],
  ["spread", a => [...a].join("|")],
  ["JSONstringify", a => JSON.stringify(a)],
];
for (const [name, fn] of METHODS) {
  let hits = 0;
  const a = [1, undefined, 3, 4];
  Object.defineProperty(a, 1, { get() { hits++; return 42; }, set() {}, configurable: true, enumerable: true });
  let out;
  try { out = JSON.stringify(fn(a)); } catch (e) { out = "threw:" + e.constructor.name; }
  console.log(name, "getter=" + hits, out);
}
