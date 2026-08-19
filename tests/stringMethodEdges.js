// String methods against awkward arguments, plus the JS WhiteSpace set. Seven of
// 31 string cases were wrong and ten of 13 whitespace ones.
//
// The whitespace finding is the big one: milojs recognised four ASCII characters
// as whitespace where JS defines TAB, VT, FF, SP, NBSP, the whole Zs category,
// U+2028, U+2029 and the BOM. Two predicates answered the question -- one had \v
// and \f, the other did not -- and neither knew anything past ASCII, so trim,
// parseInt and Number all disagreed with node on every non-ASCII space.
//
// `normalize` is deliberately absent: NFC/NFD need Unicode composition tables
// that this engine does not have yet, and it is a backlog item, not an oversight.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
const S = "abcabc";
t("at", () => [S.at(0), S.at(-1), S.at(99)]);
t("charAt-oob", () => [S.charAt(-1), S.charAt(99), S.charAt(1.7)]);
t("charCodeAt-oob", () => [S.charCodeAt(99), S.charCodeAt(-1)]);
t("codePointAt-oob", () => [S.codePointAt(99), "a".codePointAt(0)]);
t("indexOf-args", () => [S.indexOf("b"), S.indexOf("b", 2), S.indexOf(""), S.indexOf("", 99), S.indexOf("b", -5)]);
t("lastIndexOf", () => [S.lastIndexOf("b"), S.lastIndexOf("b", 2), S.lastIndexOf("", 99)]);
t("includes-regex", () => { try { return S.includes(/a/); } catch (e) { return "THREW:" + e.constructor.name; } });
t("startsWith-regex", () => { try { return S.startsWith(/a/); } catch (e) { return "THREW:" + e.constructor.name; } });
t("slice-neg", () => [S.slice(-2), S.slice(2, -1), S.slice(99), S.slice(-99)]);
t("substring-swap", () => [S.substring(4, 1), S.substring(-3, 2), S.substring(1, 99)]);
t("substr-neg", () => [S.substr(-2), S.substr(1, -1), S.substr(-99, 2)]);
t("split-limit", () => [S.split("b", 1), S.split("", 3), S.split(undefined), S.split("", 0)]);
t("split-regex-captures", () => "a1b2c".split(/(\d)/));
t("split-empty-regex", () => "abc".split(/(?:)/));
t("replace-fn-args", () => { let got; "abc".replace(/b/, function () { got = Array.prototype.slice.call(arguments); return "X"; }); return got; });
t("replace-dollar", () => ["abc".replace("b", "[$&]"), "abc".replace(/b/, "[$`|$']"), "abc".replace("b", "$$")]);
t("replaceAll-nonglobal", () => { try { return "aa".replaceAll(/a/, "b"); } catch (e) { return "THREW:" + e.constructor.name; } });
t("padStart", () => ["a".padStart(5, "xy"), "a".padStart(0), "abc".padStart(2, "z"), "a".padStart(3, "")]);
t("padEnd", () => ["a".padEnd(5, "xy"), "a".padEnd(3, "")]);
t("repeat-edge", () => { try { return ["a".repeat(0), "ab".repeat(2)]; } catch (e) { return "THREW:" + e.constructor.name; } });
t("trim-variants", () => ["  x \t\n".trim(), " x ".trimStart(), " x ".trimEnd()]);
t("localeCompare", () => ["a".localeCompare("b"), "b".localeCompare("a"), "a".localeCompare("a")]);
t("case-turkish", () => ["I".toLowerCase(), "i".toUpperCase(), "ß".toUpperCase()]);
t("concat-coerce", () => "a".concat(1, null, undefined, {}));
t("match-nonglobal", () => { const m = "a1".match(/(\d)/); return [m[0], m[1], m.index, m.input]; });
t("matchAll-nonglobal", () => { try { return [..."aa".matchAll(/a/)].length; } catch (e) { return "THREW:" + e.constructor.name; } });
t("search", () => ["abc".search(/b/), "abc".search(/z/), "abc".search()]);
t("raw", () => String.raw({ raw: ["a", "b"] }, 1));
t("fromCodePoint-bad", () => { try { return String.fromCodePoint(1.5); } catch (e) { return "THREW:" + e.constructor.name; } });
t("wellFormed", () => ["ab".isWellFormed(), "ab".toWellFormed()]);
const WS = ["\u0020","\u00a0","\u1680","\u2000","\u2003","\u3000","\ufeff","\u2028","\u2029","\u0009","\u000b","\u000c","\u000d"];
for (const w of WS) { const s = w + "x" + w; console.log(JSON.stringify(w), JSON.stringify(s.trim()), parseInt(w+"5"), Number(w+"5")); }
