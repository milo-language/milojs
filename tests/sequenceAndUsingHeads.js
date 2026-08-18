// Three head/expression positions that take a full Expression, comma operator
// included, plus `using` in a C-style for init.
//
// A computed key is an Expression: `a[0, 1, 2]` evaluates the sequence and indexes
// by the LAST value. for-IN's object is an Expression too, while for-OF's is an
// AssignmentExpression and stops at the comma. milojs used the narrower parser for
// all of them.
var a = [10, 20, 30];
console.log("index-seq:", a[0, 1, 2]);
console.log("call-index-seq:", [function () { return "f0"; }, function () { return "f1"; }][0, 1]());

var seen = [];
for (var k in null, { key: 0 }) seen.push(k);
console.log("for-in-seq:", seen.join(","));

// The contextual-keyword pileup: `using` is the loop variable, the first `of` is
// the keyword, and the second `of` is an array indexed by a sequence.
var using, of = [[9], [8], [7]], result = [];
for (using of of [0, 1, 2]) result.push(using);
console.log("using-of-of:", result.length, JSON.stringify(result[0]));

// `using` in a C-style init is held for the WHOLE loop, released when it ends,
// while a `using` in the body is released each pass.
var log = [];
function r(t) { return { [Symbol.dispose]() { log.push(t); } }; }
{
  using x = r("outer_x");
  using y = r("outer_y");
  var i = 0;
  for (using x = r("inner_x"); i < 1; i++) {
    using y = r("inner_y");
    log.push("body");
  }
  log.push("after-loop");
}
console.log("nested-using:", log.join(","));
