// A deeply nested expression must fail as a normal error, not a crash and not a
// hang. The depth is far past any real program and past node's own parser limit.
var depth = 6000;
var src = "var x = " + "[".repeat(depth) + "1" + "]".repeat(depth) + ";";
try {
  eval(src);
  console.log("parsed without error");
} catch (e) {
  console.log("threw:", e instanceof RangeError || e instanceof SyntaxError);
}
console.log("still running");
