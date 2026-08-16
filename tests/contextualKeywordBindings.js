// `undefined`, `async`, `await`, `yield` and `let` get their own lexer tokens but
// are NOT reserved words — they are legal binding names in ordinary script code.
// The declarator, parameter, function-name and catch-parameter slots all required
// T_IDENT, so `var undefined;` was a parse error. That one line opens
// get-intrinsic, a dependency of a large slice of npm, and a parse error is fatal.
var undefined;
console.log("var undefined:", typeof undefined);
function f() { var undefined; return typeof undefined; }
console.log("in function:", f());
var async;
console.log("var async ok");
var await1 = 1, yield1 = 2;
console.log(await1, yield1);
try { null.x; } catch (undefined) { console.log("catch param ok"); }
function undefined2() { return 1; }
console.log("function name ok", undefined2());

// the operator meanings survive: only BINDING positions were relaxed. Kept
// synchronous — the async forms are covered by tests/promises.js, and their
// output would interleave differently here (see the settled-await tick in the
// backlog).
function* k() { yield 3; yield 4; }
console.log("yield still an operator:", [...k()].join(","));
console.log("async fn is a function:", typeof (async function () { return 5; }));
console.log("async arrow is a function:", typeof (async () => 5));
console.log("typeof async/undefined:", typeof async, typeof undefined);

// EvalError and URIError did not exist at all — `EvalError` was a ReferenceError
for (const n of ["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError"]) {
  const C = globalThis[n];
  const e = new C("m");
  console.log(n, typeof C, C.name, e.name, String(e), e instanceof Error, e instanceof C, Object.prototype.toString.call(e));
}
try { decodeURIComponent("%"); } catch (e) { console.log("decodeURIComponent throws", e.name, e instanceof URIError); }

// `eval` exists as a VALUE (get-intrinsic tabulates it); calling it indirectly
// throws rather than answering something wrong, and the direct form still works
console.log("typeof eval:", typeof eval);
const dirname_ = 42;
console.log("direct eval of a bare ident:", eval("dirname_"));
// Calling `eval` indirectly is NOT asserted here: node evaluates the string and
// milojs throws EvalError (no runtime compiler). Only its existence as a value
// matters to get-intrinsic, and that is what `typeof eval` above pins.
