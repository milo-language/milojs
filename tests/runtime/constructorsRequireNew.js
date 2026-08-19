// Which constructors may be CALLED without `new`. Eleven natives accepted a
// plain call and answered an object where every engine throws -- `Map()` and
// `Uint8Array()` are not abbreviations for `new Map()`, they are mistakes, and
// answering an object hid them. `Date()` is the opposite case: it is specified
// to ignore its arguments and return the current time as a STRING, and returning
// a Date object made `typeof Date()` "object".
//
// Runtime fixture rather than engine: URL and URLSearchParams only exist here.
const NAMES = ["Map","Set","WeakMap","WeakSet","Promise","Proxy","DataView","ArrayBuffer",
  "Uint8Array","Int32Array","Float64Array","BigInt64Array","URL","URLSearchParams",
  "Date","RegExp","Array","Object","String","Number","Boolean","Error","TypeError","Function"];
for (const n of NAMES) {
  const C = globalThis[n];
  if (typeof C !== "function") { console.log(n, "MISSING"); continue; }
  let out;
  try {
    let v;
    if (n === "Proxy") v = C({}, {});
    else if (n === "DataView") v = C(new ArrayBuffer(4));
    else if (n === "Promise") v = C(() => {});
    else if (n === "URL") v = C("http://x/");
    else v = C();
    out = "OK:" + (v === undefined ? "undefined" : typeof v);
  } catch (e) { out = "THREW:" + e.constructor.name; }
  console.log(n, out);
}
