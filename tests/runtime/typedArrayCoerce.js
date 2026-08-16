// Typed arrays in the RUNTIME are the engine's real ones — lib/prelude.js used
// to shadow them with plain JS arrays, so construction coerced but element
// WRITES did not, and a wide-type view over an ArrayBuffer read raw bytes.
// Both limits are gone; this pins the coercion table and the writes together.
console.log(new Uint8Array([300, 256, 1, -1]).join(","));
console.log(new Int8Array([200, -1, 127]).join(","));
console.log(new Uint8ClampedArray([300, -5, 128.7]).join(","));
console.log(new Uint16Array([70000, 65535]).join(","));
console.log(new Int32Array([4294967296, -1]).join(","));
console.log(new Float64Array([1.5, 2.5, 3.14159]).join(","));
console.log(new Uint8Array(1).BYTES_PER_ELEMENT, new Uint16Array(1).BYTES_PER_ELEMENT, new Int32Array(1).BYTES_PER_ELEMENT, new Float64Array(1).BYTES_PER_ELEMENT);
console.log(new Uint16Array(3).byteLength, new Float64Array(2).byteLength);
const a = new Uint8Array(3); a.set([300, 1], 0); console.log(a.join(","));
console.log(new Uint8Array(Buffer.from([1, 2, 255])).join(","));

// element writes coerce too — the shim could not intercept them
const w = new Uint8Array(2); w[0] = 300; w[1] = -1; console.log(w.join(","));
const wi = new Int8Array(2); wi[0] = 200; wi[1] = -129; console.log(wi.join(","));
const wc = new Uint8ClampedArray(2); wc[0] = 300; wc[1] = -5; console.log(wc.join(","));
const wf = new Float64Array(1); wf[0] = 3.5; console.log(wf[0]);

// a view over an ArrayBuffer reinterprets the bytes, it does not alias elements
const ab = new ArrayBuffer(4);
const u8 = new Uint8Array(ab); const u32 = new Uint32Array(ab);
u8[0] = 0x78; u8[1] = 0x56; u8[2] = 0x34; u8[3] = 0x12;
console.log(u32[0], u8.byteLength, u32.length);

// constructing from anything array-like or iterable, not only a real Array
console.log(new Uint8Array(Buffer.from([1, 2, 255])).join(","));
console.log(new Uint8Array({ length: 3, 0: 9, 1: 8, 2: 7 }).join(","));
console.log(new Uint8Array(new Set([1, 2, 3])).join(","));
console.log(new Uint8Array(new Uint16Array([1, 2, 300])).join(","));
