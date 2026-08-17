// A nested class body still sees the private names of the class it is written
// inside; an inner class that redeclares the same name shadows it.
var C = class {
  #outer = 'test262';
  B1 = class { method(o) { return o.#outer; } };
  B2 = class { #inner = 42; method(o) { return o.#outer + this.#inner; } };
};
const c = new C();
console.log(new c.B1().method(c));
console.log(new c.B2().method(c));

class D { #x = 1; static Inner = class { #x = 2; peek(d) { return d.#x; } }; }
try { new D.Inner().peek(new D()); console.log("no throw"); }
catch (e) { console.log(e.constructor.name); }
console.log(new D.Inner().peek(new D.Inner()));

// two sibling classes with the same private name stay separate
class E { #x = 5; get v() { return this.#x; } static has(o) { return #x in o; } }
class F { #x = 6; get v() { return this.#x; } }
console.log(new E().v, new F().v, E.has(new E()), E.has(new F()));

// a method may mention a private field declared later in the same body
class G { early() { return this.#late; } #late = 'ok'; }
console.log(new G().early());
