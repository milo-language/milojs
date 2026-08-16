// require() of an ABSOLUTE path failed with "no such package" — for a directory
// AND for a plain file. Both work in node, and requiring by absolute path is
// what generated code and test harnesses do routinely; the specifier fell
// through to the node_modules walk instead of resolving directly.
//
// The resolved path is converted back to the registry's cwd-relative form: the
// module graph keys on that, so an absolute key leaves every transitive
// relative require inside the module reporting "was not pre-loaded".
const path = require("path");
const base = path.join(__dirname, "..", "absreq", "pkg");

const viaDir = require(base);
console.log("dir ->", viaDir.tag, viaDir.via);
const viaFile = require(path.join(base, "lib", "main.js"));
console.log("file ->", viaFile.tag, viaFile.via);
console.log("same instance:", viaDir === viaFile);
const viaRelative = require("../absreq/pkg");
console.log("relative agrees:", viaRelative === viaDir);
try { require(path.join(base, "nope.js")); console.log("missing -> no throw"); }
catch (e) { console.log("missing ->", e.constructor.name); }
