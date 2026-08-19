// import() must ALWAYS return a promise. A specifier that fails to resolve is a
// rejection, never a synchronous throw: the parser desugars import(x) to
// Promise.resolve(require(x)), so the require threw straight out of the
// expression and .catch() never ran.
const order = [];

let threwSync = "no";
let p;
try { p = import("./no-such-module-anywhere.js"); }
catch (e) { threwSync = e.constructor.name; }
console.log("threw synchronously:", threwSync);
console.log("is a promise:", p instanceof Promise);

p.then(
  () => order.push("resolved"),
  (e) => order.push("rejected:" + e.constructor.name),
);

// a specifier that DOES resolve still settles as a promise, not a bare value
import("./esm/lib.js").then((m) => {
  order.push("loaded:" + typeof m.greet);
  console.log(order.join(" | "));
});

console.log("sync end");
