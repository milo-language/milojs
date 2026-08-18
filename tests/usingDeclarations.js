// `using` declarations (ES2026 explicit resource management). The value's
// [Symbol.dispose] is snapshotted at DECLARATION, so a later delete cannot change
// what runs, and resources are released in reverse order when the scope exits by
// any route. null and undefined are permitted and register nothing; anything else
// must be an object with a callable disposer, or the declaration throws BEFORE the
// body runs.
var log = [];
(function () {
  using a = { [Symbol.dispose]() { log.push("a"); } };
  using b = { [Symbol.dispose]() { log.push("b"); } };
  log.push("body");
})();
console.log("lifo:", log.join(","));

// Only the constructor name is compared: the MESSAGE text of an engine-raised
// TypeError is not specified, and pinning node's wording here would be a false
// requirement. A user-thrown message (getter-throws below) is compared.
function guard(fn) { var ran = false, err; try { fn(function () { ran = true; }); } catch (e) { err = e; } return [ran, err && err.constructor.name]; }
console.log("no-dispose:", JSON.stringify(guard(function (mark) { (function () { using x = {}; mark(); })(); })));
console.log("non-object:", JSON.stringify(guard(function (mark) { (function () { using x = 42; mark(); })(); })));
console.log("non-callable:", JSON.stringify(guard(function (mark) { (function () { using x = { [Symbol.dispose]: 1 }; mark(); })(); })));
console.log("getter-throws:", JSON.stringify(guardMsg(function (mark) {
  (function () { var o = {}; Object.defineProperty(o, Symbol.dispose, { get() { throw new Error("getter"); } }); using y = o; mark(); })();
})));

function guardMsg(fn) { var ran = false, err; try { fn(function () { ran = true; }); } catch (e) { err = e; } return [ran, err && err.constructor.name, err && err.message]; }

var d = 0;
(function () { using a = null; using b = undefined; using c = { [Symbol.dispose]() { d++; } }; })();
console.log("nullish-ok:", d);

var reads = 0, disposed = 0, target = {};
Object.defineProperty(target, Symbol.dispose, { get() { reads++; return function () { disposed++; }; } });
(function () { using x = target; })();
console.log("snapshot-once:", reads, disposed);

// Disposal runs on an abrupt exit too.
var t = [];
(function () { try { using a = { [Symbol.dispose]() { t.push("d"); } }; throw new Error("boom"); } catch (e) { t.push("c"); } })();
console.log("throw-still-disposes:", t.join(","));

// A disposer failing while an error is pending wraps it.
var caught;
try {
  (function () {
    using a = { [Symbol.dispose]() { throw new Error("a"); } };
    using b = { [Symbol.dispose]() { throw new Error("b"); } };
  })();
} catch (e) { caught = e; }
console.log("suppressed:", caught instanceof SuppressedError, caught.error.message, caught.suppressed.message);

// for-of using disposes at the end of each pass.
var fl = [];
(function () { for (using x of [{ tag: "a", [Symbol.dispose]() { fl.push(this.tag); } }, { tag: "b", [Symbol.dispose]() { fl.push(this.tag); } }]) fl.push("iter"); })();
console.log("for-of:", fl.join(","));

// `using` is contextual: still usable as an ordinary name.
var using = 5;
console.log("contextual:", using + 1);
