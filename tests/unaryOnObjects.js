// Unary operators reach ToPrimitive. Found by tools/vm-differential.sh, which
// runs the compiled path against the tree-walking evaluator: the compiled Op.Neg
// coerced correctly and the evaluator's own `-` arm did not, so the two disagreed
// on every object operand. `~` was wrong in BOTH, and `+` on a BigInt answered a
// number where the whole point of the rule is that it must not.
function u(f, x) { try { return String(f(x)); } catch (e) { return "ERR:" + e.constructor.name; } }
const neg = (x) => -x;
const not = (x) => ~x;
const plus = (x) => +x;
const CASES = [
  ["[]", []], ["[1]", [1]], ["[2]", [2]], ["{}", {}],
  ["valueOf2", { valueOf() { return 2; } }],
  ["toString3", { toString() { return "3"; } }],
  ["toPrimitive4", { [Symbol.toPrimitive]() { return 4; } }],
  ["throwingValueOf", { valueOf() { throw new TypeError("x"); } }],
  ["Number5", new Number(5)],
  ["String0", Object("0")],
  ["date0", new Date(0)],
  ["i32", new Int32Array([1, 2])],
];
for (const [name, v] of CASES) {
  console.log(name, u(neg, v), u(not, v), u(plus, v));
}
console.log("bigint", u(neg, 10n), u(not, 10n), u(plus, 10n));
console.log("symbol", u(neg, Symbol("s")), u(not, Symbol("s")), u(plus, Symbol("s")));
