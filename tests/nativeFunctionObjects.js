// Built-in functions are objects: each has its own identity and property bag,
// inherits Function.prototype (and through it Object.prototype), and a
// promise's resolve/reject functions are fresh objects per pair.

// reaching Object.prototype through Function.prototype
console.log(Map.hasOwnProperty("prototype"));
console.log(Math.abs.hasOwnProperty("name"), Math.abs.hasOwnProperty("prototype"));
console.log(Object.getPrototypeOf(parseInt) === Function.prototype);
console.log(Object.getPrototypeOf(Map) === Function.prototype);
console.log(Object.getPrototypeOf(Object.getPrototypeOf(Math.max)) === Object.prototype);
console.log(typeof Math.max.propertyIsEnumerable, Math.max.propertyIsEnumerable("name"));

// properties persist and are distinct per builtin
Math.max.tag = 1;
Array.isArray.x = "isArray";
console.log(Math.max.tag, Math.min.tag, Array.isArray.x, Math.max.x);
Math.max.tag++;
Math.max["tag"] += 10;
console.log(Math.max.tag, Object.keys(Math.max), Object.keys(Math.min));
const mx = Math.max;
console.log(mx === Math.max, mx.tag, Math.max !== Math.min, Object.is(mx, Math.max));

// own property names in node's order
console.log(Object.getOwnPropertyNames(Math.max));
console.log(Object.getOwnPropertyNames(Math.abs));
console.log(Object.getOwnPropertyNames(Object.keys));
console.log(Object.getOwnPropertyNames(Map));
console.log(Object.getOwnPropertyNames(Int16Array));
console.log(Object.getOwnPropertyNames(Boolean));

// name and length
console.log(Math.max.name, Math.max.length, Math.abs.name, Math.abs.length, JSON.stringify.length);
delete Array.prototype.push.name;
console.log(Object.prototype.hasOwnProperty.call(Array.prototype.push, "name"));
delete Math.min.name;
console.log(Math.min.hasOwnProperty("name"), JSON.stringify(Math.min.name));

// builtins as keys
const m = new Map();
m.set(Math.max, "max");
m.set(Math.min, "min");
m.set(parseInt, "parseInt");
console.log(m.size, m.get(Math.max), m.get(Math.min), m.get(parseInt), m.has(parseFloat));
const wm = new WeakMap();
wm.set(Math.abs, 1);
wm.set(JSON.parse, 2);
console.log(wm.get(Math.abs), wm.get(JSON.parse), wm.has(Math.floor));
const set = new Set([Math.max, Math.max, Math.min]);
console.log(set.size, [Math.min, Math.max].indexOf(Math.max), [Math.max].includes(Math.max));

// resolve/reject functions
let r1, j1, r2, j2;
const p1 = new Promise((res, rej) => { r1 = res; j1 = rej; });
const p2 = new Promise((res, rej) => { r2 = res; j2 = rej; });
console.log(r1 === j1, r1 === r2, j1 === j2, r1 === r1);
console.log(typeof r1, r1.length, j1.length, JSON.stringify(r1.name), JSON.stringify(j1.name));
console.log(Object.getOwnPropertyNames(r2), Object.getPrototypeOf(r1) === Function.prototype, r1.hasOwnProperty("prototype"));
r1.tag = "r1";
j1.tag = "j1";
console.log(r1.tag, j1.tag, r2.tag, j2.tag);
delete j2.length;
console.log(j2.hasOwnProperty("length"), j2.length);
const rm = new Map([[r1, 1], [j1, 2], [r2, 3]]);
console.log(rm.size, rm.get(r1), rm.get(j1), rm.get(r2), rm.get(j2));
r1("done");
p1.then((v) => console.log("p1", v, r1.tag));

// toString
console.log(String(Math.floor));
console.log("" + Map);
console.log(Math.max.toString());

// extensibility and freezing
console.log(Object.isExtensible(Math.max), Object.isFrozen(Math.max));
Object.freeze(Math.pow);
Math.pow.extra = 1;
console.log(Object.isFrozen(Math.pow), Object.isExtensible(Math.pow), Math.pow.extra, Math.pow(2, 3));
Object.preventExtensions(Math.sqrt);
Math.sqrt.extra = 1;
console.log(Object.isExtensible(Math.sqrt), Math.sqrt.extra, Math.sqrt(9));
