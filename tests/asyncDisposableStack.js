// AsyncDisposableStack: the async sibling of DisposableStack. disposeAsync
// returns a promise and awaits each disposer IN TURN, so release order is the
// reverse of acquisition and a slow disposer does not overlap the next. Resources
// are collected through [Symbol.asyncDispose], falling back to [Symbol.dispose].
var log = [];
var s = new AsyncDisposableStack();
s.use({ [Symbol.asyncDispose]() { log.push("a"); return Promise.resolve(); } });
s.use({ [Symbol.dispose]() { log.push("b"); } });
s.adopt("res", function (v) { log.push("adopt:" + v); });
s.defer(function () { log.push("c"); });

function guard(f) { try { f(); return "no-throw"; } catch (e) { return e.constructor.name; } }

s.disposeAsync().then(function () {
  console.log("order:", log.join(","));
  console.log("disposed:", s.disposed);
  console.log("use-after-dispose:", guard(function () { s.use({ [Symbol.dispose]() {} }); }));
  console.log("second-dispose-ok:", typeof s.disposeAsync().then);

  console.log("use-nondisposable:", guard(function () { new AsyncDisposableStack().use({}); }));
  console.log("adopt-nonfn:", guard(function () { new AsyncDisposableStack().adopt(1, 2); }));
  console.log("nullish-passes-through:", new AsyncDisposableStack().use(null));
  console.log("needs-new:", guard(function () { AsyncDisposableStack(); }));

  var t = new AsyncDisposableStack();
  t.use({ [Symbol.asyncDispose]() { log.push("m"); } });
  var moved = t.move();
  console.log("move:", Object.getPrototypeOf(moved) === AsyncDisposableStack.prototype, t.disposed, moved.disposed);
  return moved.disposeAsync();
}).then(function () {
  console.log("after-move:", log.join(","));
  // A throwing disposer must not stop the rest, and the error still surfaces.
  var e = new AsyncDisposableStack();
  var seen = [];
  e.defer(function () { seen.push("first"); });
  e.defer(function () { throw new Error("boom"); });
  e.defer(function () { seen.push("last"); });
  return e.disposeAsync().then(
    function () { console.log("throwing:", "resolved", seen.join(",")); },
    function (err) { console.log("throwing:", err.message, seen.join(",")); });
});
