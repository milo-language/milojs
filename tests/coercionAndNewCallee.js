// Two defects found by running npm packages' own test suites under milojs.
//
// 1. Built-in ARGUMENTS were not coerced through the interpreter, so a user
//    toString/valueOf never ran and never got the chance to throw. is-regex
//    identifies a regex by handing exec an object whose toString throws a
//    private marker; without the call it returned undefined, and tape, which
//    depends on it, could not load at all.
// 2. `new` accepted only `.name` in its callee, so `new g[name]()` parsed as
//    `new g` and reported "value is not a constructor" against the container.
const mk = (tag) => ({ toString() { throw new Error("TS:" + tag); },
                       valueOf()  { throw new Error("VO:" + tag); } });
const probe = (label, f) => {
  try { console.log(label, "returned", String(f())); }
  catch (e) { console.log(label, "threw", e.message); }
};
probe("exec", () => /a/.exec(mk("exec")));
probe("test", () => /a/.test(mk("test")));
probe("@@match", () => /a/[Symbol.match](mk("m")));
probe("indexOf", () => "abc".indexOf(mk("io")));
probe("includes", () => "abc".includes(mk("inc")));
probe("startsWith", () => "abc".startsWith(mk("sw")));
probe("split", () => "abc".split(mk("sp")));
probe("replace", () => "abc".replace("a", mk("rp")));
probe("padStart", () => "abc".padStart(10, mk("ps")));
probe("repeat", () => "abc".repeat(mk("rc")));
probe("at", () => "abc".at(mk("at")));
probe("charAt", () => "abc".charAt(mk("ca")));
probe("slice", () => "abc".slice(mk("sl")));

// coercion that succeeds must be used, not merely attempted
console.log("indexOf obj:", "hello".indexOf({ toString() { return "ll"; } }));
console.log("slice obj:", "hello".slice({ valueOf() { return 1; } }));
console.log("padStart obj:", "x".padStart(3, { toString() { return "-"; } }));

// a RegExp argument still belongs to the regex path, not to ToString
console.log("regex arg:", "a1b2".replace(/\d/g, "#"), "a,b".split(/,/).join("|"));

// new with a computed callee, the shape which-typed-array uses
const table = { Uint8Array: Uint8Array, Map: Map, Date: Date };
console.log("computed new:", String(new table["Uint8Array"](2)), new table["Map"]().size,
  typeof new table["Date"]().getTime());
console.log("global computed:", String(new globalThis["Uint8Array"](1)));
console.log("array elem:", new [Map][0]().size);
console.log("chained:", new globalThis["Object"]().constructor === Object);
