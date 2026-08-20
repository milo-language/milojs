// A coercion argument runs USER code, and that code can detach the buffer the
// method is about to write into. Every length read before the coercion is stale
// afterwards. Writing on the stale bound aborted the process with
// "index out of bounds: 0/0" — not a throw, a SIGABRT, which no program can
// catch and no test can report as a failure.
const detach = (b) => { if (typeof b.transfer === 'function') b.transfer(); };
const t = (label, f) => {
  try { const r = f(); console.log(label, 'returned', String(r)); }
  catch (e) { console.log(label, 'threw', e.constructor.name); }
};

t('copyWithin start detaches', () => {
  const ta = new Int8Array(8);
  return ta.copyWithin({ valueOf() { detach(ta.buffer); return 0; } }, 2);
});
t('copyWithin end detaches', () => {
  const ta = new Int8Array(8);
  return ta.copyWithin(0, 2, { valueOf() { detach(ta.buffer); return 8; } });
});
t('fill value coercion detaches', () => {
  const ta = new Int8Array(8);
  return ta.fill({ valueOf() { detach(ta.buffer); return 1; } });
});
t('fill end detaches', () => {
  const ta = new Int8Array(8);
  return ta.fill(1, 0, { valueOf() { detach(ta.buffer); return 8; } });
});
t('DataView set value detaches', () => {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  return dv.setInt8(0, { valueOf() { detach(buf); return 1; } });
});
t('sort comparator detaches', () => {
  const ta = new Int8Array([3, 1, 2]);
  return ta.sort(() => { detach(ta.buffer); return 0; });
});
console.log('survived');
