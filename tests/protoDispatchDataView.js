// DataView methods dispatch through DataView.prototype: an override is
// honoured, extracted methods are the prototype's own functions, and a receiver
// that is not a DataView is a TypeError. Reads used to synthesise a fresh bound
// method per access, so none of that held.

function tryIt(label, f) {
  try {
    console.log(label, f());
  } catch (e) {
    console.log(label, e.constructor.name);
  }
}

console.log(Object.getOwnPropertyNames(DataView.prototype).join());
for (const k of Object.getOwnPropertyNames(DataView.prototype)) {
  const d = Object.getOwnPropertyDescriptor(DataView.prototype, k);
  if (typeof d.value === "function" && k !== "constructor") {
    console.log(" ", k, d.value.length, d.value.name, d.writable, d.enumerable, d.configurable);
  } else if (d.get) {
    console.log(" ", k, "get", d.get.name, d.get.length, d.set, d.enumerable, d.configurable);
  }
}
console.log(DataView.prototype[Symbol.toStringTag]);

const buf = new ArrayBuffer(16);
const dv = new DataView(buf);
dv.setUint16(0, 0x1234);
console.log("values:", dv.getUint8(0), dv.getUint8(1), dv.getUint16(0, true), dv.byteLength, dv.buffer === buf);

// identity and computed access
console.log("identity:", dv.getInt8 === DataView.prototype.getInt8, dv.setFloat64 === DataView.prototype.setFloat64, dv["get" + "Uint8"] === dv.getUint8);
console.log("computed:", dv["get" + "Uint16"](0));

// the BigInt64 and Float16 accessors
dv.setBigInt64(0, -5n);
console.log("bigint:", dv.getBigInt64(0), dv.getBigUint64(0), dv.getBigInt64(0, true));
dv.setBigUint64(8, 2n ** 64n - 1n, true);
console.log("biguint:", dv.getBigUint64(8, true), dv.getBigInt64(8, true));
for (const bad of [1, undefined, null, Symbol("s")]) tryIt("setBigInt64 " + typeof bad + ":", () => dv.setBigInt64(0, bad));
dv.setBigInt64(0, { valueOf() { return 7n; } });
console.log("ToBigInt object:", dv.getBigInt64(0));
for (const v of [1, -1, 65504, 65520, 0.1, -0, NaN, -Infinity, 1.00048828125, 1.000732421875, 6.103515625e-5]) {
  dv.setFloat16(0, v);
  dv.setFloat16(2, v, true);
  console.log("float16:", Object.is(v, -0) ? "-0" : v, dv.getUint16(0), dv.getUint16(2, true), dv.getFloat16(0) === dv.getFloat16(2, true) || Number.isNaN(dv.getFloat16(0)));
}
console.log("float16 subnormal:", dv.getUint16(0, false), (dv.setFloat16(0, 2 ** -24), dv.getUint16(0)), (dv.setFloat16(0, 2 ** -25), dv.getUint16(0)), (dv.setFloat16(0, 3 * 2 ** -26), dv.getUint16(0)));

// brand checks
tryIt("getInt8 on plain:", () => DataView.prototype.getInt8.call({}, 0));
tryIt("getInt8 on Uint8Array:", () => DataView.prototype.getInt8.call(new Uint8Array(4), 0));
tryIt("setInt8 on ArrayBuffer:", () => DataView.prototype.setInt8.call(buf, 0, 1));
tryIt("byteLength on plain:", () => Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get.call({}));
tryIt("Object.create receiver:", () => Object.create(DataView.prototype).getInt8(0));
tryIt("extracted:", () => { const g = dv.getUint8; return g.call(new DataView(new ArrayBuffer(2)), 1); });
tryIt("extracted unbound:", () => { const g = dv.getUint8; return g(0); });

// override on the prototype
const origGetInt8 = DataView.prototype.getInt8;
DataView.prototype.getInt8 = function (i) { return "patched " + i; };
console.log("override:", dv.getInt8(3), dv["getInt8"](4));
DataView.prototype.getInt8 = origGetInt8;
console.log("restored:", dv.getInt8(1));

// subclass prototype override
class DV extends DataView {
  getUint8(i) { return "sub " + super.getUint8(i); }
}
const sdv = new DV(new ArrayBuffer(4));
sdv.setUint8(1, 9);
console.log("subclass:", sdv.getUint8(1), sdv instanceof DataView, sdv.setUint8 === DataView.prototype.setUint8, Object.prototype.toString.call(sdv));

// deleting a method removes it
const savedSet = DataView.prototype.setUint32;
delete DataView.prototype.setUint32;
tryIt("deleted:", () => dv.setUint32(0, 1));
console.log("in:", "setUint32" in dv);
DataView.prototype.setUint32 = savedSet;
dv.setUint32(0, 0xdeadbeef);
console.log("put back:", dv.getUint32(0).toString(16));

// an own property shadows the prototype
dv.getInt16 = () => "own";
console.log("shadow:", dv.getInt16(0), delete dv.getInt16, typeof dv.getInt16(0));
