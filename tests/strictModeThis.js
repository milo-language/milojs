// `"use strict"` was ignored entirely, so `this` in a receiver-less call was
// globalThis even in strict code. That is not a corner: the spec's own built-in
// setters (SetterThatIgnoresPrototypeProperties, used by Iterator.prototype's
// constructor and @@toStringTag) reject a nullish receiver, and with globalThis
// substituted they silently accepted one. Two QuickJS cases regressed on exactly
// that when receiver-less `this` was first bound to globalThis.
const p = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };

function sloppy() { return this; }
p("sloppy call", () => sloppy() === globalThis);
p("sloppy .call(undefined)", () => sloppy.call(undefined) === globalThis);
p("sloppy .call(null)", () => sloppy.call(null) === globalThis);
p("sloppy .call(obj)", () => { const o = {}; return sloppy.call(o) === o; });

function withDirective() { "use strict"; return this; }
p("fn directive", () => withDirective() === undefined);
p("fn directive .call(undefined)", () => withDirective.call(undefined) === undefined);
p("fn directive .call(7)", () => withDirective.call(7));

// strictness is inherited by everything nested in strict code
function outerStrict() { "use strict"; return (function () { return this; })(); }
p("nested in strict fn", () => outerStrict() === undefined);
function outerStrictArrow() { "use strict"; return (() => (function () { return this; })())(); }
p("through an arrow", () => outerStrictArrow() === undefined);

// a class body is always strict, directive or not
class K { m() { return (function () { return this; })(); } static s() { return (function () { return this; })(); } }
p("class method", () => new K().m() === undefined);
p("class static", () => K.s() === undefined);

// and a sloppy function nested in sloppy code stays sloppy
function outerSloppy() { return (function () { return this; })(); }
p("nested in sloppy fn", () => outerSloppy() === globalThis);

// the spec setters this was breaking
p("Iterator ctor setter on undefined", () => {
  const d = Object.getOwnPropertyDescriptor(Iterator.prototype, "constructor");
  return (function () { try { d.set.call(undefined, 1); return "no throw"; } catch (e) { return e.constructor.name; } })();
});
p("Iterator tag setter on undefined", () => {
  const d = Object.getOwnPropertyDescriptor(Iterator.prototype, Symbol.toStringTag);
  return (function () { try { d.set.call(undefined, "x"); return "no throw"; } catch (e) { return e.constructor.name; } })();
});
p("Iterator tag setter on a plain object", () => {
  const d = Object.getOwnPropertyDescriptor(Iterator.prototype, Symbol.toStringTag);
  const o = {}; d.set.call(o, "x");
  return Object.getOwnPropertyDescriptor(o, Symbol.toStringTag).value;
});
