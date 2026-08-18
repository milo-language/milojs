// Two places a binding PATTERN is legal that milojs could not parse: a catch
// parameter, and the init clause of a C-style for.
//
// The catch case could not be represented at all: Stmt.Try stores the parameter
// as a NAME. It is desugared instead, binding the caught value to a temp and
// unpacking it in a declaration prepended to the catch block.
//
// The for-init case was a parser assumption: a pattern at the head of a `for` was
// taken to mean for-in/of, so `for (const {x:[y]} = o; ...)` parsed the pattern
// and then choked on the `=`.
try { throw [1, 2]; } catch ([a, b]) { console.log("ary-catch:", a, b); }
try { throw { x: 1, y: 2 }; } catch ({ x, y }) { console.log("obj-catch:", x, y); }
try { throw [1]; } catch ([a, b = 9]) { console.log("catch-default:", a, b); }
try { throw [1, 2, 3]; } catch ([, , c]) { console.log("catch-elision:", c); }
try { throw { a: { b: 5 } }; } catch ({ a: { b } }) { console.log("catch-nested:", b); }
try { throw [1, 2, 3]; } catch ([h, ...t]) { console.log("catch-rest:", h, t.join(",")); }
try { throw {}; } catch ({ q = 7 }) { console.log("catch-obj-default:", q); }
console.log("catch-no-param:", (function () { try { throw 1; } catch { return "ok"; } })());
// `var` in a destructuring catch body still hoists past the block the desugar adds
console.log("catch-var-hoist:", (function () { try { throw [9]; } catch ([z]) { var w = z; } return w; })());

for (const { x: [y] } = { x: [45] }; false;) {}
console.log("for-init-obj: ok");
for (let [a, b] = [1, 2]; a < 2; a++) console.log("for-init-ary:", a, b);
for (var [c] = [7], i = 0; i < 1; i++) console.log("for-init-mixed:", c);
for (const { x: [z], } = { x: [9] }; false;) {}
console.log("for-init-trailing-comma: ok");

// The for-in/of pattern heads must keep working.
for (let [a, b] of [[1, 2]]) console.log("for-of-ary:", a, b);
for (const { p } of [{ p: 3 }]) console.log("for-of-obj:", p);
for (var [c, , d] of [[1, 2, 3]]) console.log("for-of-elision:", c, d);
