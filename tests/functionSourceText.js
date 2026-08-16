// Function.prototype.toString answered "[object Function]" for every function.
// That is not merely imprecise: lodash and friends tell a built-in from a user
// function by looking for the exact string "[native code]", and is-callable
// decides whether a value is callable by whether calling toString on it throws.
// Every user function looked native, and every object looked callable.
//
// Answering it needs the VERBATIM source, which no pretty-printer can produce —
// the author's spacing is part of the result. So the lexer now records a byte
// range per token, each FuncDef keeps its span, and the module's text is kept so
// the span can be sliced back out.
function decl(a, b) { return a + b; }
const expr = function named(x) { return x; };
const anon = function (x) { return x * 2; };
const arrow = (a, b) => a + b;
const arrow1 = x => x * 3;
const asyncFn = async function af() { return 1; };
const asyncArrow = async (y) => y;
const gen = function* g() { yield 1; };
const obj = { meth(a) { return a; }, *genm() {}, async am() {} };
class C { m(a) { return a; } static s() {} }

console.log(JSON.stringify(decl.toString()));
console.log(JSON.stringify(expr.toString()));
console.log(JSON.stringify(anon.toString()));
console.log(JSON.stringify(arrow.toString()));
console.log(JSON.stringify(arrow1.toString()));
console.log(JSON.stringify(asyncFn.toString()));
console.log(JSON.stringify(asyncArrow.toString()));
console.log(JSON.stringify(gen.toString()));
console.log(JSON.stringify(obj.meth.toString()));
console.log(JSON.stringify(obj.genm.toString()));
console.log(JSON.stringify(obj.am.toString()));
console.log(JSON.stringify(C.prototype.m.toString()));
console.log(JSON.stringify(C.s.toString()));
// built-ins keep node's native-code form, including bound method values
console.log(JSON.stringify(Math.max.toString()));
console.log(JSON.stringify(Object.keys.toString()));
console.log(JSON.stringify(Array.prototype.slice.toString()));
console.log(JSON.stringify(String.prototype.indexOf.toString()));
// a genuine bind() result prints anonymously, unlike a built-in method value
console.log(JSON.stringify(function () {}.bind(null).toString()));
// new Function keeps node's exact layout
console.log(JSON.stringify(new Function("a", "return a").toString()));
// ToString of a function is its source everywhere, not only via .toString()
console.log(JSON.stringify(String(decl)));
console.log(JSON.stringify("" + arrow1));
console.log(JSON.stringify(`${anon}`));
// nested functions slice their own span, not the enclosing one
function outer() { function inner() { return 1; } return inner; }
console.log(JSON.stringify(outer().toString()));
console.log(JSON.stringify(outer.toString()));

// a function's prototype is Function.prototype — its property bag is an
// ordinary object, so asking the bag answered Object.prototype
const p = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "ERR", e.message); } };
p("fn proto", () => Object.getPrototypeOf(function () {}) === Function.prototype);
p("arrow proto", () => Object.getPrototypeOf(() => {}) === Function.prototype);
p("native proto", () => Object.getPrototypeOf(Math.max) === Function.prototype);
// but a deliberate one still wins: this is the %TypedArray% intrinsic
p("Int8Array proto is not Function.prototype", () => Object.getPrototypeOf(Int8Array) !== Function.prototype);
p("regex proto", () => Object.getPrototypeOf(/./g) === RegExp.prototype);

// Function.prototype.toString requires a callable receiver
p("toString on {}", () => Function.prototype.toString.call({}));
p("toString on 42", () => Function.prototype.toString.call(42));
p("toString on fn", () => typeof Function.prototype.toString.call(function () {}));
