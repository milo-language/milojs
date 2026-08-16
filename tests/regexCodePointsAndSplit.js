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

// character CLASSES are code-point ranges too: they were u8, so `[à-ÿ]` was
// four bytes of which two happened to look like a range
p("range accented", () => /^[à-ÿ]$/u.test("é"));
p("range excludes ascii", () => /[à-ÿ]/u.test("a"));
p("negated over cp", () => /^[^a]$/u.test("é"));
p("negated rejects its own", () => /[^é]/u.test("é"));
p("class quantifier", () => /^[éx]+$/u.test("éxé"));
p("class match count", () => "aéb".match(/[^x]/gu).length);
p("cyrillic range", () => /^[а-я]+$/u.test("привет"));
p("cjk range", () => /^[一-龥]+$/u.test("漢字"));
p("astral in class", () => /^[😀]$/u.test("😀"));
p("mixed class", () => "a1é".match(/[a-z0-9é]/gu).join(""));
p("shorthand still works", () => [/\d/.test("5"), /\w/.test("_"), /\s/.test("\t"), /[\s\S]/.test("x")]);
p("case fold over cp", () => /[à-þ]/i.test("É"));
p("ascii class unaffected", () => "a1b".match(/[a-z]/g).join(""));
