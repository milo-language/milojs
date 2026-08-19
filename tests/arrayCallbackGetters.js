// Every Array.prototype method does a real [[Get]] per index, so an own ACCESSOR
// on an index has to be observed. After `Object.defineProperty(a, 0, {get(){...}})`
// the element is STILL present in the dense element storage, so the fast path in
// arrGetDyn returned the stale value the slot held before the getter was
// installed, and every callback method saw the wrong element.
//
// A getter reached through the PROTOTYPE already worked, which is what made this
// hard to spot: the chain walk was right, the own-accessor case was not.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "ERR", e.constructor.name); } }
function withGetter() {
  var a = [1, 2];
  Object.defineProperty(a, 0, { get: function () { return 99; }, enumerable: true, configurable: true });
  return a;
}
t("map", () => withGetter().map(function (x) { return x; }));
t("forEach", () => { var o = []; withGetter().forEach(function (x) { o.push(x); }); return o; });
t("filter", () => withGetter().filter(function () { return true; }));
t("some", () => withGetter().some(function (x) { return x === 99; }));
t("every", () => withGetter().every(function (x) { return x !== undefined; }));
t("reduce", () => withGetter().reduce(function (a, b) { return a + b; }, 0));
t("flatMap", () => withGetter().flatMap(function (x) { return [x]; }));
t("proto-getter-unchanged", () => {
  var a = [, 2];
  Object.defineProperty(Array.prototype, 0, { get: function () { return 7; }, configurable: true });
  var r = a.map(function (x) { return x; });
  delete Array.prototype[0];
  return r;
});
t("plain-array-unchanged", () => [1, 2, 3].map(function (x) { return x * 2; }));
t("holes-unchanged", () => { var a = [1, , 3]; var seen = []; a.forEach(function (x) { seen.push(x); }); return seen; });
