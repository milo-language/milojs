// Generator protocol beyond plain iteration: two-way next(v), and yield* over a
// generator, an array, a string, a Set, a Map, and a hand-rolled iterator — all
// driven from the ENGINE, which until 2026-08-15 threw "generators require the
// milojs runtime". gen.throw()/gen.return() live in generatorCompletions.js.
//
// Output is joined into strings on purpose: console.log's object/array rendering
// still follows bun rather than node (nested strings double-quoted), so an
// inspected array would not be a byte-exact node capture.
function* echo() {
  const a = yield 1;
  const b = yield a * 2;
  return a + b;
}
const e = echo();
console.log(e.next().value, e.next(10).value, e.next(5).value);

function* inner() { yield 2; yield 3; return 'inner-done'; }
function* outer() { yield 1; const r = yield* inner(); yield r; yield 4; }
console.log([...outer()].join(","));

function* fromArray() { yield* [1, 2]; }
console.log([...fromArray()].join(","));

function* fromString() { yield* "hi"; }
console.log([...fromString()].join(","));

function* fromSet() { yield* new Set([7, 8, 7]); }
console.log([...fromSet()].join(","));

function* fromMap() { yield* new Map([[1, 'a'], [2, 'b']]); }
console.log(JSON.stringify([...fromMap()]));

const handRolled = {
  [Symbol.iterator]() {
    let n = 0;
    return { next: () => (n < 2 ? { value: n++, done: false } : { value: 'end', done: true }) };
  }
};
function* delegating() { const r = yield* handRolled; yield r; }
console.log([...delegating()].join(","));

const obj = { *[Symbol.iterator]() { yield 'p'; yield 'q'; } };
const [first, ...rest] = obj;
console.log(first, rest.join(","));

function* counter(n) { for (let i = 0; i < n; i++) yield i; }
console.log(Array.from(counter(4)).reduce((a, b) => a + b, 0));
console.log(typeof counter(1)[Symbol.iterator], counter(1)[Symbol.iterator]().next().value);

class Range {
  constructor(n) { this.n = n; }
  *[Symbol.iterator]() { for (let i = 0; i < this.n; i++) yield i * i; }
}
console.log([...new Range(4)].join(","));
console.log(Math.max(...new Range(5)));
