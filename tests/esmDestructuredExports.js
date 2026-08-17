// The array-pattern desugaring binds an iterator temp next to the real names;
// `export const [a] = xs` must not put that temp in the module namespace.
import * as mod from "./esm/destructured.js";

console.log(Object.keys(mod).join(","));
console.log(mod.a, mod.b, mod.e, mod.f, mod.g, JSON.stringify(mod.h), mod.i, mod.j);
