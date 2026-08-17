// Differential regex coverage: exec/test/replace/split/match across capture groups,
// lookaround, backreferences, flags, astral code points and property escapes.
//
// Written while replacing the recursive matcher with an iterative one. The recursive
// version exited SILENTLY with status 0 on a long subject and on any quantifier whose
// body could match empty, so a rewrite needed a way to prove the replacement agreed
// with node on everything that already worked. Every line here is node's output.
var cases = [
 [/abc/, "xxabcxx"], [/^abc$/, "abc"], [/a+/, "aaab"], [/a*/, "bbb"], [/a?b/, "ab"],
 [/a{2,3}/, "aaaa"], [/[a-z]+/, "ABCdefGH"], [/[^a-z]+/, "abcDEF"], [/\d+/, "ab123cd"],
 [/\w+/, "a_b-c"], [/\s+/, "a  b"], [/\D+/, "12ab34"], [/\W+/, "a!!b"], [/\S+/, " ab "],
 [/(a)(b)(c)/, "abc"], [/(a|b)+/, "abab"], [/(?:ab)+/, "ababab"], [/a(?=b)/, "ab"],
 [/a(?!b)/, "ac"], [/(?<=a)b/, "ab"], [/(?<!a)b/, "cb"], [/(a)\1/, "aa"], [/(a)\1/, "ab"],
 [/^$/, ""], [/\bfoo\b/, "a foo b"], [/\Bfoo/, "afoo"], [/./, "\n"], [/./s, "\n"],
 [/a.c/, "abc"], [/[\s\S]*/, "a\nb"], [/x*/, "yyy"], [/(a*)*/, "aaa"], [/(a|)*/, "b"],
 [/[abc]{2,}/, "aabbcc"], [/^(a+)+$/, "aaaa"], [/\x41/, "A"], [/A/, "A"],
 [/\u{1F600}/u, "\u{1F600}"], [/\p{L}+/u, "abcé123"], [/\P{L}+/u, "abc123"],
 [/[\p{Lu}\p{Nd}]+/u, "AB12ab"], [/a/i, "A"], [/ABC/i, "abc"], [/^a$/m, "b\na\nc"],
 [/(?<yr>\d{4})-(?<mo>\d{2})/, "2020-05"], [/a{0}/, "b"], [/(a)(b)?/, "a"],
 [/[-a-c]/, "-"], [/[\]]/, "]"], [/[^]/, "x"], [/\//, "/"], [/€/, "€"], [/é+/, "ééé"],
 [/(?:a|ab)c/, "abc"], [/a??b/, "ab"], [/a+?/, "aaa"], [/[0-9]{3,}/, "12345"],
 [/^\s*$/, "   "], [/(\w+)\s(\w+)/, "hello world"], [/\$\d+/, "$100"]
];
for (var i = 0; i < cases.length; i++) {
  var re = cases[i][0], s = cases[i][1];
  var out;
  try {
    var m = re.exec(s);
    out = m === null ? "null" : JSON.stringify([m.index, m[0]].concat(Array.prototype.slice.call(m, 1)));
    out += "|test=" + re.test(s);
    out += "|repl=" + s.replace(re, "<$&>");
    out += "|split=" + JSON.stringify(s.split(re));
    var g = new RegExp(re.source, re.flags.indexOf("g") >= 0 ? re.flags : re.flags + "g");
    out += "|all=" + JSON.stringify(s.match(g));
  } catch (e) { out = "THREW " + e.constructor.name; }
  console.log(i + " " + re.source + " /" + re.flags + " on " + JSON.stringify(s) + " => " + out);
}
