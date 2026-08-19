// A Proxy wrapping an array, through the operations that have a fast path for
// real arrays. Both halves are observable: the RESULT, and how many traps ran.
// milojs answered false for Array.isArray(proxy) -- IsArray follows the target
// -- so JSON.stringify produced an object, Object.keys came back empty, and
// for-of/spread/Array.from threw "not iterable" because Symbol.iterator was read
// raw instead of through the get trap. Object.values/entries/assign and
// {...proxy} walked the proxy's own (empty) property table.
const OPS = [
  ["at", a => a.at(1)],
  ["indexOf", a => a.indexOf(3)],
  ["includes", a => a.includes(3)],
  ["find", a => a.find(x => x === 3)],
  ["slice", a => a.slice(0, 3)],
  ["concat", a => a.concat([9])],
  ["join", a => a.join(",")],
  ["map", a => a.map(x => x)],
  ["filter", a => a.filter(() => true)],
  ["forEach", a => { const o = []; a.forEach(x => o.push(x)); return o; }],
  ["reduce", a => a.reduce((s, x) => s + x, 0)],
  ["every", a => a.every(x => x > 0)],
  ["reverse", a => a.reverse()],
  ["sort", a => a.sort()],
  ["flat", a => a.flat()],
  ["fill", a => a.fill(7, 3)],
  ["toString", a => a.toString()],
  ["pop", a => a.pop()],
  ["shift", a => a.shift()],
  ["splice", a => a.splice(1, 1)],
  ["spread", a => [...a].join("|")],
  ["ArrayFrom", a => Array.from(a).join("|")],
  ["forOf", a => { let s = ""; for (const x of a) s += x; return s; }],
  ["JSONstringify", a => JSON.stringify(a)],
  ["ObjectKeys", a => Object.keys(a).join("|")],
  ["ObjectValues", a => Object.values(a).join("|")],
  ["ObjectEntries", a => Object.entries(a).length],
  ["ObjectAssign", a => JSON.stringify(Object.assign({}, a))],
  ["objSpread", a => JSON.stringify({ ...a })],
  ["hasIn", a => 1 in a],
  ["deleteIdx", a => { delete a[1]; return a.length; }],
  ["setIdx", a => { a[0] = 99; return a[0]; }],
];
for (const [name, fn] of OPS) {
  const log = [];
  const target = [1, 2, 3, 4];
  const p = new Proxy(target, {
    get(t, k, r) { if (typeof k === "string") log.push("get:" + k); return Reflect.get(t, k, r); },
    set(t, k, v, r) { log.push("set:" + k); return Reflect.set(t, k, v, r); },
    has(t, k) { log.push("has:" + k); return Reflect.has(t, k); },
    deleteProperty(t, k) { log.push("del:" + k); return Reflect.deleteProperty(t, k); },
    ownKeys(t) { log.push("ownKeys"); return Reflect.ownKeys(t); },
    getOwnPropertyDescriptor(t, k) { log.push("gopd:" + k); return Reflect.getOwnPropertyDescriptor(t, k); },
  });
  let out;
  try { out = JSON.stringify(fn(p)); } catch (e) { out = "threw:" + e.constructor.name; }
  // The trap COUNT is also observable and milojs does not yet match node on it
  // (it runs a different number of [[Get]]/[[HasProperty]] steps per method);
  // that is tracked in docs/backlog.md. What this fixture locks is the RESULT,
  // and that at least one trap ran, so a future fast path cannot bypass the
  // proxy entirely and still pass.
  console.log(name, out, log.length > 0 ? "trapped" : "NO TRAPS");
}
