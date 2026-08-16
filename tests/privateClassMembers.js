// Private class members were ordinary `#x` properties in ONE shared keyspace.
// Four things followed, and every one of them is a correctness problem rather
// than a conformance detail:
//
//   - two classes that both declare `#x` shared the key, so `#x in b` answered
//     true for an instance of the other class, and in a bundle where `#x` is
//     ubiquitous one class could read another's state;
//   - `#x` showed up in getOwnPropertyNames;
//   - the brand check missed private METHODS, which live on the prototype;
//   - reading a private member from an object that never had it returned
//     undefined, which reads as "absent field" rather than "wrong object".
//
// Private names are now keyed per class, using the unique key the class already
// carries for `super`.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
t("private method brand", () => { class C { #m() { return 1; } static has(o) { return #m in o; } } return C.has(new C()); });
t("private gen brand", () => { class C { *#g() {} static has(o) { return #g in o; } } return C.has(new C()); });
t("private getter brand", () => { class C { get #p() { return 1; } static has(o) { return #p in o; } } return C.has(new C()); });
t("private static brand", () => { class C { static #s() {} static has(o) { return #s in o; } } return C.has(C); });
t("private method callable", () => { class C { #m() { return 7; } call() { return this.#m(); } } return new C().call(); });
t("private method not on other class", () => {
  class A { #m() {} static has(o) { return #m in o; } }
  class B { #m() {} }
  return A.has(new B());
});
t("private field not on other class", () => {
  class A { #x = 1; static has(o) { return #x in o; } }
  class B { #x = 2; }
  return A.has(new B());
});
// NOT covered: writing a private member to a foreign object should throw. It
// does not yet — instance fields are installed as `this.#x = init`, before the
// key exists, so a write guard rejects every field initialiser. See
// docs/backlog.md.
t("private get on wrong object throws", () => {
  class C { #x = 1; static get(o) { return o.#x; } }
  return C.get({});
});
t("private not enumerable", () => { class C { #x = 1; } return JSON.stringify(Object.getOwnPropertyNames(new C())); });
