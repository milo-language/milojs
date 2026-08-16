// The lexer accepted only ASCII in identifiers, so every non-ASCII name was a
// ReferenceError. test262's class-element tests are built on exactly this —
// `static #℘`, `#ZW_<U+200C>_NJ`, `#\u{6F}` — and 14 cases in the sample died
// before running a line of their own.
//
// Also here: `#x in o`, the ergonomic brand check. Its left side is a private
// NAME, not an expression, so evaluating it as an identifier threw.
const p = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };

p("unicode binding", () => { const ℘ = 7; return ℘; });
p("unicode fn name", () => { function ñ(a) { return a * 2; } return ñ(21); });
p("greek ident", () => { let λ = "lambda"; return λ; });
p("cjk ident", () => { const 変数 = 5; return 変数; });
p("unicode property", () => ({ π: 3 }).π);
p("escape in binding", () => { const abc = 1; return abc; });
p("braced escape", () => { const \u{62}cd = 2; return bcd; });
p("escape matches plain name", () => { const o = { o: 9 }; return o.\u{6F}; });

p("private unicode field", () => { class C { #℘ = 4; get() { return this.#℘; } } return new C().get(); });
p("private escaped field", () => { class C { #\u{6F} = 5; get() { return this.#o; } } return new C().get(); });
p("private static unicode", () => { class C { static #℘ = 6; static get() { return C.#℘; } } return C.get(); });
p("zero-width joiner in name", () => { class C { #ZW_‍_J = 8; get() { return this.#ZW_‍_J; } } return new C().get(); });

p("brand check true", () => { class C { #x = 1; static has(o) { return #x in o; } } return C.has(new C()); });
p("brand check false", () => { class C { #x = 1; static has(o) { return #x in o; } } return C.has({}); });
p("brand check primitive", () => { class C { #x = 1; static has(o) { return #x in o; } } return C.has(42); });
// NOT covered, and wrong today (see docs/backlog.md): `#x in b` where b is an
// instance of a DIFFERENT class that also declares `#x` answers true, because
// private names share one keyspace rather than being scoped per class; and
// `#m in o` for a private METHOD answers false, because methods live on the
// prototype instead of as an own property of the instance.
