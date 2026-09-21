// unref then ref: a re-ref'd timeout keeps the loop alive and fires. hasRef
// reports the state at each step. An unref'd timer alongside a ref'd one still
// fires when due, because the loop is alive for the ref'd one.
const t = setTimeout(() => { console.log("t fired"); }, 20);
console.log("hasRef new:", t.hasRef());
const u = t.unref();
console.log("unref returns same:", u === t, "hasRef:", t.hasRef());
t.ref();
console.log("hasRef after ref:", t.hasRef());

setTimeout(() => { console.log("unrefd 10ms fired"); }, 10).unref();
setTimeout(() => { console.log("refd 50ms fired"); }, 50);
console.log("sync end");
