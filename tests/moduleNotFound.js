// Packages probe for an optional dependency with try/catch and branch on
// `e.code`, never on the message. Without MODULE_NOT_FOUND the probe reads the
// dependency as present-but-broken instead of absent, and milojs also printed a
// line to stderr for every probe, which node does not do.
let present = true;
let code = null;
try { require("definitely-not-installed-pkg"); } catch (e) { present = false; code = e.code; }
console.log("bare specifier:", present, code);

try { require("./no-such-relative-module.js"); }
catch (e) { console.log("relative specifier:", e.code, e instanceof Error); }

try { require("/no/such/absolute/module.js"); }
catch (e) { console.log("absolute specifier:", e.code); }

// a require that succeeds still works, and is not re-thrown by any of this
const path = require("path");
console.log("still resolves:", typeof path.join);
