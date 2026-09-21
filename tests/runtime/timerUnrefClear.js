// clearTimeout on an unref'd timer: it never fires and hasRef reports false.
const t = setTimeout(() => { console.log("never"); }, 10);
t.unref();
clearTimeout(t);
console.log("hasRef after clear:", t.hasRef());
const i = setInterval(() => { console.log("never"); }, 10).unref();
clearInterval(i);
console.log("interval hasRef after clear:", i.hasRef());
setTimeout(() => { console.log("keepalive fired"); }, 30);
