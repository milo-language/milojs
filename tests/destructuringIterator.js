const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
function trace() {
  const log = [];
  const it = { log, [Symbol.iterator]() { let i = 0; return {
    next() { log.push("next" + i); return { value: i++, done: i > 5 }; },
    return() { log.push("return"); return { done: true }; } }; } };
  return it;
}
t("closes on short pattern", () => { const o = trace(); const [a] = o; return o.log.join(","); });
t("two elements", () => { const o = trace(); const [a, b] = o; return o.log.join(","); });
t("rest drains, no return", () => { const o = trace(); const [a, ...r] = o; return o.log.join(",") + " r=" + r.length; });
t("generator is closed", () => {
  let closed = false;
  function* g() { try { yield 1; yield 2; yield 3; } finally { closed = true; } }
  const [x] = g(); return x + "/" + closed;
});
t("generator not drained", () => {
  const seen = [];
  function* g() { seen.push(1); yield 1; seen.push(2); yield 2; seen.push(3); yield 3; }
  const [x] = g(); return seen.join(",");
});
t("next throws at element 2", () => {
  const o = { [Symbol.iterator]() { let i = 0; return { next() { if (i++ === 1) throw new TypeError("boom"); return { value: 1, done: false }; } }; } };
  const [a] = o; return a;
});
t("next throwing is reached when needed", () => {
  const o = { [Symbol.iterator]() { let i = 0; return { next() { if (i++ === 1) throw new TypeError("boom"); return { value: 1, done: false }; } }; } };
  const [a, b] = o; return a;
});
t("return throwing propagates", () => {
  const o = { [Symbol.iterator]() { return { next() { return { value: 1, done: false }; }, return() { throw new TypeError("closefail"); } }; } };
  const [a] = o; return a;
});
t("array still works", () => { const [a, b] = [1, 2]; return a + b; });
t("string still works", () => { const [a, b] = "hi"; return a + b; });
t("set still works", () => { const [a] = new Set([9]); return a; });
t("map still works", () => { const [[k, v]] = new Map([[1, 2]]); return k + "/" + v; });
t("holes consume", () => { const o = trace(); const [, b] = o; return b + " " + o.log.join(","); });
t("fewer values than slots", () => { const [a, b, c] = [1]; return [a, b, c].map(String).join(","); });
