// JSON.stringify(v) with no replacer or indent runs natively in one pass; every
// shape that needs user code (toJSON, Date, accessor, Proxy, wrapper, BigInt,
// cycle) or a sparse array falls back to the prelude serialiser, and the two
// must agree with node on all of these.
var o = { a: 1, b: "s\n\"q\"", c: [1, null, undefined, function(){}, Symbol("x"), true, -0, 1e21, NaN], d: { e: { f: [] } }, 2: "two", 1: "one", [Symbol("k")]: 1, g: undefined, h: null };
Object.defineProperty(o, "hidden", { value: 1, enumerable: false });
console.log(JSON.stringify(o));
console.log(JSON.stringify([new Date(0), { toJSON() { return "tj"; } }, new Number(5), new String("w"), new Boolean(false), Object.create({ inh: 1 }), new Uint8Array([1, 2])]));
var cyc = { x: 1 }; cyc.self = cyc; try { JSON.stringify(cyc); } catch (e) { console.log(e.constructor.name); }
var sib = { k: 1 }; console.log(JSON.stringify([sib, sib]));
console.log(JSON.stringify({ get g() { return 7; } }), JSON.stringify([ , 1, , ]), JSON.stringify("é😀\u0001"), JSON.stringify(Object.assign([], { 3: 1 })));
try { JSON.stringify({ b: 10n }); } catch (e) { console.log(e.constructor.name); }
console.log(JSON.stringify(function(){}), JSON.stringify(undefined), JSON.stringify(null), JSON.stringify(new Map([[1,2]])), JSON.stringify(new Error("m")));
console.log(JSON.stringify({ a: [1, { b: 2 }] }, null, 2), JSON.stringify({ a: 1, b: 2 }, ["b"]), JSON.stringify({ a: 1 }, (k, v) => typeof v === "number" ? v + 1 : v));
(function() { console.log(JSON.stringify(arguments)); })(1, 2);
class P extends Array {} console.log(JSON.stringify(new P(1, 2)), JSON.stringify(Object.create(null)), JSON.stringify(new Proxy({ z: 1 }, {})));
