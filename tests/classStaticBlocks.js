// `static { ... }` (ES2022) was not parsed at all, and a parse error here is
// fatal: one static block anywhere killed the whole file, not just the class.
// It is a class-BUILD-time initializer, so ordering against static fields and
// the `this` binding both matter.
function p(n,f){ try { var v=f(); console.log(n, typeof v==="object"&&v!==null?JSON.stringify(v):String(v)); } catch(e){ console.log(n,"THREW "+String(e)); } }
p("basic", () => { class C { static v; static { C.v = 5; } } return C.v; });
p("thisIsClass", () => { class C { static { this.w = 7; } } return C.w; });
p("order", () => { const log=[]; class C { static a = (log.push("a"), 1); static { log.push("b"); } static c = (log.push("c"), 3); static { log.push("d"); } } return log.join(""); });
p("seesStatics", () => { class C { static x = 2; static { this.y = this.x * 3; } } return C.y; });
p("multiple", () => { class C { static n = 0; static { C.n++; } static { C.n++; } } return C.n; });
p("privateAccess", () => { class C { static #s = 4; static get s(){ return C.#s; } static { C.t = C.#s + 1; } } return C.t; });
p("empty", () => { class C { static {} } return "ok"; });
p("nestedClass", () => { class C { static { class D { static v = 9; } C.d = D.v; } } return C.d; });
p("methodStillWorks", () => { class C { static m(){ return 1; } static { C.z = C.m(); } } return C.z; });
p("staticNamedStatic", () => { class C { static static = 3; } return C.static; });
p("inheritance", () => { class A { static { this.base = "A"; } } class B extends A {} return [A.base, B.base]; });
