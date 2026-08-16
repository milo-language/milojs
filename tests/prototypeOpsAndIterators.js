// Object.getPrototypeOf and Reflect.getPrototypeOf differ in exactly one way:
// Object BOXES its argument (so `Object.getPrototypeOf(42)` is Number.prototype)
// and Reflect does not (so the same input is a TypeError). milojs returned null
// for every primitive from both, and threw from neither, which is the boundary
// get-proto, reflect.getprototypeof, dunder-proto and set-proto all test.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };

for (const v of [true, 42, "s", null, undefined, Symbol("x"), 1n]) {
  const lbl = typeof v === "symbol" ? "symbol" : String(v);
  t("Reflect.getPrototypeOf " + lbl, () => Reflect.getPrototypeOf(v));
  t("Object.getPrototypeOf " + lbl, () => { const r = Object.getPrototypeOf(v); return r === null ? "null" : typeof r; });
}
t("Reflect.getPrototypeOf()", () => Reflect.getPrototypeOf());
t("Reflect.setPrototypeOf primitive", () => Reflect.setPrototypeOf(42, null));
t("Object.setPrototypeOf null", () => Object.setPrototypeOf(null, null));
t("Object.getPrototypeOf({})", () => Object.getPrototypeOf({}) === Object.prototype);
t("Object.getPrototypeOf([])", () => Object.getPrototypeOf([]) === Array.prototype);
t("boxed number proto", () => Object.getPrototypeOf(42) === Number.prototype);
t("boxed string proto", () => Object.getPrototypeOf("s") === String.prototype);

// __proto__ reads on primitives, and the accessor descriptor dunder-proto reads
t("(42).__proto__", () => (42).__proto__ === Number.prototype);
t("'s'.__proto__", () => "s".__proto__ === String.prototype);
t("true.__proto__", () => true.__proto__ === Boolean.prototype);
t("__proto__ descriptor", () => { const d = Object.getOwnPropertyDescriptor(Object.prototype, "__proto__"); return typeof d + " " + typeof d.get + " " + typeof d.set; });

// Symbol.iterator as a readable VALUE on Map, Set and String. for-of and spread
// always worked because they drive the collection directly; reading the member
// answered undefined, and get-intrinsic resolves %MapIteratorPrototype% by
// calling it.
const m = new Map([[1, 2]]), st = new Set([3]);
t("map iterator typeof", () => typeof m[Symbol.iterator]);
t("set iterator typeof", () => typeof st[Symbol.iterator]);
t("string iterator typeof", () => typeof "ab"[Symbol.iterator]);
// extracted-then-called and direct-call take different dispatch paths
t("map extracted", () => { const f = m[Symbol.iterator]; return JSON.stringify([...f.call(m)]); });
t("map direct", () => JSON.stringify([...m[Symbol.iterator]()]));
t("set direct", () => JSON.stringify([...st[Symbol.iterator]()]));
t("string direct", () => JSON.stringify([...("ab")[Symbol.iterator]()]));
t("string astral", () => JSON.stringify([...("a\u{1F600}")[Symbol.iterator]()]));
t("map iter is object", () => typeof m[Symbol.iterator]());
t("iterator next", () => JSON.stringify(st[Symbol.iterator]().next()));

// %IteratorPrototype% inherits from Object.prototype
t("array iter proto chain", () => Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())) === Object.prototype
  || Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()))) === Object.prototype);
