// V8 structured stack traces. `bindings` (the loader under most native addons)
// finds its caller's file this way, and with no frames at all it read undefined
// and threw on `fileName.indexOf('file://')`.
const sites = [];
const origPST = Error.prepareStackTrace;
Error.prepareStackTrace = function (_, st) { return st.map(function (s) { return s.getFileName(); }); };
const dummy = {};
Error.captureStackTrace(dummy);
const files = dummy.stack;
Error.prepareStackTrace = origPST;
console.log("frames is an array:", Array.isArray(files));
console.log("innermost frame is this file:", files[0] === __filename);
console.log("no shim frames leaked:", files.every(function (f) { return f.indexOf("builtin:") !== 0; }));

// CallSite shape
Error.prepareStackTrace = function (_, st) { return st[0]; };
const d2 = {};
Error.captureStackTrace(d2);
const site = d2.stack;
Error.prepareStackTrace = origPST;
console.log("CallSite methods:", ["getFileName", "getLineNumber", "getColumnNumber", "getFunctionName",
  "isNative", "isEval", "isToplevel", "toString"].map(function (m) { return typeof site[m]; }).join(","));

// default formatting when prepareStackTrace is unset
const d3 = {};
Error.captureStackTrace(d3);
console.log("default stack is a string:", typeof d3.stack, d3.stack.split("\n")[0]);
console.log("default stack has frames:", d3.stack.split("\n").length > 1);

// __filename and __dirname are ABSOLUTE, as node guarantees. Packages join
// candidate paths onto them; a relative one sends every candidate to the wrong
// directory, which is what kept an addon from ever being located.
console.log("__filename absolute:", __filename[0] === "/");
console.log("__dirname absolute:", __dirname[0] === "/");
console.log("__filename under __dirname:", __filename.indexOf(__dirname) === 0);

// require as a VALUE, not just a call form
console.log("typeof require:", typeof require);
console.log("require.length is a number:", typeof require.length === "number" || require.length === undefined);

// tls exists so a package that opens with require('tls') can load at all
const tls = require("tls");
console.log("tls:", typeof tls.connect, typeof tls.TLSSocket, typeof tls.createSecureContext);
console.log("checkServerIdentity match:", tls.checkServerIdentity("a.example.com",
  { subjectaltname: "DNS:a.example.com, DNS:b.example.com" }) === undefined);
console.log("checkServerIdentity wildcard:", tls.checkServerIdentity("x.example.com",
  { subjectaltname: "DNS:*.example.com" }) === undefined);
console.log("checkServerIdentity mismatch:", tls.checkServerIdentity("evil.test",
  { subjectaltname: "DNS:a.example.com" }).code);
