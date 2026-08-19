// Four regex bugs found by differential-testing 927 pattern/flag/input/API
// combinations against node. All four affect WORKING code, not just diagnostics.
//
//  - the sticky flag `y` was never implemented: flagY did not exist, so /a/y
//    searched forward like a plain regex and lastIndex never moved
//  - `test` ran its own bare search from 0 instead of being `exec(s) !== null`,
//    so lastIndex was ignored there even for a GLOBAL regex
//  - `split` with a regex separator dropped its limit argument (the string
//    separator form already honoured it)
//  - `$\`` and `$'` in a replacement were passed through literally
//  - inside a character class `\b` is BACKSPACE, not a word boundary
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "ERR", e.constructor.name); } }

t("y-anchors-at-lastIndex", () => { var r = /a/y; r.lastIndex = 1; return [r.test("ba"), r.lastIndex]; });
t("y-does-not-search", () => { var r = /a/y; r.lastIndex = 0; return [r.test("ba"), r.lastIndex]; });
t("y-failure-resets", () => { var r = /a/y; r.lastIndex = 5; return [r.test("ba"), r.lastIndex]; });
t("y-loop", () => { var r = /\w/y, o = [], m; while ((m = r.exec("ab"))) o.push(m[0] + "@" + r.lastIndex); return o; });
t("gy", () => { var r = /a/gy; r.lastIndex = 1; return [r.test("ba"), r.lastIndex]; });
t("flags-report", () => { var r = /a/gy; return [r.flags, r.sticky, r.global]; });

t("test-advances-g", () => { var r = /a/g; r.lastIndex = 0; return [r.test("ba"), r.lastIndex]; });
t("test-plain-unchanged", () => { var r = /a/; return [r.test("ba"), r.lastIndex]; });

t("split-limit", () => "a,b,c".split(/,/, 2));
t("split-limit-zero", () => "a,b,c".split(/,/, 0));
t("split-limit-big", () => "a,b,c".split(/,/, 99));
t("split-limit-captures", () => "a1b2c".split(/(\d)/, 3));
t("split-no-limit", () => "a,b,c".split(/,/));
t("split-limit-undefined", () => "a,b,c".split(/,/, undefined));

t("replace-before-after", () => "abc".replace(/b/, "[$`|$'|$$|$&]"));
t("replace-before-global", () => "xay".replace(/a/g, "<$`>"));
t("replace-group-and-context", () => "abc".replace(/(b)/, "$1$`$'"));

t("class-backspace", () => [/[\b]/.test("\b"), /[\b]/.test("b"), /[a\b]/.test("\b")]);
t("word-boundary-intact", () => ["a b".replace(/\b/g, "|"), /\b/.test("a b")]);
