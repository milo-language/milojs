// RegExp semantics: lastIndex across exec/test/sticky, named groups, the
// argument shapes a replace callback receives, flags, indices, and the custom
// @@replace/@@split/@@match protocol. 8 of 29 disagreed with node.
//
// One of the eight was mine: branding RegExp.prototype's methods (so
// `exec.call({})` throws) also branded toString, which is GENERIC -- it reads
// `source` and `flags` off any object, so `RegExp.prototype.toString.call({
// source: "x", flags: "y" })` is "/x/y". It has its own internal name now, the
// same shape Error.prototype.toString needed.
//
// A RegExp SUBCLASS that overrides a symbol method is still not honoured: the
// member-read fast path answers the engine's own method before the class's, and
// that is the documented regexp-symbols limit in docs/status.md. Custom matcher
// OBJECTS, which is the other half, now work.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
t("exec-global-lastIndex", () => { const r = /a/g; const out = []; let m; while ((m = r.exec("aa"))) out.push([m.index, r.lastIndex]); return out; });
t("test-global-advances", () => { const r = /a/g; return [r.test("aa"), r.lastIndex, r.test("aa"), r.lastIndex, r.test("aa"), r.lastIndex]; });
t("exec-nonglobal-no-advance", () => { const r = /a/; return [r.exec("aa").index, r.lastIndex]; });
t("sticky", () => { const r = /a/y; return [r.test("ba"), r.lastIndex, (r.lastIndex = 1, r.test("ba")), r.lastIndex]; });
t("lastIndex-past-end", () => { const r = /a/g; r.lastIndex = 99; return [r.exec("aa"), r.lastIndex]; });
t("named-groups", () => { const m = /(?<y>\d{4})-(?<mo>\d{2})/.exec("2026-08"); return [m.groups.y, m.groups.mo, m[1], m.length]; });
t("groups-undefined", () => { const m = /(a)|(b)/.exec("a"); return [m[1], m[2] === undefined, m.length]; });
t("matchAll-indices", () => [..."a1b2".matchAll(/(\w)(\d)/g)].map((m) => [m[0], m.index, m[1], m[2]]));
t("match-global", () => "a1b2".match(/\d/g));
t("match-nonglobal-null", () => "abc".match(/z/));
t("replace-named", () => "2026-08".replace(/(?<y>\d{4})-(?<mo>\d{2})/, "$<mo>/$<y>"));
t("replace-fn-groups", () => { let got; "2026-08".replace(/(?<y>\d{4})-(?<mo>\d{2})/, function (...a) { got = a.length; return ""; }); return got; });
t("split-limit-regex", () => ["a1b2c".split(/\d/, 2), "abc".split(/b/), "".split(/x/), "abc".split(/(?:)/, 2)]);
t("search-lastIndex-untouched", () => { const r = /b/g; r.lastIndex = 5; const i = "abc".search(r); return [i, r.lastIndex]; });
t("source-empty", () => [new RegExp("").source, /(?:)/.source, String(new RegExp(""))]);
t("flags-order", () => [new RegExp("a", "yimsg").flags, /a/gimsy.flags]);
t("dotAll", () => [/a.b/s.test("a\nb"), /a.b/.test("a\nb")]);
t("multiline", () => ["a\nb".match(/^b$/m) !== null, "a\nb".match(/^b$/) !== null]);
t("unicode-escape", () => [/\u{1F600}/u.test("😀"), /./u.exec("😀")[0].length]);
t("case-insensitive-unicode", () => [/K/iu.test("k"), /\w/i.test("A")]);
t("backreference", () => [/(a)\1/.test("aa"), /(a)\1/.test("ab")]);
t("lookbehind", () => [/(?<=a)b/.exec("ab")[0], /(?<!a)b/.test("ab")]);
t("lookahead", () => [/a(?=b)/.test("ab"), /a(?!b)/.test("ab")]);
t("quantifier-lazy", () => [/a+?/.exec("aaa")[0], /a{2,}/.exec("aaa")[0]]);
t("hasIndices", () => { const m = /(b)/d.exec("abc"); return [m.indices[0], m.indices[1]]; });
t("regexp-escape", () => (RegExp.escape ? RegExp.escape("a.b") : "absent"));
t("symbol-replace-custom", () => { const o = { [Symbol.replace](s, r) { return "custom"; } }; return "abc".replace(o, "x"); });
t("symbol-split-custom", () => { const o = { [Symbol.split](s) { return ["custom"]; } }; return "abc".split(o); });
t("symbol-match-custom", () => { const o = { [Symbol.match](s) { return "matched"; } }; return "abc".match(o); });
t("toString", () => [String(/a/g), /a/g.toString(), RegExp.prototype.toString.call({ source: "x", flags: "y" })]);
