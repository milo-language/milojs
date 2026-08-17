// A capture group inside a quantified body resets to undefined at the start of
// every iteration, so a group that does not participate in the LAST pass reads
// undefined rather than keeping what an earlier pass put there. milojs kept the
// stale value: /(z)((a+)?(b+)?(c))*/ on "zaacbbbcac" reported "bbb" for group 4
// where the spec (and node) report undefined.
const cases = [
  [/(z)((a+)?(b+)?(c))*/, "zaacbbbcac"],
  [/(?:(a)|(b))+/, "ab"],
  [/((a)|(b))*/, "ab"],
  [/(?:(a)(b)?)+/, "aab"],
  [/(?:(a)(b)?){2,3}/, "aab"],
  [/(a)|(b)/, "b"],
  // the empty-iteration rule still holds: (a*)* on "aaa" captures "aaa", not ""
  [/(a*)*/, "aaa"],
  [/(a*)+/, "aaa"],
];
for (const [re, s] of cases) console.log(String(re), "on", JSON.stringify(s), "=>", String(re.exec(s)));

// \c followed by a non-letter is not a control escape: it is a literal
// backslash, and the character after it is ordinary. /\c0/ matches "\c0".
console.log("backslash-c-zero:", JSON.stringify(/\c0/.exec("\\c0")[0]));
console.log("control escape still works:", /\cA/.exec(String.fromCharCode(1))[0].charCodeAt(0));

// Date.parse accepts every date-only ISO form, all read as UTC
for (const s of ["1000", "2000", "2000-01", "2000-01-02"]) console.log("parse", s, "->", Date.parse(s));
