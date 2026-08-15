// Not a byte-exact node capture — the ONE known divergence, verified against node
// 2026-08-15, is the position of "then 42". `await` of an ALREADY-settled promise
// resumes inline here instead of after a microtask tick, so `chain()` runs to
// completion before its .then() attaches and the callback fires immediately;
// node makes chain() return pending and prints "then 42" seventh. Every other
// line, and every value, matches node exactly. See docs/backlog.md.
async function double(x) { return x * 2; }
async function chain() { const v = await double(21); return v; }

chain().then(v => console.log("then", v));
Promise.resolve(1).then(v => console.log("res", v));
Promise.reject(new Error("boom")).catch(e => console.log("caught", e.message));
new Promise((resolve) => resolve("hi")).then(v => console.log("np", v));
new Promise((_, reject) => reject(new Error("nope"))).catch(e => console.log("rej", e.message));

Promise.all([1, Promise.resolve(2), double(3)]).then(v => console.log("all", JSON.stringify(v)));
Promise.allSettled([Promise.resolve(1), Promise.reject(new Error("x"))]).then(v => console.log("settled", v.length, v[0].status, v[1].status));
Promise.race([Promise.resolve("first")]).then(v => console.log("race", v));

(async () => {
  try { await Promise.reject(new Error("bad")); } catch (e) { console.log("try", e.message); }
  console.log("awaited", JSON.stringify(await Promise.all([double(1), double(2)])));
  const t = await 42;
  console.log("await non-promise", t);
})();

async function thrower() { throw new Error("async-throw"); }
thrower().catch(e => console.log("async rejected:", e.message));
