// Two defects found while tracing why deep-equal could not load.
//
// 1. Function.prototype.apply took an ARRAY only. The spec takes an array-LIKE:
//    it reads `length` and then the index properties, and reading `length` can
//    run a getter that throws. Accepting arrays alone silently called the
//    function with NO arguments — `fn.apply(null, arguments)` is the common
//    form, and is-callable's feature probe is built on a length getter that
//    throws a private marker.
// 2. `globalThis.x += y` read undefined for its own left-hand side. A plain
//    read went through getMemberDyn, which resolves a global binding; the
//    compound-assignment read went through getMember, which did not.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.message); } };

t("apply with array", () => (function (a, b) { return a + b; }).apply(null, [1, 2]));
t("apply with array-like", () => (function (a, b) { return a + b; }).apply(null, { 0: 1, 1: 2, length: 2 }));
t("apply with arguments", () => (function () {
  return (function (a, b) { return a + b; }).apply(null, arguments);
})(3, 4));
// NOT covered: apply with a primitive argsArray must throw
// "CreateListFromArrayLike called on non-object"; milojs treats it as absent.
t("apply with no args object", () => (function () { return arguments.length; }).apply(null));
t("apply length getter runs", () => {
  var seen = false;
  var like = Object.defineProperty({ 0: 7 }, "length", { get: function () { seen = true; return 1; } });
  var got = (function (a) { return a; }).apply(null, like);
  return got + "/" + seen;
});
// the throw from a length getter must ABORT the call, not let it proceed with a
// partial argument list and leave the throw pending for an unrelated later point
t("apply aborts on a throwing getter", () => {
  var ran = false;
  var like = Object.defineProperty({ 0: 1 }, "length", { get: function () { throw new Error("boom"); } });
  try { (function () { ran = true; return 1; }).apply(null, like); } catch (e) { return "threw/" + ran; }
  return "no throw/" + ran;
});
t("apply length getter throws", () => {
  var marker = {};
  var like = Object.defineProperty({}, "length", { get: function () { throw marker; } });
  try { (function () { return 1; }).apply(null, like); return "no throw"; }
  catch (e) { return e === marker ? "marker" : "other"; }
});
t("Reflect.apply array-like", () => Reflect.apply(function (a) { return a * 2; }, null, { 0: 21, length: 1 }));
t("call is unaffected", () => (function (a, b) { return a + b; }).call(null, 5, 6));

globalThis.__t1 = "one";
t("plain read", () => globalThis.__t1);
globalThis.__t1 += "-two";
t("after +=", () => globalThis.__t1);
t("bare name sees it", () => __t1);
globalThis.__t2 = 1;
globalThis.__t2 = globalThis.__t2 + 1;
t("explicit increment", () => globalThis.__t2);
globalThis.__t3 = 10;
globalThis.__t3 -= 3;
t("compound minus", () => globalThis.__t3);
t("write inside a function", () => { (function () { globalThis.__t4 = "set"; })(); return globalThis.__t4; });
