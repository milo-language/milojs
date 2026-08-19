// `"".repeat(Infinity)` HUNG the engine. The count guard bounded the PRODUCT of
// count and string length, and that check is skipped when the string is empty, so
// an infinite count fell through to a loop that appended nothing several
// quintillion times. The spec makes a negative or infinite count a RangeError on
// its own, independent of the string, which is what is checked now. NaN is not an
// error: ToIntegerOrInfinity turns it into 0.
var cases = [["", Infinity], ["a", Infinity], ["", -Infinity], ["", -1], ["a", -1],
             ["", NaN], ["a", NaN], ["", 0], ["", 5], ["ab", 3], ["a", 1e9],
             ["", 1e9], ["abc", 0], ["a", 2.9]];
console.log(cases.map(function (c) {
  var label = JSON.stringify(c[0]) + ".repeat(" + String(c[1]) + ")";
  try { return label + " = " + JSON.stringify(c[0].repeat(c[1])); }
  catch (e) { return label + " = " + e.constructor.name; }
}).join("\n"));
// padStart/padEnd carry the same cap and must stay consistent with it
console.log(["a".padStart(5, "ab"), "a".padEnd(5, "ab"), "a".padStart(2, "")].join("|"));
console.log((function () { try { "a".padStart(Infinity); return "no-throw"; } catch (e) { return e.constructor.name; } })());
