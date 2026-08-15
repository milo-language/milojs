// util.inspect must render exactly like console.log — lib/util.js used to carry
// a second, bun-shaped implementation that drifted (no line breaking, no array
// column grouping). It now delegates to the engine's renderer via __inspect.
const util = require("util");
const cases = [
  { a: "x", b: [1, 2, 3, 4, 5, 6, 7] },
  [1, 2, 3, 4, 5, 6, 7],
  { s: "it's", t: 'say "hi"' },
  new Map([["k", 1]]),
  new Set([1, 2]),
  { long: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
];
for (const c of cases) {
  console.log(util.inspect(c));
}
// a bare string is quoted by util.inspect but not by console.log
console.log(util.inspect("plain"), util.inspect(42), util.inspect(null));
console.log(util.format("%s and %d and %j", "str", 7, { a: 1 }));
