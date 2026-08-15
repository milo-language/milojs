// A user object's [Symbol.iterator] must drive every consumer of the iteration
// protocol. The generator form is the one that broke: `*[Symbol.iterator]()`
// hands back a generator, whose `next` is a native method rather than a stored
// property, so the drive loops read no `next` at all and reported the object as
// empty (spread) or as a broken iterator (for-of).
//
// Values are numbers on purpose: console.log spells a string inside an inspected
// array with double quotes where node uses single, which is a separate gap and
// would lock this fixture to milojs's spelling rather than node's.

const gen = { *[Symbol.iterator]() { yield 1; yield 2; yield 3; } };
const plain = {
  [Symbol.iterator]() {
    let i = 0;
    return { next: () => (i < 2 ? { value: 10 + i++, done: false } : { value: undefined, done: true }) };
  },
};

console.log([...gen]);
console.log([...plain]);

for (const v of gen) console.log("for-of gen", v);
for (const v of plain) console.log("for-of plain", v);

console.log(Array.from(gen));
console.log(Array.from(gen, (x) => x * 10));

const [a, b] = gen;
console.log("destructured", a, b);

console.log(new Set(gen).has(2), new Map([["k", 1]]).get("k"));
console.log(Math.max(...gen));

// the iterator is re-created per consumption, so a second pass sees the same values
console.log([...gen], [...gen]);

// a generator method under an ordinary key stays an ordinary generator
const named = { *values() { yield 42; } };
console.log([...named.values()]);

// nested: an object whose iterator yields iterables
const outer = { *[Symbol.iterator]() { yield gen; yield plain; } };
console.log([...outer].map((x) => [...x]));
