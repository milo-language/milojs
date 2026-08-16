// The regex engine matched BYTES, not code points, and split ignored zero-width
// matches and capture groups. Both show up on ordinary text.
function p(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "THREW " + e.name); } }

// `.` is one character, not one byte
p("dot pieces", () => "aéb".match(/./gu).join("|"));
p("dot anchored", () => /^a.b$/.test("aéb"));
p("astral dot", () => /^.$/u.test("😀"));
p("cjk count", () => "漢字".match(/./gu).length);
p("dotall newline", () => /^a.b$/s.test("a\nb"));
p("dot excludes newline", () => /a.b/.test("a\nb"));
p("ascii unaffected", () => "abc".match(/./g).join("|"));

// a quantifier binds to the whole character, not its last byte
p("literal +", () => /^é+$/u.test("ééé"));
p("literal *", () => "ééx".replace(/é*/u, "-"));
p("literal ?", () => /^é?x$/u.test("éx"));
p("literal {2}", () => /^é{2}$/u.test("éé"));
p("astral +", () => /^😀+$/u.test("😀😀"));
p("greedy over cp", () => "éée".match(/^é*/u)[0]);
p("alt of cps", () => /^(?:é|x)+$/u.test("éxé"));
p("index after cp", () => "aéb".search(/b/));

// split: a zero-width separator splits, and captures become elements
p("camelCase", () => "fooBarBaz".split(/(?=[A-Z])/));
p("lookbehind", () => "a1b2".split(/(?<=\d)/));
p("empty regex", () => "abc".split(/(?:)/));
p("empty alt", () => "abc".split(/x*/));
p("capture kept", () => "a1b".split(/(\d)/));
p("two captures", () => "a1b2c".split(/(\d)(?:)/));
p("optional capture", () => "aXb".split(/(y)?X/));
p("plain separator", () => "a,b,c".split(/,/));
p("no match", () => "abc".split(/z/));
p("empty input", () => "".split(/x/));
p("empty input empty re", () => "".split(/(?:)/));
p("separator at ends", () => ",a,".split(/,/));
p("multibyte separator", () => "aébéc".split(/é/u));
