// `static get` / `static set` did not work AT ALL: the statics object stores
// them as accessors, but both the read path and the method-call path used
// getMember, which returns a data property's value and never invokes a getter.
// Every static getter returned undefined. Instance accessors were fine, which
// is why this survived — nothing in this repo used a static one.
class Counter {
  static #count = 0;
  static get count() { return Counter.#count; }
  static set count(v) { Counter.#count = v; }
  static bump() { Counter.#count++; return Counter.count; }
}
console.log(Counter.count);
Counter.count = 10;
console.log(Counter.count, Counter.bump(), Counter.count);

// a static accessor returning a function must be callable as C.m()
class A { static #m() { return 'private'; } static get m() { return this.#m; } }
console.log(typeof A.m, A.m());

// ... including a generator, which is what test262's class/dstr tree leans on
class B { static * #g(a, b) { yield a; yield b; } static get g() { return this.#g; } }
console.log(typeof B.g, [...B.g(1, 2)].join(','));

// getter-only, setter-only, and inheritance through the constructor chain
class G { static get only() { return 'g'; } }
class S { static set only(v) { S.seen = v; } }
S.only = 'written';
console.log(G.only, S.seen, G.only === 'g');

class Base { static get kind() { return 'base'; } static make() { return this.kind; } }
class Derived extends Base { static get kind() { return 'derived'; } }
console.log(Base.make(), Derived.make(), Derived.kind);

// an OWN static named call/apply/bind must win over Function.prototype's
class C { static #s() { return 'static-s'; } static call() { return C.#s(); } }
console.log(C.call());
class D { static apply() { return 'own-apply'; } static bind() { return 'own-bind'; } }
console.log(D.apply(), D.bind());

// ...while a class WITHOUT those statics still gets Function.prototype's
class Plain { constructor(x) { this.x = x; } static of(x) { return new this(x); } }
console.log(Plain.of(5).x);
function freeFn(a) { return this.tag + a; }
console.log(freeFn.call({ tag: 'T' }, '!'), freeFn.apply({ tag: 'U' }, ['?']));
