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
