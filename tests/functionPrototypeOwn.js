// `prototype` is an OWN property of a function, and which functions have one is
// observable: an ordinary function and a generator do, an arrow, a shorthand
// method and an async function do not. Every one of these answered "absent"
// before, so getOwnPropertyNames omitted it and hasOwnProperty said false.
function F() {}
const arrow = () => {};
const obj = { m() {} };
function* gen() {}
async function asyncFn() {}
class C {}

for (const [name, fn] of [["fn", F], ["arrow", arrow], ["method", obj.m],
                          ["gen", gen], ["async", asyncFn], ["class", C]]) {
  console.log(name, Object.getOwnPropertyNames(fn).join(","), fn.hasOwnProperty("prototype"));
}

const d = Object.getOwnPropertyDescriptor(F, "prototype");
console.log("fn desc:", d.writable, d.enumerable, d.configurable);
console.log("same object as read:", d.value === F.prototype);

// replacing it keeps the descriptor and the read in agreement
const replacement = { tag: "new" };
F.prototype = replacement;
console.log("after assign:", F.prototype === replacement,
  Object.getOwnPropertyDescriptor(F, "prototype").value === replacement);

// `new` and Reflect.construct must agree about what is a constructor. `new` used
// to consult only isArrow/isMethod, so a generator or async function built an
// object and ran its body.
function attempt(label, fn) {
  let a, b;
  try { new fn(); a = "ok"; } catch (e) { a = e.constructor.name; }
  try { Reflect.construct(fn, []); b = "ok"; } catch (e) { b = e.constructor.name; }
  console.log(label, "new:", a, "construct:", b);
}
attempt("fn", F);
attempt("arrow", arrow);
attempt("method", obj.m);
attempt("gen", gen);
attempt("async", asyncFn);
