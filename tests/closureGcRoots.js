// Every closure is a heap object now, so a function value held only by the
// evaluator while other code runs must be rooted like any object. Each case
// creates a closure, then runs code that allocates (and so collects under the
// every-allocation GC run) before the closure is stored anywhere a scope sees.
function churn() {
  var junk = [];
  for (var i = 0; i < 50; i++) junk.push({ i: i, s: "x" + i });
  return junk.length;
}

var arr = [function a() { return "a"; }, churn(), () => "b"];
console.log(arr[0](), arr[1], arr[2]());

var obj = { f: function () { return "f"; }, n: churn(), g() { return "g"; } };
console.log(obj.f(), obj.n, obj.g());

function take(f, n, g) { return f() + n + g(); }
console.log(take(function () { return "p"; }, churn(), () => "q"));

var s = `${(function () { return "t"; })()}-${churn()}`;
console.log(s);

var cls = class {
  static [(churn(), "k")]() { return "static-k"; }
  [(churn(), "m")]() { return "m"; }
  static s = churn();
};
console.log(cls.k(), new cls().m(), cls.s, cls.prototype.constructor === cls);

function defaults(f = function () { return "d"; }, n = churn()) { return f() + n; }
console.log(defaults());

var spread = [...[() => 1, () => 2].map(function (f) { churn(); return f; })];
console.log(spread.map(function (f) { return f(); }).join(","));

function Ctor(f, n) { this.f = f; this.n = n; }
var inst = new Ctor(function () { return "c"; }, churn());
console.log(inst.f(), inst.n);

var chained = (function () { return function () { return "inner"; }; })();
churn();
console.log(chained());

var protos = [];
for (var i = 0; i < 20; i++) {
  var F = function () {};
  F.prototype.v = i;
  protos.push(F);
  churn();
}
console.log(protos.map(function (P) { return new P().v; }).join(","));

var bound = (function () { return this.x; }).bind({ x: "bound" });
churn();
console.log(bound());

var m = new Map();
for (var j = 0; j < 5; j++) m.set(function () {}, j);
churn();
console.log(m.size);
