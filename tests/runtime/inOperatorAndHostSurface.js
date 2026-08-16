// `in` fell through to false for a NATIVE or a FUNCTION right-hand side:
// `"prototype" in String` answered false while `String.prototype` read fine.
// get-intrinsic walks `%String.prototype.indexOf%` with exactly that test, so
// every package depending on it (a large slice of npm) failed to load.
console.log("prototype in String:", "prototype" in String);
console.log("prototype in Array:", "prototype" in Array);
console.log("indexOf in String.prototype:", "indexOf" in String.prototype);
console.log("map in Array.prototype:", "map" in Array.prototype);
console.log("keys in Object:", "keys" in Object);
console.log("missing in String:", "definitelyNotThere" in String);
function f() {}
f.custom = 1;
console.log("in a function:", "prototype" in f, "name" in f, "custom" in f, "nope" in f);
console.log("in an object:", "a" in { a: 1 }, "b" in { a: 1 });
console.log("inherited:", "toString" in {});
console.log("array index:", 0 in [1], 5 in [1]);

// `in` on a primitive is a TypeError, not false
for (const rhs of [5, "s", true, null, undefined]) {
  try { "a" in rhs; console.log("in", typeof rhs, "no throw"); }
  catch (e) { console.log("in", String(rhs), "->", e.name); }
}

// the get-intrinsic walk itself
let v = String;
for (const part of ["prototype", "indexOf"]) {
  if (!(part in v)) { console.log("walk failed at", part); break; }
  v = v[part];
}
console.log("walked to:", typeof v);

// host surface a real dependency tree reads before it will load
const fs = require("fs");
console.log("fs:", ["access", "accessSync", "appendFile", "open", "close", "realpath", "chmod", "rmdir", "exists"].map(k => typeof fs[k]).join(","));
console.log("fs.constants.F_OK:", fs.constants.F_OK, "R_OK:", fs.constants.R_OK);
console.log("process.versions.node:", typeof process.versions.node, "modules:", typeof process.versions.modules);
console.log("process.release.name:", process.release.name);
console.log("process.config keys:", Object.keys(process.config).sort().join(","));
