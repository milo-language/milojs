// Four defects in Function.prototype.bind, and one in the string regex ops.
//
// bind: the result carried no own `length` or `name`; `.call` on it replaced the
// bound receiver instead of ignoring the call-site one; and `new` on it reported
// "value is not a constructor". function-bind asserts every one of these, and a
// wrapper that preserves arity by reading fn.length off a bound function got
// undefined.
//
// match/search: given a STRING pattern they returned undefined. The spec has no
// non-regex form for match, matchAll or search — it builds a RegExp from
// whatever it is handed — and passing a plain string is the common way to write
// it. replace and split DO have literal-string forms and keep them.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "ERR", e.message); } };

function f(a, b) { return [this && this.tag, a, b].join("|"); }

t("plain bind", () => f.bind({ tag: "T" })(1, 2));
t("partial", () => f.bind({ tag: "T" }, 1)(2));
t("double bind keeps first this", () => f.bind({ tag: "A" }, 1).bind({ tag: "B" }, 2)());
t("null this", () => f.bind(null, 1)(2));
t("bound length", () => f.bind(null, 1).length);
t("bound length floors at 0", () => f.bind(null, 1, 2, 3).length);
t("bound name", () => f.bind(null).name);
t("double bound name", () => f.bind(null).bind(null).name);
// .call on a bind() RESULT cannot change the receiver
t("call cannot rebind", () => { const g = f.bind({ tag: "X" }); return g.call({ tag: "Y" }, 1, 2); });
t("apply cannot rebind", () => { const g = f.bind({ tag: "X" }); return g.apply({ tag: "Y" }, [1, 2]); });
t("call keeps bound args", () => { const g = f.bind({ tag: "X" }, 1); return g.call({ tag: "Y" }, 2); });
t("Function.prototype.bind.call", () => Function.prototype.bind.call(f, { tag: "Z" })(9, 8));
t("bind an arrow", () => ((a) => a * 2).bind(null, 21)());
// new on a bound function constructs the target, bound args first, this ignored
t("new on bound", () => { function C(x, y) { this.v = x + ":" + y; } const B = C.bind(null, 5); return new B(6).v; });
t("new on bound instanceof", () => { function C() {} const B = C.bind(null); return new B() instanceof C; });
t("new on double bound", () => { function C(x, y) { this.v = x + y; } return new (C.bind(null, 1).bind(null, 2))().v; });

t("match string pattern", () => JSON.stringify("a1b".match("\\d")));
t("match regex", () => JSON.stringify("a1b".match(/\d/)));
t("search string pattern", () => "a1b".search("\\d"));
t("search no match", () => "abc".search("\\d"));
t("matchAll string pattern", () => JSON.stringify([..."a1b2".matchAll("\\d")].map(m => m[0])));
t("extracted match", () => JSON.stringify(String.prototype.match.call("a1b", "\\d")));
t("extracted search", () => String.prototype.search.call("a1b", "\\d"));
// replace and split keep their literal-string behaviour
t("replace literal", () => "a.b".replace(".", "#"));
t("split literal", () => JSON.stringify("a.b".split(".")));
t("match special chars are a pattern", () => JSON.stringify("axb".match(".")));
