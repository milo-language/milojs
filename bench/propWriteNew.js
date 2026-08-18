// Pair D variant: same loop count, but each write creates a NEW property on a
// fresh object, so every one takes objSet's push path and stores an owned key.
const N = 200000;
let sink = 0;
for (let i = 0; i < N; i++) {
  const o = {};
  o.k0 = i; o.k1 = i; o.k2 = i; o.k3 = i; o.k4 = i;
  sink = sink + o.k4;
}
console.log(sink);
