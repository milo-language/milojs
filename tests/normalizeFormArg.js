// String.prototype.normalize does NOT normalize here (tracked in the backlog:
// it returns its input, so "é".normalize("NFC") stays two code points).
// The form ARGUMENT is validated though, because that costs nothing and an
// invalid form is a RangeError in the spec: rejecting a typo loudly is worth
// more than pretending to normalize for it.
//
// This fixture asserts only the part that matches node. The normalization gap
// itself is deliberately not encoded here, so this file does not have to be
// rewritten when it is fixed.
function p(n, f) { try { console.log(n, String(f())); } catch (e) { console.log(n, e.constructor.name); } }

for (const form of ["NFC", "NFD", "NFKC", "NFKD"]) {
  p("valid form " + form, () => typeof "abc".normalize(form));
}
p("no argument", () => typeof "abc".normalize());
p("undefined argument", () => typeof "abc".normalize(undefined));
p("invalid form", () => "abc".normalize("NFZ"));
p("lowercase form", () => "abc".normalize("nfc"));
p("empty form", () => "abc".normalize(""));
p("numeric form", () => "abc".normalize(1));
p("ascii is unchanged", () => "abc".normalize("NFC"));
p("already composed stays", () => "é".normalize("NFC") === "é");

// isWellFormed/toWellFormed scan for unpaired surrogates rather than asserting
// that UTF-8 makes them impossible. Only strings milojs can actually build are
// asserted here: node keeps a lone surrogate that this engine substitutes at
// construction, which is a representation gap tracked in the backlog, not a
// property of these two functions.
console.log("ascii:", "ab".isWellFormed(), "emoji:", "\u{1F600}".isWellFormed());
console.log("toWellFormed is identity for well-formed input:",
  "ab".toWellFormed() === "ab", "\u{1F600}".toWellFormed() === "\u{1F600}");
console.log("mixed:", "a\u{1F600}b".isWellFormed(), "a\u{1F600}b".toWellFormed().length);
