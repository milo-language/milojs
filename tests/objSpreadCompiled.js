// Object spread and `__proto__:` inside function bodies, which the bytecode VM
// compiles. It used to store the spread under the literal key "...".
const d = { a: 1, b: 2 };
const keys = (x) => Object.keys(x).join(",");
function alone() { return keys({ ...d }); }
function after() { return keys({ z: 0, ...d }); }
function before() { return keys({ ...d, type: "q" }); }
function param(p) { return keys({ ...p, c: 3 }); }
const o = { m() { return keys({ ...d }); } };
class C { m() { return keys({ ...d, k: 1 }); } }
function proto() { const x = { __proto__: d, own: 1 }; return keys(x) + " " + x.a; }
function nullProto() { return Object.getPrototypeOf({ __proto__: null }) === null; }
console.log(alone(), after(), before(), param(d));
console.log(o.m(), new C().m(), proto(), nullProto());
// the shape tRPC's procedure builder depends on
function build(def1, def2) {
    const { middlewares = [], inputs, ...rest } = def2;
    return { ...rest, inputs: [...def1.inputs, ...inputs ?? []], middlewares: [...def1.middlewares, ...middlewares] };
}
const base = { procedure: true, inputs: [], middlewares: [] };
const q = build({ ...base, type: "query" }, { resolver: 1, middlewares: [2] });
console.log(keys(q), q.inputs.length, q.middlewares.length);
