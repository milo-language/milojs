// import(spec, options,): the options argument parses, its `with` is read, and
// node's TypeErrors for a non-object options or attributes surface as
// rejections. A trailing comma after either argument is allowed.
var o = { get with() { console.log("read with"); return {}; } };
import("./esm/lib.js", o,).then(function() { console.log("loaded"); }, function(e) { console.log("rejected", e.constructor.name); });
import("./esm/lib.js", 5).catch(function(e) { console.log(e.constructor.name, e.message); });
import("./esm/lib.js", { with: 5 }).catch(function(e) { console.log(e.constructor.name, e.message); });
import("./esm/lib.js", { with: { type: 5 } }).catch(function(e) { console.log(e.constructor.name, e.message); });
console.log("sync done");
// ToString(specifier) with the string hint: toString runs (not valueOf), a
// symbol rejects, and an abrupt toString rejects rather than throws.
var spec = { toString() { console.log("spec toString"); return "./esm/lib.js"; }, valueOf() { console.log("spec valueOf"); return 1; } };
import(spec).then(function(m) { console.log("object spec loaded", typeof m); });
import(Symbol("s")).catch(function(e) { console.log("symbol", e.constructor.name); });
var threw = "no";
try { import({ toString() { throw new RangeError("boom"); } }).catch(function(e) { console.log("abrupt", e.constructor.name); }); } catch (e) { threw = "yes"; }
console.log("threw synchronously:", threw);
