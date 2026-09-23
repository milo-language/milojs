// Typed-array methods live on %TypedArray%.prototype, the shared parent of all
// eleven concrete prototypes, and dispatch through it: an override there or on
// a concrete or subclass prototype is honoured, extracted methods are the
// prototype's own functions, and a receiver that is not a typed array is a
// TypeError. Reads used to synthesise a bound method per access, and the
// override check stopped at the concrete prototype.

function tryIt(label, f) {
  try {
    console.log(label, f());
  } catch (e) {
    console.log(label, e.constructor.name);
  }
}

const TypedArray = Object.getPrototypeOf(Int8Array);
const TAP = TypedArray.prototype;
const kinds = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array,
  Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array];
console.log("parent:", kinds.every((K) => Object.getPrototypeOf(K) === TypedArray && Object.getPrototypeOf(K.prototype) === TAP));
console.log("TypedArray:", TypedArray.name, TypedArray.length, Object.getOwnPropertyNames(TypedArray).join());
for (const k of ["of", "from"]) {
  const d = Object.getOwnPropertyDescriptor(TypedArray, k);
  console.log(" ", k, d.value.length, d.value.name, d.writable, d.enumerable, d.configurable);
}
console.log("statics inherited:", Object.prototype.hasOwnProperty.call(Float64Array, "from"), Float64Array.from === TypedArray.from, BigInt64Array.of(1n, 2n).join());
console.log(Object.getOwnPropertyNames(TAP).join());
for (const k of Reflect.ownKeys(TAP)) {
  const d = Object.getOwnPropertyDescriptor(TAP, k);
  if (typeof d.value === "function" && k !== "constructor") {
    console.log(" ", String(k), d.value.length, d.value.name, d.writable, d.enumerable, d.configurable);
  } else if (d.get) {
    console.log(" ", String(k), "get", d.get.name, d.get.length, d.set, d.enumerable, d.configurable);
  }
}
console.log("shared functions:", TAP[Symbol.iterator] === TAP.values, TAP.toString === Array.prototype.toString);
console.log("Int16Array:", Object.getOwnPropertyNames(Int16Array).join(), "/", Object.getOwnPropertyNames(Int16Array.prototype).join());
const tagGet = Object.getOwnPropertyDescriptor(TAP, Symbol.toStringTag).get;
console.log("tag:", tagGet.call(new Float32Array(1)), tagGet.call({}), tagGet.call(3), Object.prototype.toString.call(new Uint8ClampedArray(1)));

const u = new Uint8Array([10, 20, 30]);

// identity and computed access
console.log("identity:", u.at === TAP.at, u.map === TAP.map, u["a" + "t"] === u.at, u.at === new Float64Array(1).at);
console.log("computed:", u["a" + "t"](-1), u["inc" + "ludes"](20), u.at(0), u.join("-"), String(u));

// brand checks
tryIt("at on array:", () => TAP.at.call([1, 2], 0));
tryIt("map on plain:", () => TAP.map.call({ length: 1, 0: 1 }, (x) => x));
tryIt("fill on DataView:", () => TAP.fill.call(new DataView(new ArrayBuffer(4)), 1));
tryIt("length on plain:", () => Object.getOwnPropertyDescriptor(TAP, "length").get.call({}));
tryIt("Object.create receiver:", () => Object.create(Uint8Array.prototype).at(0));
tryIt("extracted:", () => { const g = u.at; return g.call(new Int16Array([7, 8]), 1); });
tryIt("extracted unbound:", () => { const g = u.at; return g(0); });

// override on %TypedArray%.prototype reaches every kind
const origAt = TAP.at;
TAP.at = function (i) { return "shared " + i; };
console.log("shared override:", u.at(1), new Float64Array(2).at(0), u["at"](2));
TAP.at = origAt;
console.log("restored:", u.at(1));

// override on one concrete prototype reaches only that kind
Uint8Array.prototype.includes = function () { return "u8 only"; };
console.log("concrete override:", u.includes(10), new Int8Array([10]).includes(10));
delete Uint8Array.prototype.includes;
console.log("concrete removed:", u.includes(10));

// subclass prototype override
class Tagged extends Uint16Array {
  map(fn) { return "sub " + super.map(fn).join(","); }
}
const t = new Tagged([1, 2]);
console.log("subclass:", t.map((x) => x * 3), t.at(1), t instanceof Uint16Array, t.at === TAP.at, Object.prototype.toString.call(t));

// deleting a method removes it
const savedFill = TAP.fill;
delete TAP.fill;
tryIt("deleted:", () => u.fill(0));
console.log("in:", "fill" in u);
TAP.fill = savedFill;
console.log("put back:", u.fill(5).join());

// an own property shadows the prototype
u.join = () => "own";
console.log("shadow:", u.join(), delete u.join, u.join());
