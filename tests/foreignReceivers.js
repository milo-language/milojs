// Prototype methods called on a receiver they do not belong to, and `new` on
// things that are not constructors. Six of these 27 answered undefined or built
// an object where node throws -- a call that silently does nothing reads to the
// caller exactly like a call that worked.
//
// The brand machinery already existed for Map, Set and Date; Promise and RegExp
// had no brand at all, and Function.prototype.call/apply/bind were unbranded even
// though toString beside them was branded callable.
function t(n, f) { try { const v = f(); console.log(n, "OK", typeof v === "object" ? JSON.stringify(v) : String(v)); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
// prototype methods on a foreign receiver
t("Map.get", () => Map.prototype.get.call({}, "k"));
t("Map.set", () => Map.prototype.set.call({}, "k", 1));
t("Map.size", () => Object.getOwnPropertyDescriptor(Map.prototype, "size").get.call({}));
t("Set.add", () => Set.prototype.add.call({}, 1));
t("Set.has", () => Set.prototype.has.call({}, 1));
t("Date.getTime", () => Date.prototype.getTime.call({}));
t("Date.toISOString", () => Date.prototype.toISOString.call({}));
t("RegExp.exec", () => RegExp.prototype.exec.call({}, "x"));
t("RegExp.source", () => Object.getOwnPropertyDescriptor(RegExp.prototype, "source").get.call({}));
t("Promise.then", () => Promise.prototype.then.call({}, () => {}));
t("Array.push-obj", () => { const o = { length: 0 }; Array.prototype.push.call(o, 1); return o.length; });
t("TA.byteLength", () => Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength").get.call({}));
t("TA.subarray", () => Uint8Array.prototype.subarray.call({}, 0));
t("DataView.getInt8", () => DataView.prototype.getInt8.call({}, 0));
t("WeakMap.get", () => WeakMap.prototype.get.call({}, {}));
t("Function.bind", () => Function.prototype.bind.call({}));
t("Function.toString", () => Function.prototype.toString.call({}));
t("Error.toString", () => Error.prototype.toString.call({}));
t("Symbol.toString", () => Symbol.prototype.toString.call({}));
t("String.charAt", () => String.prototype.charAt.call(null, 0));
// new on things that are not constructors
t("new arrow", () => new (() => 1)());
t("new method", () => { const o = { m() {} }; return new o.m(); });
t("new Symbol", () => new Symbol());
t("new BigInt", () => new BigInt(1));
t("new Math.max", () => new Math.max());
t("new bound-arrow", () => new ((() => 1).bind(null))());
t("new getter", () => { const o = { get g() { return 1; } }; return new (Object.getOwnPropertyDescriptor(o, "g").get)(); });
