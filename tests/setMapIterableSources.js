// A STRING is iterable, by code point. iterableToArray returned any non-object
// unchanged, so the Set constructor never saw the characters and `new Set("aab")`
// came out EMPTY. spreadInto already knew how to walk a string, which is why
// `[..."ab"]` and `for (c of "ab")` worked while the constructor did not.
//
// The Map constructor also skipped an entry that was not an object instead of
// throwing, so `new Map(["ab"])` answered an empty map where node raises a
// TypeError. A SHORT pair is not an error: the missing half is undefined.
function j(v) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
function t(l, f) { try { console.log(l, j(f())); } catch (e) { console.log(l, "ERR:" + e.constructor.name); } }

t("set-string", () => [...new Set("aab")]);
t("set-string-dedupes", () => [...new Set("aaa")]);
t("set-empty-string", () => [...new Set("")]);
t("set-array", () => [...new Set([1, 2, 2])]);
t("set-set", () => [...new Set(new Set([1, 2]))]);
t("set-generator", () => { function* g() { yield 1; yield 2; } return [...new Set(g())]; });
t("set-map", () => [...new Set(new Map([["a", 1]]))]);
t("set-typedarray", () => [...new Set(new Int32Array([1, 2, 2]))]);
t("set-null", () => [...new Set(null)]);
t("set-undefined", () => [...new Set(undefined)]);

t("map-pairs", () => [...new Map([["a", 1], ["b", 2]])]);
t("map-non-object-entry", () => [...new Map(["ab"])]);
t("map-number-entry", () => [...new Map([1])]);
t("map-short-pair", () => { var m = new Map([["a"]]); return [m.size, m.get("a")]; });
t("map-generator", () => { function* g() { yield ["a", 1]; } return [...new Map(g())]; });

t("array-from-set-of-string", () => Array.from(new Set("ab")));
t("spread-string-unchanged", () => [..."ab"]);
t("for-of-string-unchanged", () => { var o = []; for (var c of "ab") o.push(c); return o; });
