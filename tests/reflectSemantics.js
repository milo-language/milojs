// Reflect.* against the Object.* operations it mirrors. The whole point of
// Reflect is that it ANSWERS where Object throws, and milojs got 23 of 24 right.
//
// The one failure was mine, from the day before: making strict-mode `delete`
// throw on a non-configurable property broke Reflect.deleteProperty, because the
// prelude implemented it as `delete target[key]` and the prelude is strict. It
// has a native now -- which then had to learn to run a proxy's deleteProperty
// trap, since bypassing it made `delete p.a` and Reflect.deleteProperty(p, "a")
// fire the trap a different number of times.
function t(n, f) { try { const v = f(); console.log(n, "OK", typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
const frozen = Object.freeze({ a: 1 });
const sealed = Object.seal({ a: 1 });
const nonext = Object.preventExtensions({ a: 1 });
t("Reflect.set frozen", () => Reflect.set(frozen, "a", 2));
t("Reflect.set new on frozen", () => Reflect.set(frozen, "b", 1));
t("Reflect.set sealed existing", () => Reflect.set(sealed, "a", 2));
t("Reflect.set nonext new", () => Reflect.set(nonext, "b", 1));
t("Reflect.defineProperty nonconfig", () => { const o = {}; Object.defineProperty(o, "p", { value: 1, configurable: false }); return Reflect.defineProperty(o, "p", { value: 2 }); });
t("Reflect.deleteProperty nonconfig", () => { const o = {}; Object.defineProperty(o, "d", { value: 1, configurable: false }); return Reflect.deleteProperty(o, "d"); });
t("Reflect.setPrototypeOf frozen", () => Reflect.setPrototypeOf(frozen, { x: 1 }));
t("Reflect.preventExtensions", () => Reflect.preventExtensions({}));
t("Reflect.isExtensible frozen", () => Reflect.isExtensible(frozen));
t("Reflect.ownKeys", () => Reflect.ownKeys({ a: 1, [Symbol("s")]: 2 }).length);
t("Reflect.getPrototypeOf null-proto", () => Reflect.getPrototypeOf(Object.create(null)));
t("Reflect.has inherited", () => Reflect.has(Object.create({ k: 1 }), "k"));
t("Reflect.get with receiver", () => { const o = { get g() { return this.v; } }; return Reflect.get(o, "g", { v: 7 }); });
t("Reflect.set with receiver", () => { const target = {}; const recv = {}; Reflect.set(target, "k", 1, recv); return JSON.stringify([target.k, recv.k]); });
t("Reflect.apply", () => Reflect.apply(Math.max, null, [1, 3, 2]));
t("Reflect.construct", () => Reflect.construct(Date, [0]).getTime());
t("Reflect.construct newTarget", () => { function A() {} function B() {} const o = Reflect.construct(A, [], B); return Object.getPrototypeOf(o) === B.prototype; });
t("Reflect.construct non-ctor", () => Reflect.construct(() => {}, []));
t("Reflect.get on primitive", () => Reflect.get(5, "x"));
t("Reflect.ownKeys on primitive", () => Reflect.ownKeys(5));
t("Reflect.defineProperty bad desc", () => Reflect.defineProperty({}, "k", 5));
// Object.* counterparts must THROW where Reflect returns false
t("Object.defineProperty nonconfig", () => { const o = {}; Object.defineProperty(o, "p", { value: 1, configurable: false }); return Object.defineProperty(o, "p", { value: 2 }); });
t("Object.setPrototypeOf frozen", () => Object.setPrototypeOf(frozen, { x: 1 }));
const p=new Proxy({a:1},{deleteProperty(t,k){console.log("trap",k); return Reflect.deleteProperty(t,k)}}); console.log(delete p.a, Reflect.deleteProperty(p,"a"))
