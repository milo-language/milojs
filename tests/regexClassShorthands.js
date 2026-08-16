// `\S`, `\D` and `\W` inside a character class were not recognised, so they fell
// through to the escape reader and became the literal letters S, D and W.
// `[\s\S]` therefore meant "whitespace or the letter S": it matched a newline but
// not a letter, so `[\s\S]*` matched the EMPTY string and `[\s\S]+` matched
// nothing. Found in the wild — an express app rewriting HTML with
// /<title>[\s\S]*?<\/title>/ silently left the page untouched.
function p(n, f) { try { const v = f(); console.log(n, v === null ? "null" : JSON.stringify(v)); } catch (e) { console.log(n, "THREW"); } }

const s = "aXbXc";
p("[\\s\\S]*", () => s.match(/a[\s\S]*X/)[0]);
p("[\\s\\S]+", () => s.match(/a[\s\S]+X/)[0]);
p("[\\s\\S]{1,9}", () => s.match(/a[\s\S]{1,9}X/)[0]);
p("[\\s\\S]{2}", () => "ab".match(/[\s\S]{2}/)[0]);
p("[\\s\\S]* alone", () => "abc".match(/[\s\S]*/)[0]);
p("[\\d\\D]*", () => s.match(/a[\d\D]*X/)[0]);
p("[\\w\\W]*", () => s.match(/a[\w\W]*X/)[0]);
p("[\\S]*", () => s.match(/a[\S]*X/)[0]);
p("[^]*", () => s.match(/a[^]*X/)[0]);

// each negated shorthand on its own, against one char of every kind
for (const [nm, re] of [["[\\S]", /[\S]/], ["[\\D]", /[\D]/], ["[\\W]", /[\W]/],
                        ["[\\s]", /[\s]/], ["[\\d]", /[\d]/], ["[\\w]", /[\w]/]]) {
  console.log(nm, ["a", " ", "5", "!", "\n", "_"].map(c => (re.test(c) ? 1 : 0)).join(""));
}

// negating a negated shorthand, and mixing one with ordinary members
p("[^\\S] on 'a'", () => "a".match(/[^\S]/));
p("[^\\S] on ' '", () => " ".match(/[^\S]/)[0]);
p("[a\\S]", () => "b".match(/[a\S]/)[0]);
p("[\\S-]", () => "b".match(/[\S-]/)[0]);

// the shape that found it: a lazy match across newlines through a close tag
const html = "<title>\n  A & B\n</title>\n<meta\n  name=\"description\"\n  content=\"x\"\n/>";
p("title rewrite", () => html.replace(/<title>[\s\S]*?<\/title>/, "<title>T</title>"));
p("meta rewrite", () => html.replace(/<meta\s+name="description"[\s\S]*?\/>/, "<meta/>"));
p("greedy across", () => "aXbXc".match(/a[\s\S]*X/)[0]);
p("nested lazy", () => "<a><b></b></a>".replace(/<a>[\s\S]*?<\/a>/, "X"));
