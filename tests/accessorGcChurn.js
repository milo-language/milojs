// accessor slots under GC pressure: define, delete, recycle, re-read
let live = [];
for (let i = 0; i < 200; i++) {
  const o = {};
  Object.defineProperty(o, 'v', { get: function () { return i * 2; }, configurable: true });
  if (i % 2 === 0) live.push(o); else { delete o.v; }
  // churn: objects that die immediately, each owning an accessor
  for (let j = 0; j < 10; j++) {
    const tmp = {};
    Object.defineProperty(tmp, 'k', { get: function () { return j; }, configurable: true });
    if (tmp.k !== j) { console.log('BAD tmp', i, j, tmp.k); }
  }
}
let sum = 0;
for (const o of live) sum += o.v;
console.log('sum', sum);
// redefine over an existing accessor, then convert to a data property
const p = {};
Object.defineProperty(p, 'x', { get: () => 1, configurable: true });
Object.defineProperty(p, 'x', { get: () => 2, configurable: true });
console.log('redef', p.x);
console.log('afterDelete', (delete p.x, p.x));
