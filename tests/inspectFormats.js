// console.log's formatting across object kinds. Typed arrays, ArrayBuffer,
// Promise, Proxy, primitive wrappers and null-prototype objects all printed `{}`
// -- the value a debugger prints most often, showing nothing at all. A sparse
// array stopped at its element vector, so `const a = [1]; a[3] = 4` printed
// `[ 1 ]`, and a class printed as a plain function.
//
// DataView is left out: node prints it across four lines whose wrapping depends
// on terminal width, and an Error is left out because its stack is a machine path.
const CASES = [
  ["u8", new Uint8Array([1, 2, 3])],
  ["u8empty", new Uint8Array(0)],
  ["i32", new Int32Array([1, 2])],
  ["f64", new Float64Array([1.5])],
  ["big64", new BigInt64Array([1n])],
  ["ab", new ArrayBuffer(4)],
  ["map", new Map([["k", 1]])],
  ["set", new Set([1, 2])],
  ["arr", [1, 2, 3]],
  ["sparse", (() => { const a = [1]; a[3] = 4; return a; })()],
  ["hole", [1, , 3]],
  ["obj", { a: 1, b: { c: 2 } }],
  ["fn", function foo() {}],
  ["arrow", () => 1],
  ["cls", class Foo {}],
  ["anonCls", (0, class {})],
  ["date", new Date(0)],
  ["re", /ab+c/gi],
  ["sym", Symbol("s")],
  ["bigint", 10n],
  ["nested", { x: [1, { y: 2 }] }],
  ["proxy", new Proxy({ a: 1 }, {})],
  ["proxyArr", new Proxy([1, 2], {})],
  ["resolved", Promise.resolve(1)],
  ["strObj", Object("hi")],
  ["numObj", Object(5)],
  ["boolObj", Object(true)],
  ["nullProto", Object.create(null)],
  ["nullProtoProps", Object.assign(Object.create(null), { a: 1 })],
];
for (const [n, v] of CASES) console.log(n + ":", v);

// a class constructor is not callable without `new`
class Bare {}
try { Bare(); } catch (e) { console.log("call class:", e.constructor.name, e.message); }
class WithCtor { constructor() { this.x = 1; } }
try { WithCtor(); } catch (e) { console.log("call class ctor:", e.constructor.name, e.message); }
console.log("new still works:", new WithCtor().x, new Bare() instanceof Bare);
