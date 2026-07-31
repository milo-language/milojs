// String(x) and Array.prototype.join must run a user-defined toString. Both are
// natives, and a native that cannot re-enter the interpreter answers
// "[object Object]" while `${x}` and `"" + x` disagree with it.
class Point {
  constructor(x, y) { this.x = x; this.y = y; }
  toString() { return `(${this.x},${this.y})`; }
}
const p = new Point(1, 2);
console.log(String(p), "" + p, p.toString());
console.log([p, p].join(" "), [p].join(), String([p]));

const plain = { toString() { return "PLAIN"; } };
console.log(String(plain), [plain].join(), String([plain, plain]));

// string hint: toString wins over valueOf, the reverse of what `+` does
const both = { toString() { return "S"; }, valueOf() { return 9; } };
console.log(String(both), [both].join(), both + 0);

console.log(String([1, [2, 3], null, undefined]), String([]));
console.log(String(new Error("boom")), String(123), String(null), String(undefined));
console.log(String(Symbol("tag")), [Object.create(null) ? {} : 0].join());
