// Each loop hides the closure one level deeper in a different AST shape. They all
// print 0,1 if the per-iteration `let` binding survived, and 1,1 if the loop body
// was wrongly judged incapable of capturing it. This is the decision boundary of
// stmtMayCapture/exprMayCapture in eval.milo: every shape below must reach the
// slow path. A loop whose body genuinely cannot capture takes the fast path and
// is covered by the numeric loops everywhere else in the suite.
function show(a) { return a.map(function (f) { return f(); }).join(","); }

var nestedBlock = [];
for (let i = 0; i < 2; i++) { { nestedBlock.push(function () { return i; }); } }
console.log("block   ", show(nestedBlock));

var insideIf = [];
for (let i = 0; i < 2; i++) { if (i >= 0) insideIf.push(function () { return i; }); }
console.log("if      ", show(insideIf));

var insideWhile = [];
for (let i = 0; i < 2; i++) { var once = true; while (once) { once = false; insideWhile.push(function () { return i; }); } }
console.log("while   ", show(insideWhile));

var insideNestedFor = [];
for (let i = 0; i < 2; i++) { for (let j = 0; j < 1; j++) insideNestedFor.push(function () { return i; }); }
console.log("nestfor ", show(insideNestedFor));

var objValue = [];
for (let i = 0; i < 2; i++) { var o = { f: function () { return i; } }; objValue.push(o.f); }
console.log("objlit  ", show(objValue));

var arrElem = [];
for (let i = 0; i < 2; i++) { var arr = [function () { return i; }]; arrElem.push(arr[0]); }
console.log("arrlit  ", show(arrElem));

var ternary = [];
for (let i = 0; i < 2; i++) { ternary.push(i >= 0 ? function () { return i; } : null); }
console.log("ternary ", show(ternary));

var newArg = [];
for (let i = 0; i < 2; i++) { function Box(f) { this.f = f; } newArg.push(new Box(function () { return i; }).f); }
console.log("newarg  ", show(newArg));

var insideTry = [];
for (let i = 0; i < 2; i++) { try { insideTry.push(function () { return i; }); } catch (e) {} }
console.log("try     ", show(insideTry));

var insideSwitch = [];
for (let i = 0; i < 2; i++) { switch (1) { case 1: insideSwitch.push(function () { return i; }); } }
console.log("switch  ", show(insideSwitch));

var viaEval = [];
for (let i = 0; i < 2; i++) { viaEval.push(eval("(function () { return i; })")); }
console.log("eval    ", show(viaEval));

var comma = [];
for (let i = 0; i < 2; i++) { comma.push((0, function () { return i; })); }
console.log("comma   ", show(comma));
