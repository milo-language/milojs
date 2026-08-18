// Every numeric argument to a built-in goes through ToNumber, which RUNS a user
// valueOf. milojs converted many of them with an internal coercion that cannot
// re-enter the interpreter, so an object argument silently became 0 (or NaN for a
// float target) and the call did the wrong thing without erroring.
function n(v) { return { valueOf: function () { return v; } }; }

console.log("ta.with-value:", new Int32Array([1, 2, 3]).with(0, n(7))[0]);
console.log("ta.with-index:", new Int32Array([1, 2, 3]).with(n(1), 9).join(","));
console.log("f64.with:", new Float64Array([1, 2]).with(0, n(2.5))[0]);
console.log("arr.with-index:", [1, 2, 3].with(n(1), 9).join(","));
console.log("toSpliced:", [1, 2, 3].toSpliced(n(1), 1).join(","));
console.log("ta.at:", new Int32Array([1, 2, 3]).at(n(1)));
console.log("arr.at:", [5, 6, 7].at(n(2)));
console.log("ta.fill:", new Int32Array([1, 2, 3]).fill(n(8)).join(","));
console.log("arr.slice:", [1, 2, 3, 4].slice(n(1), n(3)).join(","));
console.log("ta.subarray:", new Int32Array([1, 2, 3, 4]).subarray(n(1), n(3)).join(","));
console.log("arr.indexOf:", [1, 2, 3].indexOf(3, n(1)));
console.log("repeat:", "ab".repeat(n(2)));

// Conversion order is observable: each argument's valueOf runs once, left to right.
var order = [];
function tick(tag, v) { return { valueOf: function () { order.push(tag); return v; } }; }
[1, 2, 3].slice(tick("a", 0), tick("b", 2));
console.log("order:", order.join(","));

// TypedArray.prototype.with must re-validate after user code moved the buffer.
function guard(f) { try { return String(f()); } catch (e) { return "threw " + e.constructor.name; } }
console.log("detach:", guard(function () {
  var ab = new ArrayBuffer(16), ta = new Int32Array(ab);
  return ta.with(0, { valueOf: function () { ab.transfer(); return 9; } })[0];
}));
console.log("resize0:", guard(function () {
  var ab = new ArrayBuffer(16, { maxByteLength: 16 }), ta = new Int32Array(ab);
  return ta.with(0, { valueOf: function () { ab.resize(0); return 9; } })[0];
}));
console.log("shrink:", guard(function () {
  var ab = new ArrayBuffer(4096, { maxByteLength: 4096 }), ta = new Int32Array(ab);
  for (var i = 0; i < ta.length; i++) ta[i] = 0x42424242;
  var r = ta.with(0, { valueOf: function () { ab.resize(4); return 999; } });
  return [r[0], r.length, r[1], r[1023]].join("/");
}));
