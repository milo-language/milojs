// eval used to resolve a bare identifier and hard-error on anything else, under
// a comment claiming there is no runtime compiler. That was never true:
// src/repl.milo has always lexed and parsed new source into the shared Prog at
// runtime and executed it. eval is that same operation with the caller's scope.
function p(n, f) {
  try {
    const v = f();
    console.log(n, typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  } catch (e) { console.log(n, "THREW " + e.name); }
}

p("expression", () => eval("1 + 1"));
p("string expr", () => eval("'ab' + 'cd'"));
p("last expr wins", () => eval("1; 2; 3"));
p("empty source", () => eval(""));
p("var declaration", () => eval("var q1 = 5;"));
p("var is visible after", () => { eval("var q2 = 6;"); return q2; });
p("function declaration", () => { eval("function fx(){ return 8; }"); return fx(); });
p("reads a local", () => { let loc = 9; return eval("loc + 1"); });
p("writes a local", () => { let m = 1; eval("m = 42"); return m; });
p("nested eval", () => eval("eval('2 * 3')"));
p("arrow", () => eval("(() => 12)()"));
p("template literal", () => eval("`a${1 + 1}b`"));
p("regex", () => eval("/ab/.test('xaby')"));
p("object literal", () => eval("({x: 14}).x"));
p("throw propagates", () => eval("throw new TypeError('x')"));
p("non-string passes through", () => eval(123));
p("object arg passes through", () => JSON.stringify(eval({ a: 1 })));

// let/const/class are scoped to the eval and must NOT leak, while var does
p("class does not leak", () => { eval("class Ce { m(){ return 13; } }"); return typeof Ce; });
p("let does not leak", () => { eval("let lv = 1;"); return typeof lv; });
p("var does leak", () => { eval("var vv = 2;"); return typeof vv; });

// indirect eval runs in the GLOBAL scope, which is the whole difference
p("indirect defines a global", () => { const e = eval; e("var gg = 11;"); return typeof gg; });
p("indirect cannot see a local", () => { let hidden = 1; const e = eval; try { return e("typeof hidden"); } catch (x) { return "THREW"; } });

// appending to the shared program mid-evaluation: 400 eval'd closures escape
// into an array, each append able to reallocate the arenas an outer walk is
// reading, then all are called afterwards
const fns = [];
for (let i = 0; i < 400; i++) eval("fns.push(function g" + i + "(){ return " + i + "; });");
let sum = 0;
for (const f of fns) sum += f();
console.log("400 escaped closures sum:", sum);

// eval reached from deep inside an expression that is itself mid-evaluation
function deep(d) { if (d === 0) return eval("1 + 1"); return deep(d - 1) + 0; }
console.log("eval at recursion depth 50:", deep(50));
