// GetOption, which nothing in lib/temporal.js implemented. An option was read as
// a bare property and coerced with String(): a symbol did not throw where
// ToString must, an invalid value was accepted rather than rejected, and the
// `overflow` option was never read at all — `{ overflow: "bogus" }` was silently
// fine. node 25 has no Temporal, so this is checked against test262, not node.
const bad = [["null", null], ["true", true], ["string", "s"], ["number", 1],
             ["bigint", 2n], ["object", {}], ["symbol", Symbol()]];
function classify(f) {
  const out = [];
  for (const [name, v] of bad) {
    try { f(v); out.push(name + "=NONE"); }
    catch (e) { out.push(name + "=" + e.constructor.name); }
  }
  return out.join(" ");
}
const dt = new Temporal.PlainDateTime(2000, 5, 2, 12, 34, 56, 123, 987, 500);
console.log("roundingMode:", classify((v) => dt.round({ smallestUnit: "microsecond", roundingMode: v })));
console.log("smallestUnit:", classify((v) => dt.round({ smallestUnit: v })));
console.log("overflow    :", classify((v) => Temporal.PlainTime.from("12:00", { overflow: v })));
console.log("options bag :", classify((v) => Temporal.PlainTime.from({ hour: 12 }, v)));

// an unknown string value for a known option is a RangeError, not accepted
for (const [label, f] of [
  ["overflow", () => Temporal.PlainTime.from("12:00", { overflow: "bogus" })],
  ["roundingMode", () => dt.round({ smallestUnit: "hour", roundingMode: "bogus" })],
]) {
  try { f(); console.log(label, "bogus: NONE"); } catch (e) { console.log(label, "bogus:", e.constructor.name); }
}

// from.length is 1: the options bag is a spec parameter but not a counted one
for (const c of ["PlainDate", "PlainTime", "PlainDateTime", "PlainYearMonth", "PlainMonthDay", "ZonedDateTime"]) {
  console.log(c + ".from.length:", Temporal[c].from.length);
}

// reading `overflow` is observable, and must not happen until the item itself
// has parsed: a bad string throws without the bag ever being touched
const seen = [];
const observed = new Proxy({ overflow: "constrain" }, {
  get(t, k) { if (typeof k === "string") seen.push(k); return t[k]; },
});
try { Temporal.PlainMonthDay.from("13-34", observed); console.log("bad string: NONE"); }
catch (e) { console.log("bad string:", e.constructor.name); }
console.log("options read while parsing failed:", JSON.stringify(seen));

// String(obj) coerces exactly once, and after @@toPrimitive rather than before
const order = [];
const o = {
  get [Symbol.toPrimitive]() { order.push("get @@toPrimitive"); return undefined; },
  get toString() { order.push("get toString"); return function () { order.push("call toString"); return "floor"; }; },
};
dt.round({ smallestUnit: "microsecond", roundingMode: o });
console.log("coercion order:", order.join(","));
