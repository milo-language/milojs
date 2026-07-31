// Every ESM form the parser desugars onto the CommonJS loader. Module discovery
// scans tokens before parsing, so each of these is also a preload edge that has
// to be found from the import syntax itself.
import def, { greet, twice } from "./esm/lib.js";
import * as ns from "./esm/lib.js";
import { hello, twice as double2, Box } from "./esm/barrel.js";
import "./esm/lib.js";

console.log(def, greet("milo"), twice(21));
console.log(ns.default, Object.keys(ns).sort().join(","));
console.log(hello("barrel"), double2(4), new Box(3).v);

const dyn = await import("./esm/lib.js");
console.log(dyn.default, dyn.greet("dynamic"));
