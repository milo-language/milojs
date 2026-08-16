// Three gaps in what counts as iterable, all found by es-get-iterator's and
// object.assign's own suites rather than by any fixture here.
//
// 1. A String WRAPPER with its own Symbol.iterator iterated the boxed string
//    instead of the override — the wrapper fast path ran before the override
//    was consulted.
// 2. A FUNCTION carrying a Symbol.iterator was rejected as non-iterable.
//    Functions are not objects in this value model, so the iterator walk never
//    saw them.
// 3. Object.assign did not box a primitive SOURCE, so a string source
//    contributed no index properties.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
const fake = (o, vals) => { o[Symbol.iterator] = function () { return vals[Symbol.iterator](); }; return o; };

t("boxed string, no override", () => JSON.stringify([...Object("hi")]));
t("boxed string, own iterator wins", () => JSON.stringify([...fake(Object("s"), ["a", "b"])]));
t("boxed number with iterator", () => JSON.stringify([...fake(Object(42), ["a"])]));
t("boxed boolean with iterator", () => JSON.stringify([...fake(Object(true), ["a"])]));
t("function with iterator", () => JSON.stringify([...fake(function () {}, ["z"])]));
t("arrow with iterator", () => JSON.stringify([...fake(() => {}, ["q"])]));
t("function without iterator", () => JSON.stringify([...function () {}]));
t("regex with iterator", () => JSON.stringify([...fake(/a/g, ["y"])]));
t("plain object with iterator", () => JSON.stringify([...fake({}, ["x"])]));

t("assign string source", () => JSON.stringify(Object.assign({}, "ab")));
t("assign boxed string source", () => JSON.stringify(Object.assign({}, Object("ab"))));
t("assign number source has no keys", () => JSON.stringify(Object.assign({}, 1)));
t("assign boolean source has no keys", () => JSON.stringify(Object.assign({}, true)));
t("assign mixed sources", () => JSON.stringify(Object.assign({ z: 0 }, "a", { b: 1 })));
