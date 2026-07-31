// `*name() {}` in an object literal. The star comes before the key, and a parser
// that looked for it after the key consumed it as an unrecognised key token,
// leaving the method nameless — the property was defined under "".
const o = {
  a: 1,
  *g() { yield 1; yield 2; },
  *withArgs(n) { yield n * 2; },
  m() { return "m"; },
  async h() { return "h"; },
  async *ag() { yield "ag"; },
};
console.log(o.a, o.m(), typeof o.h, typeof o.ag);
console.log([...o.g()].join(","), [...o.withArgs(3)].join(","));
console.log(Object.keys(o).join(","));
const it = o.g();
console.log(JSON.stringify(it.next()), JSON.stringify(it.next()), JSON.stringify(it.next()));
console.log([1 * 2, { a: 2 * 3 }.a].join(","));
