// A class ESCAPE cannot be a range bound: it is a set, not a code point. Annex B
// makes the `-` literal in `[a-\d]`, keeping the class valid, while the u flag
// makes it an early error. milojs read the BACKSLASH as the bound, which is code
// point 92 and below most literals, so it rejected the class as a reversed range
// and a perfectly legal pattern threw.
var cases = [["[a-\\d]", ""], ["[a-\\d]", "u"], ["[\\d-z]", ""], ["[b-a]", ""],
             ["[z-a]", ""], ["[\\w-\\s]", ""], ["[a-]", ""], ["[a-]", "u"],
             ["[]", ""], ["[^]", ""], ["[a-c]", ""], ["[a-c]", "u"]];
console.log(cases.map(function (c) {
  try { new RegExp(c[0], c[1]); return c[0] + "/" + c[1] + " ok"; }
  catch (e) { return c[0] + "/" + c[1] + " " + e.constructor.name; }
}).join("\n"));
// and the literal `-` really is a member, while the escape still matches its set
var r = /[a-\d]/;
console.log("members:", r.test("a"), r.test("-"), r.test("5"), r.test("z"));
console.log("ranges-still-work:", /[a-c]/.test("b"), /[a-c]/.test("d"));
