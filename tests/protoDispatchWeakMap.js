// WeakMap and WeakSet dispatch through their own prototype objects: an override
// is honoured, extracted methods are the prototype's functions, and a receiver
// without the internal slot is a TypeError. WeakMap used to be the Map native,
// so patching Map.prototype.get changed WeakMap#get.

function tryIt(label, f) {
  try {
    console.log(label, f());
  } catch (e) {
    console.log(label, e.constructor.name);
  }
}

function describe(proto) {
  for (const k of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, k);
    if (typeof d.value === "function") {
      console.log(" ", k, d.value.length, d.value.name, d.writable, d.enumerable, d.configurable);
    } else {
      console.log(" ", k, typeof d.value);
    }
  }
}

console.log("WeakMap.prototype:");
describe(WeakMap.prototype);
console.log("WeakSet.prototype:");
describe(WeakSet.prototype);
console.log(WeakMap.length, WeakMap.name, WeakSet.length, WeakSet.name);
console.log(WeakMap.prototype[Symbol.toStringTag], WeakSet.prototype[Symbol.toStringTag]);

const k1 = {};
const k2 = function () {};
const wm = new WeakMap([[k1, "one"], [k2, "two"]]);
const ws = new WeakSet([k1]);

// the Map and WeakMap prototypes are independent
const origMapGet = Map.prototype.get;
Map.prototype.get = function () { return "map override"; };
console.log("map patch leaves weakmap alone:", wm.get(k1), wm.get(k2));
Map.prototype.get = origMapGet;
console.log(Object.getPrototypeOf(wm) === WeakMap.prototype, WeakMap.prototype !== Map.prototype);
console.log(wm instanceof WeakMap, wm instanceof Map, ws instanceof WeakSet, ws instanceof Set);
console.log(Object.prototype.toString.call(wm), Object.prototype.toString.call(ws), String(wm));

// extracted identity
console.log("identity:", wm.get === WeakMap.prototype.get, ws.add === WeakSet.prototype.add, wm["g" + "et"] === wm.get);
console.log("computed:", wm["g" + "et"](k1), ws["h" + "as"](k1));

// no iteration, no size, no clear
console.log(wm.size, ws.size, typeof wm[Symbol.iterator], typeof wm.clear, typeof wm.forEach, typeof ws.keys);

// keys: objects, functions and unregistered symbols only
tryIt("set primitive:", () => wm.set(1, 2));
tryIt("set string:", () => wm.set("k", 2));
tryIt("set null:", () => wm.set(null, 2));
tryIt("set registered symbol:", () => wm.set(Symbol.for("reg"), 2));
const sym = Symbol("local");
tryIt("set local symbol:", () => wm.set(sym, 3) === wm);
tryIt("get local symbol:", () => wm.get(sym));
tryIt("add primitive:", () => ws.add(1));
tryIt("add returns receiver:", () => ws.add(k2) === ws);
console.log("absent primitive:", wm.get(1), wm.has(1), wm.delete(1), ws.has("x"), ws.delete(null));
console.log("delete:", wm.delete(k1), wm.has(k1), wm.get(k1), wm.delete(k1), ws.delete(k1), ws.has(k1));

// brand checks
tryIt("get on Map:", () => WeakMap.prototype.get.call(new Map([[k1, 1]]), k1));
tryIt("set on Map:", () => WeakMap.prototype.set.call(new Map(), k1, 1));
tryIt("has on WeakSet:", () => WeakMap.prototype.has.call(ws, k1));
tryIt("add on WeakMap:", () => WeakSet.prototype.add.call(wm, k1));
tryIt("has on Set:", () => WeakSet.prototype.has.call(new Set([k1]), k1));
tryIt("get on plain:", () => WeakMap.prototype.get.call({}, k1));
tryIt("get on undefined:", () => WeakMap.prototype.get.call(undefined, k1));
tryIt("Object.create receiver:", () => Object.create(WeakMap.prototype).get(k1));
tryIt("Object.create set receiver:", () => Object.create(WeakSet.prototype).add(k1));
tryIt("call without new:", () => WeakMap());
tryIt("bad entry:", () => new WeakMap([1]));
tryIt("bad key in ctor:", () => new WeakMap([[1, 2]]));
tryIt("bad ws ctor:", () => new WeakSet([1]));

// override on the prototype reaches every instance
const origGet = WeakMap.prototype.get;
WeakMap.prototype.get = function (k) { return "patched:" + origGet.call(this, k); };
console.log("override:", wm.get(k2));
WeakMap.prototype.get = origGet;
console.log("restored:", wm.get(k2));

// the constructor fills through the (possibly patched) adder
const origSet = WeakMap.prototype.set;
let seen = 0;
WeakMap.prototype.set = function (k, v) { seen++; return origSet.call(this, k, v); };
const wm2 = new WeakMap([[k1, 1], [k2, 2]]);
console.log("ctor adder calls:", seen, wm2.get(k2));
WeakMap.prototype.set = origSet;

// subclass prototype override
class TaggedMap extends WeakMap {
  get(k) { return "sub:" + super.get(k); }
  set(k, v) { return super.set(k, v * 10); }
}
const tm = new TaggedMap([[k1, 4]]);
console.log("subclass:", tm.get(k1), tm.has(k1), tm instanceof WeakMap, Object.prototype.toString.call(tm));
class CountingSet extends WeakSet {
  add(v) { this.n = (this.n || 0) + 1; return super.add(v); }
}
const cs = new CountingSet([k1, k2]);
console.log("subclass set:", cs.n, cs.has(k2));

// deleting the method removes it
const savedHas = WeakSet.prototype.has;
delete WeakSet.prototype.has;
tryIt("deleted has:", () => ws.has(k2));
console.log("in:", "has" in ws);
WeakSet.prototype.has = savedHas;
console.log("put back:", ws.has(k2));
