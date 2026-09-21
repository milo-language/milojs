// Rooting across a native method call whose receiver is a proxy: every trap
// allocates, so with MILOJS_GC_THRESHOLD=1 (which tests/run.sh applies to any
// *Gc* fixture) an argument or receiver that only a Milo stack frame references
// is collected mid-call and its slot handed to the trap's own allocations.
// Seen as [1,2,3,4,"1"] and [4,9,{"z":10}] before the roots were held.
var t = [1, 2, 3, 4];
var p = new Proxy(t, { get(o, k, r) { var junk = ["x" + String(k), {a: 1}, [k]]; return Reflect.get(o, k, r); } });
var bad = [];
for (var i = 0; i < 40; i++) { var arg = [9, {z: i}]; var s = JSON.stringify(p.concat(arg)); if (s !== '[1,2,3,4,9,{"z":' + i + '}]') bad.push("arg " + i + " " + s); }
for (var i = 0; i < 40; i++) { var s = JSON.stringify(p.concat([9])); if (s !== '[1,2,3,4,9]') bad.push("lit " + i + " " + s); }
for (var i = 0; i < 40; i++) { var s = JSON.stringify(p.slice(0).concat([9, {z: i}])); if (s !== '[1,2,3,4,9,{"z":' + i + '}]') bad.push("recv " + i + " " + s); }
for (var i = 0; i < 40; i++) { var s = JSON.stringify(p.map(function(x) { var j = [{q: x}]; return x + i; })); if (s !== JSON.stringify([1 + i, 2 + i, 3 + i, 4 + i])) bad.push("map " + i + " " + s); }
for (var i = 0; i < 40; i++) { var s = p.indexOf(3, {valueOf() { var g = [{}, {}]; return 0; }}); if (s !== 2) bad.push("idx " + i + " " + s); }
for (var i = 0; i < 40; i++) { var s = JSON.stringify(Array.prototype.concat.call(p, [9], p)); if (s !== '[1,2,3,4,9,1,2,3,4]') bad.push("call " + i + " " + s); }
console.log(bad.length ? bad.slice(0, 5).join("\n") : "all held");
