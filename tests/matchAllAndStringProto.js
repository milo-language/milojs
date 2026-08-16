// matchAll answered an ARRAY where the spec says iterator, so the common
// `[...s.matchAll(re)]` worked and everything else failed. And six string
// methods dispatched by name while being absent from String.prototype, so
// `typeof "".matchAll` was "undefined" and anything starting from the prototype
// failed before calling anything.
function p(n, f) { try { const v = f(); console.log(n, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)); } catch (e) { console.log(n, "THREW " + e.constructor.name); } }

// the iterator protocol, not just spread
p("spread", () => [...("a1b2".matchAll(/\d/g))].map(m => m[0]).join(","));
p("next()", () => { const it = "ab".matchAll(/./g); const a = it.next(); return [a.done, a.value[0]]; });
p("is iterable", () => typeof "ab".matchAll(/./g)[Symbol.iterator]);
p("one shot", () => { const it = "ab".matchAll(/./g); return [[...it].length, [...it].length]; });
p("exhausted next", () => { const it = "a".matchAll(/./g); it.next(); const d = it.next(); return [d.done, d.value]; });
p("for-of", () => { const out = []; for (const m of "a1b2".matchAll(/\d/g)) out.push(m[0]); return out.join(""); });

// match objects keep their shape
p("groups", () => [...("a1".matchAll(/(?<d>\d)/g))].map(m => m.groups.d).join(""));
p("index and input", () => { const m = [...("xa".matchAll(/a/g))][0]; return [m.index, m.input, m.length]; });
p("captures", () => [...("a1b2".matchAll(/([a-z])(\d)/g))].map(m => m[1] + m[2]).join(","));
p("no matches", () => [...("abc".matchAll(/\d/g))].length);
p("utf8 indices", () => [...("aéb1".matchAll(/\d/g))].map(m => m.index).join(","));

// a non-global regex is a TypeError: the result would repeat forever
p("non-global throws", () => { try { [..."ab".matchAll(/./)]; return "no throw"; } catch (e) { return e.constructor.name; } });

// every string method is a real property of String.prototype, so it can be read,
// borrowed and uncurried
const names = ["charAt", "charCodeAt", "codePointAt", "at", "indexOf", "lastIndexOf", "includes",
  "startsWith", "endsWith", "slice", "substring", "substr", "split", "replace", "replaceAll",
  "toUpperCase", "toLowerCase", "trim", "trimStart", "trimEnd", "padStart", "padEnd", "repeat",
  "concat", "localeCompare", "normalize", "match", "matchAll", "search", "toString", "valueOf",
  "isWellFormed", "toWellFormed"];
console.log("missing from String.prototype:", names.filter(n => typeof String.prototype[n] !== "function").join(" ") || "(none)");

const uncurry = Function.prototype.call.bind(String.prototype.codePointAt);
console.log("uncurried codePointAt:", uncurry("é", 0));
console.log("borrowed at:", String.prototype.at.call("abc", -1));
console.log("borrowed replaceAll:", String.prototype.replaceAll.call("aaa", "a", "b"));
console.log("borrowed localeCompare:", String.prototype.localeCompare.call("a", "b"));
console.log("borrowed matchAll:", [...String.prototype.matchAll.call("a1b2", /\d/g)].length);
