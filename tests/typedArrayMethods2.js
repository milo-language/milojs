// The rest of %TypedArray%.prototype — copyWithin, lastIndexOf, keys/values/
// entries, toReversed, toSorted, toLocaleString, [Symbol.iterator] — plus what a
// view does once its buffer is detached.
//
// Detachment was tracked on the ArrayBuffer but no view ever consulted it: a
// detached view still reported its old length, still filled, and still read its
// stale bytes. The spec makes it behave as a zero-length view for
// length/byteLength/byteOffset, undefined at every index, a dropped write, and a
// TypeError from every prototype method.

const a = new Int32Array([5,1,4,1,5,9]);
console.log([...a.keys()].join(','));
console.log([...a.values()].join(','));
console.log(JSON.stringify([...a.entries()]));
console.log([...a].join(','));
console.log(a.lastIndexOf(1), a.lastIndexOf(1, 1), a.lastIndexOf(7), a.lastIndexOf(5, -2));
console.log([...a.toReversed()].join(','));
console.log([...a.toSorted()].join(','));
console.log([...a.toSorted((x,y)=>y-x)].join(','));
console.log(a.toLocaleString());
console.log([...a].join(','), 'unchanged after toSorted');
const c = new Int8Array([1,2,3,4,5]);
console.log([...c.copyWithin(0,3)].join(','));
const d = new Int8Array([1,2,3,4,5]);
console.log([...d.copyWithin(1,0,3)].join(','));
const e = new Int8Array([1,2,3,4,5]);
console.log([...e.copyWithin(-2,-4,-1)].join(','));
console.log(typeof Int32Array.prototype.copyWithin, typeof Int32Array.prototype.entries, typeof Int32Array.prototype[Symbol.iterator]);
for (const [i,v] of new Uint8Array([7,8]).entries()) console.log('e', i, v);
console.log(Array.from(new Uint8Array([1,2,3]).values()).join('-'));

const b = new ArrayBuffer(8);
const ta = new Int8Array(b);
const t = b.transfer();
console.log('src detached:', b.detached, 'byteLength', b.byteLength);
console.log('new byteLength', t.byteLength);
try { console.log('ta.length after detach', ta.length); } catch(e) { console.log('ta.length threw', e.constructor.name); }
try { ta.fill(1); console.log('fill ok'); } catch(e) { console.log('fill threw', e.constructor.name); }
try { console.log('ta[0]', ta[0]); } catch(e) { console.log('idx threw', e.constructor.name); }

// detached: methods throw, indices read undefined, writes are dropped
const b2 = new ArrayBuffer(4);
const v2 = new Uint8Array(b2);
v2[0] = 9;
b2.transfer();
console.log(v2.length, v2.byteLength, v2.byteOffset, v2[0]);
v2[0] = 42;
console.log('write dropped ->', v2[0]);
for (const m of ['fill', 'map', 'slice', 'join', 'indexOf', 'copyWithin', 'toSorted', 'entries']) {
  try { v2[m](() => 0); console.log(m, 'did NOT throw'); }
  catch (e) { console.log(m, e.constructor.name); }
}
