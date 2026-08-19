// Eight enumeration surfaces (Object.keys/values/entries, for-in,
// getOwnPropertyNames, JSON.stringify, object spread, Object.assign) crossed with
// 22 object kinds. The point is the CROSS: each surface carries its own copy of
// "which keys does this object have", so a data representation added later is
// missing from some of them and present in others, and no single-surface test
// notices. Six of the 22 kinds disagreed with node when this was written, every
// one of them a surface that had not been told about a representation the others
// knew.
function forIn(o) { const k = []; for (const x in o) k.push(x); return k; }
function surfaces(o) {
  const r = {};
  try { r.keys = Object.keys(o); } catch (e) { r.keys = "ERR:" + e.constructor.name; }
  try { r.values = Object.values(o).map(v => typeof v === "function" ? "fn" : v); } catch (e) { r.values = "ERR:" + e.constructor.name; }
  try { r.entries = Object.entries(o).length; } catch (e) { r.entries = "ERR:" + e.constructor.name; }
  try { r.forIn = forIn(o); } catch (e) { r.forIn = "ERR:" + e.constructor.name; }
  try { r.gopn = Object.getOwnPropertyNames(o); } catch (e) { r.gopn = "ERR:" + e.constructor.name; }
  try { r.json = JSON.stringify(o); } catch (e) { r.json = "ERR:" + e.constructor.name; }
  try { r.spread = Object.keys({ ...o }); } catch (e) { r.spread = "ERR:" + e.constructor.name; }
  try { r.assign = Object.keys(Object.assign({}, o)); } catch (e) { r.assign = "ERR:" + e.constructor.name; }
  return r;
}
const CASES = [
  ["plain", () => ({ a: 1, b: 2 })],
  ["array", () => [1, 2, 3]],
  ["sparse", () => { const a = [1]; a[3] = 4; return a; }],
  ["arrayExtra", () => { const a = [1]; a.x = 2; return a; }],
  ["u8", () => new Uint8Array([1, 2])],
  ["f64", () => new Float64Array([1.5])],
  ["bigint64", () => new BigInt64Array([1n])],
  ["dataview", () => new DataView(new ArrayBuffer(4))],
  ["arraybuffer", () => new ArrayBuffer(4)],
  ["strWrapper", () => Object("hi")],
  ["numWrapper", () => Object(5)],
  ["map", () => new Map([["k", 1]])],
  ["set", () => new Set([1])],
  ["fn", () => function f(a, b) { return a + b; }],
  ["classInst", () => { class C { constructor() { this.own = 1; } get g() { return 2; } } return new C(); }],
  ["accessorOwn", () => Object.defineProperty({ a: 1 }, "acc", { get() { return 9; }, enumerable: true }) ],
  ["nonEnum", () => Object.defineProperty({ a: 1 }, "hidden", { value: 2, enumerable: false })],
  ["symKey", () => ({ a: 1, [Symbol("s")]: 2 })],
  ["protoChain", () => Object.create({ inherited: 1 }, { own: { value: 2, enumerable: true } })],
  ["proxyArray", () => new Proxy([1, 2], {})],
  ["frozen", () => Object.freeze({ a: 1 })],
  ["detached", () => { const a = new Uint8Array([1, 2]); a.buffer.transfer(); return a; }],
];
for (const [name, mk] of CASES) {
  let out;
  try { out = JSON.stringify(surfaces(mk())); } catch (e) { out = "SETUP-ERR:" + e.constructor.name; }
  console.log(name, out);
}
