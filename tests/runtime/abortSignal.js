// AbortController/AbortSignal used to be inert: `aborted` flipped, but no
// listener ever ran and `reason` stayed undefined, so anything waiting on an
// abort waited forever.
const ac = new AbortController();
const s = ac.signal;
console.log("initial:", s.aborted, s.reason);

s.addEventListener("abort", function (ev) {
  console.log("listener:", ev.type, ev.target === s);
});
s.onabort = function () { console.log("onabort"); };
s.addEventListener("abort", function () { console.log("once-listener"); }, { once: true });

ac.abort();
console.log("after:", s.aborted, s.reason.name, s.reason.code);
ac.abort(); // idempotent: no second round of listeners

try { s.throwIfAborted(); } catch (e) { console.log("throwIfAborted:", e.name); }

// A reason the caller supplied is kept verbatim.
const ac2 = new AbortController();
ac2.abort(new Error("mine"));
console.log("custom reason:", ac2.signal.reason.message);

// The static factories.
const pre = AbortSignal.abort();
console.log("AbortSignal.abort:", pre.aborted, pre.reason.name);

// any() forwards the first abort, and short-circuits an already-aborted input.
const a = new AbortController();
const b = new AbortController();
const anySignal = AbortSignal.any([a.signal, b.signal]);
anySignal.addEventListener("abort", function () {
  console.log("any fired:", anySignal.reason.message);
});
b.abort(new Error("from b"));
console.log("any aborted:", anySignal.aborted);

const already = AbortSignal.any([AbortSignal.abort(new Error("already"))]);
console.log("any short-circuit:", already.aborted, already.reason.message);

// A removed listener does not run.
const ac3 = new AbortController();
const gone = function () { console.log("SHOULD NOT PRINT"); };
ac3.signal.addEventListener("abort", gone);
ac3.signal.removeEventListener("abort", gone);
ac3.abort();
console.log("removed listener did not run");

// timeout() aborts on its own, with a TimeoutError rather than an AbortError.
const t = AbortSignal.timeout(5);
t.addEventListener("abort", function () {
  console.log("timeout:", t.aborted, t.reason.name);
});
setTimeout(function () { console.log("end"); }, 30);
