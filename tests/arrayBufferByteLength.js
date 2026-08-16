// ArrayBuffer.prototype.byteLength is an ACCESSOR on the prototype, not a data
// property on the instance. It was missing entirely, and the consequence was
// three packages away:
//
//   is-array-buffer keys on that descriptor. Without it, its fallback answered
//   TRUE for every object — a plain array, a typed array, `{}`. deep-equal then
//   took its ArrayBuffer branch, wrapped the value in `new Uint8Array(a)`, and
//   recursed on the result for ever, so `deepEqual([1,2],[1,2])` exhausted the
//   stack. tape's deepEqual is built on that, which is why function-bind,
//   object.assign and array.prototype.flatmap could not finish either.
//
// Reading the value was never the problem: `new ArrayBuffer(8).byteLength` has
// always answered 8, because the instance carried it. Only the DESCRIPTOR was
// absent, and only code that inspects descriptors could tell.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };

const d = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength");
console.log("descriptor:", d ? `get=${typeof d.get} set=${typeof d.set} e=${d.enumerable} c=${d.configurable}` : "MISSING");
t("value", () => new ArrayBuffer(8).byteLength);
t("empty", () => new ArrayBuffer(0).byteLength);
t("not an own property of the instance", () => Object.prototype.hasOwnProperty.call(new ArrayBuffer(4), "byteLength"));
t("own on the prototype", () => Object.prototype.hasOwnProperty.call(ArrayBuffer.prototype, "byteLength"));
t("getter on a plain object", () => d.get.call({}));
t("getter on an array", () => d.get.call([1, 2]));
t("getter on a typed array", () => d.get.call(new Uint8Array(4)));
t("getter on a real buffer", () => d.get.call(new ArrayBuffer(16)));
t("byteLength of a sliced buffer", () => new ArrayBuffer(8).slice(2).byteLength);
t("survives a resize", () => { const b = new ArrayBuffer(4, { maxByteLength: 16 }); b.resize(12); return b.byteLength; });
