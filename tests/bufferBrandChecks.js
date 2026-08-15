// The buffer family's methods are NOT generic. node throws a TypeError when
// `this` is the wrong kind — but milojs dispatches built-in methods by NAME, so
// a receiver that merely looked array-like silently got a plausible answer:
// Int8Array.prototype.join.call([1,2], '-') returned "1-2" instead of throwing.
//
// Array.prototype IS generic, so the same mechanism is correct there. The
// difference is now carried explicitly: a bound method built for %TypedArray%,
// ArrayBuffer or DataView records its brand and checks the receiver first.
const show = (label, f) => {
  try { const r = f(); console.log(label, '->', typeof r); }
  catch (e) { console.log(label, '->', e.constructor.name); }
};

show('ArrayBuffer.prototype.slice on {}', () => ArrayBuffer.prototype.slice.call({}, 0));
show('ArrayBuffer.prototype.slice on []', () => ArrayBuffer.prototype.slice.call([], 0));
show('ArrayBuffer.prototype.slice on a view', () => ArrayBuffer.prototype.slice.call(new Int8Array(4), 0));
show('DataView.prototype.getInt8 on {}', () => DataView.prototype.getInt8.call({}, 0));
show('DataView.prototype.getInt8 on a buffer', () => DataView.prototype.getInt8.call(new ArrayBuffer(4), 0));
show('TypedArray map on {}', () => Int8Array.prototype.map.call({}, x => x));
show('TypedArray join on []', () => Int8Array.prototype.join.call([1, 2], '-'));
show('TypedArray at on a string', () => Int8Array.prototype.at.call('ab', 0));

// the same methods still work on the right receivers
const buf = new ArrayBuffer(8);
const view = new Int8Array([1, 2, 3]);
const dv = new DataView(buf);
console.log(ArrayBuffer.prototype.slice.call(buf, 0, 4).byteLength);
console.log(Int8Array.prototype.join.call(view, '-'));
DataView.prototype.setInt8.call(dv, 0, 42);
console.log(DataView.prototype.getInt8.call(dv, 0));

// Array.prototype stays generic — that is the contrast the brand exists for
console.log(Array.prototype.join.call({ 0: 'a', 1: 'b', length: 2 }, '-'));
console.log(Array.prototype.slice.call({ 0: 'a', length: 1 }).length);

// a bound buffer method keeps its brand across bind()
const boundJoin = Int8Array.prototype.join.bind(view);
console.log(boundJoin('+'));
show('bound to the wrong kind', () => Int8Array.prototype.join.bind([1, 2])('+'));

// ArrayBuffer.isView: true for any view, false for a buffer
console.log(ArrayBuffer.isView(view), ArrayBuffer.isView(dv), ArrayBuffer.isView(buf), ArrayBuffer.isView({}), ArrayBuffer.isView(null));
