// Array.prototype methods are generic: the spec defines them over any object
// with a `length` and indexed properties, and over strings. These all used to
// return undefined silently rather than throw, which is the dangerous kind of
// wrong — library code branches on the result.

// read-only methods over an array-like
var o = { length: 3, 0: "a", 1: "b", 2: "c" };
console.log(Array.prototype.join.call(o, "-"));
console.log(Array.prototype.indexOf.call(o, "b"));
console.log(Array.prototype.includes.call(o, "c"));
console.log(Array.prototype.slice.call(o, 1).join(","));
console.log(Array.prototype.map.call(o, function (v) { return v + v; }).join(","));
console.log(Array.prototype.filter.call(o, function (v) { return v !== "b"; }).join(","));
console.log(Array.prototype.reduce.call(o, function (acc, v) { return acc + v; }, ""));
console.log(Array.prototype.every.call(o, function (v) { return typeof v === "string"; }));
console.log(Array.prototype.some.call(o, function (v) { return v === "c"; }));

var seen = [];
Array.prototype.forEach.call(o, function (v) { seen.push(v); });
console.log(seen.join(""));

// strings index as their units
console.log(Array.prototype.map.call("abc", function (c) { return c.toUpperCase(); }).join(""));
console.log(Array.prototype.filter.call("hello", function (c) { return c !== "l"; }).join(""));

// the callback's 3rd argument is the ORIGINAL object, not an internal copy
var orig = { length: 1, 0: "x" };
Array.prototype.forEach.call(orig, function (v, i, a) { console.log(a === orig); });

// mutating methods write back through to the receiver
var p = { length: 2, 0: "a", 1: "b" };
console.log(Array.prototype.push.call(p, "c"), p.length, p[2]);

var q = { length: 3, 0: 1, 1: 2, 2: 3 };
console.log(Array.prototype.pop.call(q), q.length, q[2]);

var r = { length: 3, 0: 1, 1: 2, 2: 3 };
Array.prototype.reverse.call(r);
console.log(r[0], r[1], r[2], r.length);

var s = { length: 3, 0: 3, 1: 1, 2: 2 };
Array.prototype.sort.call(s);
console.log(s[0], s[1], s[2]);

var t = { length: 3, 0: "a", 1: "b", 2: "c" };
console.log(Array.prototype.shift.call(t), t[0], t.length);

// a missing index is a hole: the callback skips it, join still emits the gap
var sparse = { length: 3, 0: "a", 2: "c" };
console.log(Array.prototype.join.call(sparse, ","));

// an own method of that name still wins — generic dispatch must not hijack it
console.log({ map: function () { return "MINE"; } }.map());

// nesting: a generic call inside a generic callback keeps its own receiver
var n1 = { length: 2, 0: "a", 1: "b" };
console.log(
  Array.prototype.map
    .call(n1, function (v, i, a) {
      return Array.prototype.join.call({ length: 2, 0: v, 1: i }, "/") + (a === n1 ? "!" : "?");
    })
    .join(",")
);

// real arrays and real strings are untouched by any of this
console.log([3, 1, 2].sort().join(","));
console.log([1, 2].map(function (v, i, a) { return a.length; }).join(","));
console.log("abc".slice(1), "abc".indexOf("b"), "ab".concat("c"));

// null/undefined receivers throw rather than returning undefined
try { Array.prototype.join.call(null); } catch (e) { console.log(e.name); }
try { Array.prototype.forEach.call(undefined, function () {}); } catch (e) { console.log(e.name); }

// a receiver with no length behaves as empty
console.log(Array.prototype.join.call({ 0: "a" }, ","), "|");
console.log(Array.prototype.map.call({}, function (v) { return v; }).length);
