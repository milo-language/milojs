"use strict";
// A closure's identity is the evaluation that created it, not its source
// literal or the scope it closed over.

// one literal, one scope, two evaluations: two functions with separate props
var a = [];
for (var i = 0; i < 2; i++) a.push(function () {});
console.log("for-var distinct", a[0] === a[1], a[0] == a[1]);
a[0].x = 1;
console.log("for-var props", a[0].x, a[1].x, Object.keys(a[1]).length);

// class factory: every class expression evaluation is a new class
function mk() { return class { hi() { return 1; } }; }
var A = mk(), B = mk();
console.log("class protos", A === B, A.prototype === B.prototype);
console.log("instanceof", new A() instanceof A, new A() instanceof B, new B() instanceof B);
A.prototype.hi = function () { return 2; };
console.log("patch A only", new A().hi(), new B().hi());

// function factory: f().prototype is fresh per call
function f() { return function () {}; }
console.log("f().prototype", f().prototype === f().prototype, f() === f());

// prototype.constructor points back at the same function value
function G() {}
console.log("constructor link", G.prototype.constructor === G, new G().constructor === G);
var C1 = mk();
console.log("class constructor link", C1.prototype.constructor === C1);

// collection keys
var k1 = f(), k2 = f();
var m = new Map([[k1, "one"], [k2, "two"]]);
console.log("map", m.size, m.get(k1), m.get(k2));
var s = new Set([k1, k2, k1]);
console.log("set", s.size, s.has(k1), s.has(function () {}));
var wm = new WeakMap();
wm.set(k1, 1);
console.log("weakmap", wm.has(k1), wm.has(k2), wm.get(k1));

// SameValue and strict-equality searches
console.log("Object.is", Object.is(k1, k1), Object.is(k1, k2));
console.log("indexOf", [k1].indexOf(k2), [k1, k2].indexOf(k2), [k1].includes(k1), [k1].includes(k2));

// hoisted declarations: new per call, stable within one call
function o() { function h() {} return h; }
console.log("hoisted per call", o() !== o());
function stable() {
  var before = h;
  function h() {}
  var after = h;
  return before === after && before === h;
}
console.log("hoisted stable", stable());
function blocks() {
  var seen = [];
  for (var j = 0; j < 2; j++) {
    { function inner() {} seen.push(inner); }
  }
  return seen[0] === seen[1];
}
console.log("block decl per entry", blocks());

// delete sticks
function named() {}
delete named.name;
console.log("delete name", named.name, Object.prototype.hasOwnProperty.call(named, "name"));

// own property listing, in node's order
function plain(p, q) {}
console.log(Object.getOwnPropertyNames(plain));
class K { static s() {} m() {} }
console.log(Object.getOwnPropertyNames(K));
console.log(Object.getOwnPropertyNames(K.prototype));
console.log(Object.getOwnPropertyNames(() => 1));

// properties set before and after construction
function P() { this.v = 1; }
P.before = "b";
var p1 = new P();
P.after = "a";
P.prototype.shared = "s";
console.log("ctor props", P.before, P.after, p1.shared, Object.keys(P).join(","));

// bound functions of distinct closures
var t1 = f(), t2 = f();
var b1 = t1.bind(null), b2 = t2.bind(null);
console.log("bound", b1 === b2, t1.bind(null) === b1, typeof b1);

// replacing prototype
function R() {}
var oldProto = R.prototype;
R.prototype = { tag: "new" };
console.log("replaced proto", new R().tag, new R() instanceof R, oldProto === R.prototype);

// arrows and methods have no prototype
console.log("no prototype", (() => 1).prototype, ({ m() {} }).m.prototype);
