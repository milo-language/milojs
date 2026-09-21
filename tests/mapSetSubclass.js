// A subclass or patched prototype method on Map/Set is authoritative: reads
// resolve through the real chain, direct calls reach the override, super.m()
// reaches the native, and the constructor feeds entries through this.set/add.
var m = new Map();
console.log(m.set === Map.prototype.set, new Set().add === Set.prototype.add, typeof m.union);
var unbound = m.get; try { unbound(1); } catch (e) { console.log(e.constructor.name); }
var origSet = Map.prototype.set, origAdd = Set.prototype.add;
Map.prototype.set = function(k, v) { console.log("patched", k, v, this instanceof Map); return origSet.call(this, k, v * 10); };
m.set(1, 2); console.log(m.get(1));
console.log(new Map([[3, 4]]).get(3));
Map.prototype.set = null;
try { new Map([[1, 1]]); } catch (e) { console.log(e.constructor.name, e.message); }
console.log(new Map().size);
Map.prototype.set = origSet;
Set.prototype.add = 5;
try { new Set([1]); } catch (e) { console.log(e.constructor.name, e.message); }
Set.prototype.add = origAdd;
class M extends Map { foo() { return "foo" + this.size; } }
console.log(new M([[1, 1]]).foo());
Map.prototype.bar = function() { return "bar"; }; console.log(new M().bar(), new Map().bar());
delete Map.prototype.bar;
class D extends Map {
  constructor(it) { super(it); this.tag = "d"; }
  set(k, v) { console.log("D.set", k); return super.set(k, v * 2); }
  has(k) { return "H"; }
}
var d = new D([[1, 2], [3, 4]]); d.set(5, 6);
console.log(d.get(3), d.get(5), d.size, d.tag, d.has(1), d instanceof D, d instanceof Map, [...d.keys()].join(","));
class E extends Set { add(v) { console.log("E.add", v); return super.add(v); } }
var e = new E("xy"); console.log(e.size, [...e].join(""));
class G extends Map { get(k) { return "G" + super.get(k); } } console.log(new G([[1, 2]]).get(1));
class A extends Array { push(x) { return super.push(x * 2); } } var a = new A(); a.push(1); console.log(a.length, a[0]);
var own = new Map(); own.set = function() { console.log("own"); return this; }; own.set(1, 1); console.log(own.size);
var proto = Object.setPrototypeOf(new Map(), null); console.log(typeof proto.set);
