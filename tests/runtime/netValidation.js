// net.Socket argument validation. write() coerced anything with String(), so
// write(42) put "42" on the wire and write({}) put "[object Object]" there; an
// array host was coerced and then actually connected. resetAndDestroy did not
// exist. The expected-type list also has to read the way node prints it: three
// or more names take an Oxford comma.
const net = require("net");
const s = new net.Socket();
for (const v of [null, true, 1, [], {}, undefined]) {
  try { s.write(v); console.log("no throw for", JSON.stringify(v) ?? String(v)); }
  catch (e) { console.log(String(v === undefined ? "undefined" : JSON.stringify(v)).padEnd(8), e.code, "|", e.message); }
}
try { net.createConnection({ host: ["192.168.0.1"], port: 8080 }); }
catch (e) { console.log("array host:", e.code, "|", e.message); }
console.log("resetAndDestroy:", typeof new net.Socket().resetAndDestroy);
