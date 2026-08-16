// lib/prelude.js redefined ArrayBuffer, the typed arrays and DataView as plain
// JS arrays, which shadowed the engine's real ones and left the RUNTIME strictly
// worse than milojs-engine. This pins the properties the shim could not have.
const ab = new ArrayBuffer(8);
console.log(ab.byteLength, ab.slice(2).byteLength, ab.slice(2, 4).byteLength);

const u = new Uint8Array(ab);
console.log(Object.getPrototypeOf(u) === Uint8Array.prototype);
console.log(Object.prototype.toString.call(u), Object.prototype.toString.call(ab));
console.log(ArrayBuffer.isView(u), ArrayBuffer.isView([]), u.buffer === ab);

// two views over one buffer see each other's writes
const v = new Uint8Array(ab);
u[1] = 7;
console.log(v[1], u.byteOffset, u.byteLength);

// DataView packs bytes, both endiannesses, and the setters exist at all
const d = new DataView(ab);
d.setUint16(0, 0x1234);
console.log(d.getUint16(0), d.getUint8(0), d.getUint8(1), d.byteLength);
d.setUint32(0, 0x11223344, true);
console.log(d.getUint32(0, true), d.getUint32(0, false));

// TextEncoder/TextDecoder are real UTF-8 over a real Uint8Array; the old pair
// truncated each char code to one byte, so "héllo" lost a byte and came back wrong
const enc = new TextEncoder();
const bytes = enc.encode("héllo ✓ 😀");
console.log(bytes.constructor === Uint8Array, bytes.length, Array.from(bytes).join(","));
console.log(new TextDecoder().decode(bytes));
console.log(new TextDecoder().decode(enc.encode("")), JSON.stringify(new TextDecoder().decode(new Uint8Array([0x61]))));
console.log(enc.encoding, new TextDecoder().encoding);
