// Destructuring is the largest identifiable cluster left in the test262 sample:
// 106 failures, 16% of everything still failing. Two defects behind much of it.
//
// 1. A pattern default applied to NULL as well as undefined. The desugaring
//    compared with `==`, which matches both, so `const [a = 7] = [null]` bound 7
//    where the spec binds null — a silent wrong value, not an error.
// 2. An ANONYMOUS function, arrow or class used as a default did not take the
//    binding's name: `const [a = () => {}] = []` left a.name empty.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
t("nested array val null", () => { const [[a]] = [null]; return a; });
t("nested obj val null", () => { const [{ a }] = [null]; return a; });
t("obj prop array val null", () => { const { p: [a] } = { p: null }; return a; });
t("default not evaluated", () => { let hit = 0; const [a = (hit = 1)] = [5]; return a + "/" + hit; });
t("default evaluated when absent", () => { let hit = 0; const [a = (hit = 1)] = []; return a + "/" + hit; });
t("default undefined triggers", () => { const [a = 7] = [undefined]; return a; });
t("default null does not", () => { const [a = 7] = [null]; return String(a); });
t("fn name from array binding", () => { const [a = function () {}] = []; return a.name; });
t("arrow name from array binding", () => { const [a = () => {}] = []; return a.name; });
t("fn name from obj binding", () => { const { a = function () {} } = {}; return a.name; });
t("class name from binding", () => { const [a = class {}] = []; return a.name; });
t("named fn keeps its name", () => { const [a = function named() {}] = []; return a.name; });
t("iterator get throws", () => {
  const o = {}; Object.defineProperty(o, Symbol.iterator, { get() { throw new TypeError("boom"); } });
  const [x] = o; return x;
});
t("rest after elements", () => { const [a, ...r] = [1, 2, 3]; return a + "/" + JSON.stringify(r); });
t("holes", () => { const [, b] = [1, 2]; return b; });
// name inference outside patterns, which shares the same helper
t("const anon fn", () => { const f = function () {}; return f.name; });
t("const anon class", () => { const C = class {}; return C.name; });
t("const arrow", () => { const g = () => {}; return g.name; });
t("object value", () => ({ h: function () {} }).h.name);
t("param default", () => { function f(a = () => {}) { return a.name; } return f(); });
t("assignment does not infer", () => { let z; z = function () {}; return JSON.stringify(z.name); });
