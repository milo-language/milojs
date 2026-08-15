// Class bodies dropped two things a method can carry: the `*` that makes it a
// generator (consumed and ignored, so `*values() {}` compiled to a plain function
// that ran to completion and returned undefined) and a computed `[expr]` key
// (never parsed, so `[Symbol.iterator]` bound nothing at all). Together they made
// every iterable class un-iterable.

class Range {
  constructor(n) { this.n = n; }
  *[Symbol.iterator]() { for (let i = 0; i < this.n; i++) yield i; }
  *values() { yield 10; yield 20; }
  [Symbol.toStringTag] = undefined;
}

const r = new Range(3);
console.log([...r]);
for (const v of r) console.log("for-of", v);
console.log(Array.from(r));
console.log([...r.values()]);

const [a, b] = r;
console.log("destructured", a, b);
console.log(new Set(r).has(2), Math.max(...r));

// inherited: the subclass gets the base's iterator through the prototype chain
class Sub extends Range {}
console.log([...new Sub(2)]);

// a non-generator computed-key method still works
class Plain {
  [Symbol.iterator]() {
    let i = 0;
    return { next: () => (i < 2 ? { value: i++ + 100, done: false } : { value: undefined, done: true }) };
  }
}
console.log([...new Plain()]);

// a static computed-key method lands on the constructor, not the prototype
class WithStatic { static [Symbol.hasInstance](x) { return x === 7; } }
console.log(typeof WithStatic[Symbol.hasInstance]);

// generator methods keep working under an ordinary name, including on a subclass
class Base { *gen() { yield 1; } }
class Derived extends Base { *gen() { yield 2; yield 3; } }
console.log([...new Base().gen()], [...new Derived().gen()]);
