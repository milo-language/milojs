// Buffer read/write bounds and value ranges.
//
// Two failures were being reported as one. A buffer too small to hold the type
// AT ALL is ERR_BUFFER_OUT_OF_BOUNDS; an offset past the end of a big-enough
// buffer is ERR_OUT_OF_RANGE. A four-byte buffer asked for a double is the
// first, the same buffer asked for a byte at index 9 is the second, and both
// used to answer ERR_OUT_OF_RANGE.
//
// The write accessors also checked nothing about the VALUE, so writeUInt8(256)
// wrapped silently to 0 where node throws.
const b = Buffer.alloc(4);
function t(label, fn) { try { const r = fn(); console.log(label + ": no throw ->", r); } catch (e) { console.log(label + ":", e.code, "|", e.message); } }
t("readDoubleBE on 4-byte", () => b.readDoubleBE(0));
t("readUInt8(9)", () => b.readUInt8(9));
t("readUInt8(-1)", () => b.readUInt8(-1));
t("readUInt8(1.5)", () => b.readUInt8(1.5));
t("writeUInt8(256)", () => b.writeUInt8(256, 0));
t("writeUInt8(-1)", () => b.writeUInt8(-1, 0));
t("writeInt8(128)", () => b.writeInt8(128, 0));
t("writeInt8(-129)", () => b.writeInt8(-129, 0));
t("writeUInt16BE(65536)", () => b.writeUInt16BE(65536, 0));
t("writeFloatBE(1e40)", () => b.writeFloatBE(1e40, 0));

// The variable-length accessors validate byteLength FIRST: 1 to 6, because past
// six a value stops being exactly representable as a double. byteLength used to
// go straight into the bounds check, so a bad one was reported as an offset
// problem.
console.log("--- variable length ---");
t("readIntBE(0,0)", () => b.readIntBE(0, 0));
t("readIntBE(0,7)", () => b.readIntBE(0, 7));
t("readUIntBE(0,0)", () => b.readUIntBE(0, 0));
t("writeIntBE(1,0,0)", () => b.writeIntBE(1, 0, 0));
t("readIntBE(3,2)", () => b.readIntBE(3, 2));
t("readIntBE(0,3)", () => b.readIntBE(0, 3));
