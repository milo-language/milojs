// Array destructuring is desugared to `[...expr]`, and spreading a non-iterable
// was a silent no-op — so `const [a] = 5`, `= null`, `= {}` all produced
// undefined where the spec throws. Same defect from the other end: `[...5]` in
// ordinary code was an empty array rather than a TypeError.
//
// ~30 test262 cases in the sample are destructuring failures of this shape,
// spread across class/object/generator contexts.
const t = (l, f) => { try { const r = f(); console.log(l, "->", String(r)); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
t("obj destr null", () => { const { a } = null; return a; });
t("obj destr undefined", () => { const { a } = undefined; return a; });
t("arr destr null", () => { const [a] = null; return a; });
t("arr destr non-iterable", () => { const [a] = {}; return a; });
t("arr destr number", () => { const [a] = 5; return a; });
t("param obj destr undefined", () => { (function ({ a }) { return a; })(undefined); });
t("param arr destr null", () => { (function ([a]) { return a; })(null); });
t("nested null", () => { const { a: { b } } = { a: null }; return b; });
t("assign pattern null", () => { let a; ({ a } = null); return a; });
t("iterator returns non-object", () => { const it = { [Symbol.iterator]() { return { next() { return 1; } }; } }; const [x] = it; return x; });
t("next not a function", () => { const it = { [Symbol.iterator]() { return {}; } }; const [x] = it; return x; });
t("Symbol.iterator not callable", () => { const it = { [Symbol.iterator]: 5 }; const [x] = it; return x; });
t("rest of null", () => { const { ...r } = null; return JSON.stringify(r); });
t("default evaluated", () => { const { a = 7 } = {}; return a; });
t("array destr works", () => { const [a, b] = [1, 2]; return a + b; });
t("string destr works", () => { const [a] = "hi"; return a; });
// the same rule from the spread side, which is where it is actually enforced
t("spread number", () => JSON.stringify([...5]));
t("spread null", () => JSON.stringify([...null]));
t("spread plain object", () => JSON.stringify([...{}]));
t("spread array works", () => JSON.stringify([...[1, 2]]));
t("spread string works", () => JSON.stringify([..."ab"]));
t("spread set works", () => JSON.stringify([...new Set([1])]));
t("spread map works", () => JSON.stringify([...new Map([[1, 2]])]));
t("spread generator works", () => JSON.stringify([...(function* () { yield 1; })()]));
t("spread custom iterable", () => JSON.stringify([...{ [Symbol.iterator]() { let i = 0; return { next: () => ({ value: i, done: i++ > 1 }) }; } }]));
t("spread in a call", () => Math.max(...[1, 5, 3]));
