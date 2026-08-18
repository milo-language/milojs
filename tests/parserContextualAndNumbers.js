// Three parser/lexer gaps that QuickJS's test_language.js exercises.

// 1. get/set/async/static are CONTEXTUAL keywords: as a class member name they
// are just names, whether bare, initialized, or used as a method.
class P {
  get; set; async;
  get = () => "g"; set = () => "s"; async = () => "a";
  static() { return "static-method"; }
}
const p = new P();
console.log(p.get(), p.set(), p.async(), p.static());

// ...while the real modifiers must still work.
class Q {
  static sf = "sf";
  static sm() { return "sm"; }
  static get sg() { return "sg"; }
  get x() { return this._x; }
  set x(v) { this._x = v * 2; }
  static { Q.blockRan = true; }
}
const q = new Q(); q.x = 21;
console.log(Q.sf, Q.sm(), Q.sg, Q.blockRan, q.x);

// 2. A template substitution takes a full Expression, comma operator included.
const a = "aaa", b = "bbb";
console.log(`aaa${a, b}ccc`, `${(1, 2, 3)}`, `x${1 + 2}y`);

// 3. A legacy octal literal is base 8 and has no fractional part, so `01.a` is
// a property read off the number, not `01.` followed by a name. A leading zero
// containing an 8 or 9 is decimal, not octal.
console.log(010, 01, 0777, 08, 09);
console.log(0.1.a, 0x1.a, 0b1.a, 01.a, 0o1.a);
console.log((0777).toString(8), 0.5, 1e3);
