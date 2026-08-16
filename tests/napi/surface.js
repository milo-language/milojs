const addon = require(process.env.MILOJS_NAPI_ADDON);

const s = addon.scopes();
console.log("scopes:", s.scopesOk, "escaped:", s.escaped, "pending:", s.exceptionPending, "errInfo:", s.hasErrorInfo);

const v = addon.values(1234567890);
console.log("latin1:", v.latin1, "len:", v.latin1.length);
console.log("int64:", v.int64);
console.log("hasInherited:", v.hasInherited, "hasOwnInherited:", v.hasOwnInherited);

const d = addon.defineProps();
console.log("dataProp:", d.dataProp, "methodProp:", d.methodProp(), "accessorProp:", d.accessorProp);

const buf = new Uint8Array([10, 20, 30, 40, 50, 60]);
const whole = addon.taInfo(buf);
console.log("whole type/len/offset/first:", whole.type, whole.length, whole.byteOffset, whole.firstByte);
const sub = addon.taInfo(buf.subarray(2));
console.log("sub type/len/offset/first:", sub.type, sub.length, sub.byteOffset, sub.firstByte);
const u16 = addon.taInfo(new Uint16Array([1, 2, 3]));
console.log("uint16 type/len:", u16.type, u16.length);

console.log("external round trip:", addon.externalRoundTrip());
console.log("type error name:", addon.typeErr());

// async work: node runs execute on a threadpool and complete back on the loop,
// so the trace is only readable after yielding. 12 means execute then complete.
addon.startWork();
setTimeout(function () { console.log("async work trace:", addon.readTrace()); }, 10);
