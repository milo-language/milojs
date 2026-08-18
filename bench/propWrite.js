// Pair D control: overwrite an EXISTING property N times.
// Paired with propWriteNew.js, which adds a fresh key each iteration instead.
// The delta isolates objSet's create path (which must allocate and store an
// owned key) from its overwrite path (which should touch no string at all).
const N = 1000000;
const o = { a: 1, b: 2, target: 3 };
for (let i = 0; i < N; i++) {
  o.target = i;
}
console.log(o.target);
