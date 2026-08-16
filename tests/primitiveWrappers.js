// `new String("a")`, `new Number(1)`, `new Boolean(false)` and `Object(prim)`
// used to hand back the PRIMITIVE. That got three observable things wrong at
// once: typeof said "string", `new Boolean(false)` was falsy, and the result was
// === its own primitive. It also made `0 in Object("a")` throw, because the
// `in` really was being applied to a string.
//
// Found by running npm packages' own test suites: array.prototype.every probes
// `!(0 in Object("a"))` on its first line, and it is a dependency of tape.
const p = (l, f) => { try { console.log(l, JSON.stringify(f())); } catch (e) { console.log(l, "ERR " + e.message); } };

p("typeof", () => [typeof new String("a"), typeof new Number(1), typeof new Boolean(false), typeof Object("a")]);
p("truthy", () => [!!new Boolean(false), !!new Number(0), !!new String("")]);
p("identity", () => [new String("a") === "a", Object("a") === "a", new Number(1) === 1]);
p("loose eq", () => [new String("a") == "a", new Number(1) == 1, new Boolean(false) == false]);
p("in", () => [0 in Object("a"), "length" in Object("a"), 5 in Object("a")]);
p("tags", () => [Object.prototype.toString.call(new String("a")),
                 Object.prototype.toString.call(new Number(1)),
                 Object.prototype.toString.call(new Boolean(true))]);
p("valueOf", () => [new String("ab").valueOf(), new Number(7).valueOf(), new Boolean(false).valueOf()]);
p("methods", () => [new String("ab").toUpperCase(), new Number(1.234).toFixed(2), new String("abc").slice(1)]);
p("coercion", () => ["x" + new String("y"), `${new Number(3)}`, new Number(2) * 3, String(new String("z")), Number(new Number(7))]);
p("indices", () => [new String("hey").length, new String("hey")[1], Object.keys(new String("ab"))]);
p("descriptor", () => Object.getOwnPropertyDescriptor(new String("ab"), "0"));
p("length descriptor", () => Object.getOwnPropertyDescriptor(new String("ab"), "length"));
p("iteration", () => [[...new String("ab")], Array.from(new String("ab"))]);
p("for-in", () => { const r = []; for (const k in new String("ab")) r.push(k); return r; });
p("instanceof", () => [new String("a") instanceof String, new Number(1) instanceof Number,
                       new Boolean(true) instanceof Boolean, new String("a") instanceof Number]);
p("constructor", () => [new String("a").constructor.name, new Number(1).constructor.name]);
p("JSON", () => [JSON.stringify(new String("ab")), JSON.stringify(new Number(5)),
                 JSON.stringify(new Boolean(false)), JSON.stringify({ a: new String("x"), b: new Number(2) })]);
p("Object() boxes once", () => { const o = Object("a"); return Object(o) === o; });
p("distinct identities", () => { const m = new Map(); m.set(new String("a"), 1); m.set(new String("a"), 2); return m.size; });
p("called without new", () => [typeof String(1), typeof Number("2"), typeof Boolean(0)]);
// Object.prototype's own methods are non-enumerable, so a for-in over anything
// whose chain reaches it does not list them
p("proto not enumerated", () => { const r = []; for (const k in Object("a")) r.push(k); return r; });
