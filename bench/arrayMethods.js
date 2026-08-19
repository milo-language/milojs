// The array methods that do a real [[Get]] per index. arrGetDyn replaced raw
// element reads across these to observe own index accessors, so this is the
// bench that says what that cost on ordinary arrays with no accessors at all.
const N = 2000;
const a = new Array(N);
for (let i = 0; i < N; i++) a[i] = i;
let acc = 0;
for (let r = 0; r < 60; r++) {
  acc += a.map(x => x + 1).filter(x => x & 1).length;
  acc += a.slice(0, N).join(",").length;
  acc += a.indexOf(N - 1);
  acc += [...a].length;
  acc += a.concat(a).length;
}
console.log(acc);
