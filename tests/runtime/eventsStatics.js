// The `events` module's STATIC surface: once(), on(), errorMonitor,
// captureRejectionSymbol, getEventListeners, and the max-listener accessors.
// None of these existed, and modern node code reaches for `await once(...)`
// far more often than it constructs an emitter by hand.
const {
  EventEmitter, once, on, errorMonitor, captureRejectionSymbol,
  getEventListeners, listenerCount, setMaxListeners, addAbortListener,
} = require("events");

(async () => {
  const e = new EventEmitter();
  setTimeout(() => e.emit("go", 1, 2), 1);
  console.log("once:", await once(e, "go"));

  // Waiting for anything OTHER than 'error' rejects when 'error' fires.
  const e2 = new EventEmitter();
  setTimeout(() => e2.emit("error", new Error("boom")), 1);
  try {
    await once(e2, "go");
    console.log("once: no rejection");
  } catch (err) {
    console.log("once rejects:", err.message);
  }

  // ...but waiting FOR 'error' resolves with it instead.
  const e3 = new EventEmitter();
  setTimeout(() => e3.emit("error", new Error("wanted")), 1);
  console.log("once on error:", (await once(e3, "error"))[0].message);

  // An errorMonitor listener observes without counting as handling.
  const e4 = new EventEmitter();
  e4.on(errorMonitor, (err) => console.log("monitor:", err.message));
  e4.on("error", (err) => console.log("handler:", err.message));
  console.log("emit error returned:", e4.emit("error", new Error("watched")));

  // A rejecting async listener routes to the emitter's rejection handler.
  const e5 = new EventEmitter({ captureRejections: true });
  e5[captureRejectionSymbol] = (err, name) =>
    console.log("captured:", err.message, "event:", name);
  e5.on("x", async () => { throw new Error("async boom"); });
  e5.emit("x");

  console.log("getEventListeners:", getEventListeners(e4, "error").length);
  console.log("listenerCount:", listenerCount(e4, "error"));
  console.log("eventNames:", e4.eventNames().length);
  console.log("defaultMax:", e4.getMaxListeners());
  setMaxListeners(3, e4);
  console.log("afterSetMax:", e4.getMaxListeners());

  // on() is an async iterator over every emission until the consumer breaks.
  const e6 = new EventEmitter();
  const it = on(e6, "tick");
  setTimeout(() => { e6.emit("tick", "a"); e6.emit("tick", "b"); }, 1);
  const seen = [];
  for await (const v of it) {
    seen.push(v[0]);
    if (seen.length === 2) break;
  }
  console.log("on:", seen.join(","));

  // once() honours an AbortSignal, before and during the wait.
  const ac = new AbortController();
  const e7 = new EventEmitter();
  const p = once(e7, "never", { signal: ac.signal });
  ac.abort();
  try { await p; } catch (err) { console.log("abort:", err.name, err.code); }

  const ac2 = new AbortController();
  addAbortListener(ac2.signal, () => console.log("addAbortListener fired"));
  ac2.abort();
})();
