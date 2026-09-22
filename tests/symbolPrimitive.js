// Symbols are a primitive type of their own, not strings with a marker. Every
// line here is a consequence of that: typeof, the conversions that throw, the
// wrapper object, the registry, and where symbol keys do and do not show up.

function tryIt(label, fn) {
  try {
    console.log(label, fn());
  } catch (e) {
    console.log(label, "throws", e.constructor.name, e.message);
  }
}

const s = Symbol("k");
const anon = Symbol();
const empty = Symbol("");

// typeof and identity
console.log(typeof s, typeof Symbol.iterator, typeof Object(s));
console.log(s === s, s === Symbol("k"), Symbol() === Symbol());
console.log(Object.is(s, s), Object.is(s, Symbol("k")));
console.log(s == s, s == Object(s), s != Symbol("k"));

// description: undefined for Symbol(), "" for Symbol("")
console.log(s.description, anon.description, JSON.stringify(empty.description));
console.log(Symbol(undefined).description, Symbol(null).description, Symbol(42).description);
console.log(Symbol.iterator.description, Symbol.asyncIterator.description);

// the conversions that are allowed
console.log(String(s), s.toString(), String(anon), String(empty));
console.log(s.valueOf() === s, Object(s).valueOf() === s);
console.log(Symbol.prototype.toString.call(Object(s)));
console.log(s[Symbol.toPrimitive]("default") === s);
console.log(Symbol.prototype[Symbol.toPrimitive].name, Symbol.prototype[Symbol.toPrimitive].length);
console.log(Symbol.prototype[Symbol.toStringTag], Object.prototype.toString.call(s));
console.log(Object.prototype.toString.call(Object(s)));
const dd = Object.getOwnPropertyDescriptor(Symbol.prototype, "description");
console.log(typeof dd.get, dd.set, dd.enumerable, dd.configurable);

// the implicit conversions that throw
tryIt("concat", () => "" + s);
tryIt("concat-r", () => s + "");
tryIt("template", () => `${s}`);
tryIt("unary+", () => +s);
tryIt("unary-", () => -s);
tryIt("bitnot", () => ~s);
tryIt("arith", () => s * 2);
tryIt("compare", () => s < 1);
tryIt("wrapper concat", () => "" + Object(s));
tryIt("wrapper template", () => `${Object(s)}`);
tryIt("wrapper plus", () => +Object(s));
tryIt("String(wrapper)", () => String(Object(s)));
tryIt("Number", () => Number(s));
tryIt("BigInt", () => BigInt(s));
tryIt("new", () => new Symbol());
tryIt("Symbol(sym)", () => Symbol(s));
tryIt("join", () => [s].join());

// the wrapper object
const w = Object(s);
console.log(typeof w, w instanceof Symbol, w.description, w === s);
console.log(Object.getPrototypeOf(w) === Symbol.prototype);
console.log(Object.getPrototypeOf(s) === Symbol.prototype, s.constructor === Symbol);
const holder = {};
holder[w] = "via wrapper";
console.log(holder[s]);

// the registry
const r1 = Symbol.for("app");
console.log(r1 === Symbol.for("app"), r1 === Symbol("app"), r1.description);
console.log(Symbol.keyFor(r1), Symbol.keyFor(s), Symbol.keyFor(Symbol.iterator));
console.log(Symbol.for("toString") === Symbol.for("toString"), typeof Symbol.for("toString"));
console.log(Symbol.for().description, Symbol.keyFor(Symbol.for()));
tryIt("keyFor(str)", () => Symbol.keyFor("app"));

// ToPropertyKey
const o = {};
o[s] = 1;
o[anon] = 2;
o["k"] = 3;
o["Symbol(k)"] = 4;
console.log(o[s], o[anon], o.k, o["Symbol(k)"], s in o, "Symbol(k)" in o);
console.log(Object.keys(o));
console.log(JSON.stringify(o));
console.log(Object.getOwnPropertyNames(o));
console.log(Object.getOwnPropertySymbols(o).length, Object.getOwnPropertySymbols(o)[0] === s);
const seen = [];
for (const k in o) seen.push(k);
console.log(seen);
console.log(o.hasOwnProperty(s), Object.prototype.propertyIsEnumerable.call(o, s));
delete o[anon];
console.log(Object.getOwnPropertySymbols(o).length);

// strings that look like the old encoding are strings everywhere
const c = {};
c["@@sym:1"] = 1;
c["Symbol(k)"] = 2;
c["@@sym:x:1"] = 3;
c["@@sym:Symbol.iterator:0"] = 4;
console.log(Object.getOwnPropertySymbols(c).length, Object.keys(c));
console.log(JSON.stringify(c));
console.log(typeof "@@sym:x:1", String("@@sym:x:1"), "a" + "@@sym:x:1");
console.log(Reflect.ownKeys(c).map((k) => typeof k));
console.log(c[Symbol.iterator], "@@sym:Symbol.iterator:0" in [], Symbol.iterator in []);
console.log([..."@@sym:q"].length);
console.log(new Map([["@@sym:x:1", 1]]).get("@@sym:x:1"));

// key order: integer keys, then strings in insertion order, then symbols in
// insertion order
const t = Symbol("t");
const u = Symbol("u");
const ord = {};
ord[u] = "u";
ord.b = "b";
ord[2] = "two";
ord[t] = "t";
ord.a = "a";
ord[1] = "one";
console.log(Reflect.ownKeys(ord));
console.log(Object.keys(ord));
console.log(Object.getOwnPropertySymbols(ord));
console.log(Object.getOwnPropertyNames(ord));
console.log(Object.entries(ord));

// assign and spread copy enumerable symbol keys, not non-enumerable ones
const src = { x: 1, [t]: "tv" };
Object.defineProperty(src, u, { value: "hidden", enumerable: false });
const asg = Object.assign({}, src);
const spr = { ...src };
console.log(asg[t], asg[u], spr[t], spr[u], Object.getOwnPropertySymbols(spr).length);

// JSON drops symbol values and symbol keys; in an array a symbol becomes null
console.log(JSON.stringify({ a: s, b: 1, [s]: 2 }));
console.log(JSON.stringify([s, 1, anon]));
console.log(JSON.stringify(s), JSON.stringify({ n: [Symbol.iterator] }));

// inspect / console.log
console.log(s, anon, empty, Symbol.iterator);
console.log([s, anon]);
console.log({ [s]: 1, plain: 2, [anon]: 3 });
console.log(Object(s));
console.log({ v: s });

// Map and Set key by identity (SameValueZero)
const m = new Map();
m.set(s, "sym");
m.set("k", "str");
m.set(Symbol("k"), "other");
console.log(m.get(s), m.get("k"), m.size, m.has(Symbol("k")));
const st = new Set([s, s, Symbol("k"), "k"]);
console.log(st.size, st.has(s));
console.log([s, t].indexOf(t), [s, t].includes(s));

// symbol-keyed methods, static methods and accessors
const obj2 = {
  [s]() {
    return "called";
  },
};
console.log(obj2[s]());
class K {
  static [t]() {
    return "static";
  }
  get [u]() {
    return "getter";
  }
}
console.log(K[t](), new K()[u]);

// well-known symbols are shared and fixed
console.log(Symbol.iterator === Symbol.iterator, typeof [][Symbol.iterator]);
const wkd = Object.getOwnPropertyDescriptor(Symbol, "iterator");
console.log(wkd.writable, wkd.enumerable, wkd.configurable);
const it = {
  *[Symbol.iterator]() {
    yield 1;
    yield 2;
  },
};
console.log([...it]);
console.log(String(Symbol("a:b:1")), Symbol("a:b:1").description);
