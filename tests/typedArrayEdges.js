// Typed arrays: index canonicalisation, key enumeration, and what happens when
// the buffer is detached in the middle of an operation. Nine of these 32 cases
// disagreed with node.
//
// The enumeration half is the surprising one: a typed array's indices live in the
// buffer, not in the object's property table, and five separate key walks
// (ownKeysOf, Object.keys, Object.values/entries, for-in, and the JS-level
// JSON.stringify that walks with for-in) each had their own array branch and none
// had a typed-array one. So Object.keys(u8) was [], and JSON.stringify(u8) was {}.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "ERR", e.constructor.name); } }
const mk = () => new Uint8Array([1, 2, 3, 4]);

// basics
t("of", () => Array.from(Uint8Array.of(1, 2, 3)));
t("from-iter", () => Array.from(Uint8Array.from([1, 2, 3])));
t("subarray", () => Array.from(mk().subarray(1, 3)));
t("slice", () => Array.from(mk().slice(1, 3)));
t("set-offset", () => { const a = mk(); a.set([9, 9], 2); return Array.from(a); });
t("fill-range", () => Array.from(mk().fill(7, 1, 3)));
t("copyWithin", () => Array.from(mk().copyWithin(0, 2)));
t("sort-default", () => Array.from(new Uint8Array([10, 9, 2]).sort()));
t("sort-cmp", () => Array.from(new Uint8Array([1, 2, 3]).sort((a, b) => b - a)));
t("at-negative", () => mk().at(-1));
t("indexOf-fromIndex", () => mk().indexOf(2, 2));
t("includes-NaN", () => new Float64Array([NaN]).includes(NaN));
t("join", () => mk().join("-"));
t("toString", () => mk().toString());
t("reverse", () => Array.from(mk().reverse()));
t("with", () => Array.from(mk().with(0, 9)));
t("toSorted", () => Array.from(new Uint8Array([3, 1, 2]).toSorted()));
t("byteLength", () => [mk().byteLength, mk().byteOffset, mk().length]);
t("BYTES_PER", () => [Uint8Array.BYTES_PER_ELEMENT, Float64Array.BYTES_PER_ELEMENT]);

// out-of-range writes are dropped, not stored as properties
t("oob-write", () => { const a = mk(); a[99] = 5; return [a[99], Object.keys(a).length]; });
t("frac-index", () => { const a = mk(); a["1.5"] = 5; return [a["1.5"], a[1]]; });
t("neg-index", () => { const a = mk(); a[-1] = 5; return [a[-1], Object.keys(a).length]; });
t("clamp-u8", () => { const a = new Uint8Array(1); a[0] = 300; return a[0]; });
t("clamped", () => { const a = new Uint8ClampedArray(1); a[0] = 300; return a[0]; });
t("int8-wrap", () => { const a = new Int8Array(1); a[0] = 200; return a[0]; });

// detach during the operation
t("detach-then-read", () => { const a = mk(); structuredClone(a.buffer, { transfer: [a.buffer] }); return [a.length, a[0]]; });
t("detach-in-cmp", () => {
  const a = new Uint8Array([3, 1, 2]);
  return Array.from(a.sort(() => { structuredClone(a.buffer, { transfer: [a.buffer] }); return 0; }));
});
t("detach-in-cb", () => {
  const a = new Uint8Array([1, 2, 3]);
  const seen = [];
  a.forEach((v) => { seen.push(v); if (seen.length === 1) structuredClone(a.buffer, { transfer: [a.buffer] }); });
  return seen;
});
t("detach-in-valueOf", () => {
  const a = new Uint8Array([1, 2, 3]);
  return Array.from(a.fill({ valueOf() { structuredClone(a.buffer, { transfer: [a.buffer] }); return 7; } }));
});
