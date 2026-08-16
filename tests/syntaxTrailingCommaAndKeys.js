// Three parser/protocol gaps found by a syntax sweep against node.
//
// The trailing comma was the expensive one: legal since ES2017 and emitted by
// every formatter on a multi-line call, but a parse error here — and a parse
// error is fatal, so one prettier-formatted call killed the whole file.
function f(a, b) { return a + b; }
console.log(f(1, 2,));
console.log(Math.max(1, 2,));
console.log(new Array(1, 2,).length);
console.log([1, 2].map((x,) => x * 2,).join(","));
const oc = { f(a) { return a; } };
console.log(oc?.f?.(1,));
console.log((function () { return arguments.length; })(1, 2,));

// a computed key on an accessor: the computed-key branch ran BEFORE the
// get/set check, so `{ get [k]() {} }` never reached it and came out nameless
const k = "p";
const g = { get [k]() { return 1; } };
console.log(g.p);
const s = { set [k](v) { this._v = v; } };
s.p = 5;
console.log(s._v);
const sym = Symbol("s");
console.log({ get [sym]() { return 2; } }[sym]);
console.log(JSON.stringify({ [k]: 1 }));
console.log([...{ *[Symbol.iterator]() { yield 1; yield 2; } }].join(","));
console.log(JSON.stringify({ get: 1, set: 2 }));

// __proto__ as a WRITE: only the read side existed, so the ES5 idiom did nothing
const o = {};
o.__proto__ = { q: 2 };
console.log(o.q);
function C() {}
function P() {}
C.prototype.__proto__ = P.prototype;
P.prototype.hi = function () { return "hi"; };
console.log(new C().hi());
console.log(JSON.stringify({ ["__proto__"]: { p: 1 } }));
