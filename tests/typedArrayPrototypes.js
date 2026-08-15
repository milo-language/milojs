// The %TypedArray% intrinsic and real `prototype` objects for the buffer family.
//
// Typed arrays were pure name dispatch here: `Int8Array.prototype` was undefined
// and the methods existed only as a whitelist checked on the property path. That
// is invisible until something reaches for the intrinsic — test262's
// testTypedArray.js harness opens with
//   var TypedArray = Object.getPrototypeOf(Int8Array)
// and then reads TypedArray.prototype for nearly every assertion, and its
// resizable-buffer section starts with `if (ArrayBuffer.prototype.resize)`.
// Both read a property of undefined, so the whole built-ins/TypedArray tree
// (1446 cases) threw before running a line of its own.
const TypedArray = Object.getPrototypeOf(Int8Array);
console.log(typeof TypedArray, TypedArray.name);
console.log(typeof TypedArray.prototype, typeof TypedArray.prototype.map);
console.log(Object.getPrototypeOf(Uint8Array) === TypedArray);
console.log(Object.getPrototypeOf(Float64Array.prototype) === TypedArray.prototype);

const a = new Int8Array([3, 1, 2]);
console.log(Object.getPrototypeOf(a) === Int8Array.prototype);
console.log(a instanceof Int8Array);

// generic dispatch: the call site's receiver wins, so the shared method applies
console.log(TypedArray.prototype.join.call(a, '-'));
console.log([...TypedArray.prototype.slice.call(a, 1)].join(','));
console.log([...TypedArray.prototype.map.call(a, x => x * 2)].join(','));
console.log(Int8Array.prototype.indexOf.call(a, 2));

console.log(Int8Array.BYTES_PER_ELEMENT, Float64Array.BYTES_PER_ELEMENT, Uint8ClampedArray.BYTES_PER_ELEMENT);
console.log(Int8Array.prototype.BYTES_PER_ELEMENT, Int32Array.prototype.BYTES_PER_ELEMENT);
console.log(Int8Array.name, Uint16Array.name, Float32Array.name);
console.log(Int8Array.prototype.constructor === Int8Array);

// prototype methods are non-enumerable, or for-in over a view would list them
console.log(Object.keys(Int8Array.prototype).length, Object.keys(TypedArray.prototype).length);

// ArrayBuffer / DataView get the same treatment
console.log(typeof ArrayBuffer.prototype, typeof ArrayBuffer.prototype.slice);
console.log(typeof DataView.prototype, typeof DataView.prototype.getInt32);
const buf = new ArrayBuffer(8);
console.log(Object.getPrototypeOf(buf) === ArrayBuffer.prototype);
const dv = new DataView(buf);
console.log(Object.getPrototypeOf(dv) === DataView.prototype);
DataView.prototype.setInt32.call(dv, 0, 123456);
console.log(DataView.prototype.getInt32.call(dv, 0));
console.log(ArrayBuffer.prototype.slice.call(buf, 0, 4).byteLength);

// @@toStringTag across the family
console.log(Object.prototype.toString.call(a));
console.log(Object.prototype.toString.call(new Float64Array(1)));
console.log(Object.prototype.toString.call(buf));
console.log(Object.prototype.toString.call(dv));
