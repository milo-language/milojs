// EventTarget/Event/CustomEvent. AbortSignal, MessagePort and node's own
// process-level events are all specified in terms of these, and none of the
// three existed — which is most of why the whatwg test area scored 1 of 37.
const t = new EventTarget();
const seen = [];

const a = (e) => seen.push("a:" + e.type);
t.addEventListener("ping", a);
t.addEventListener("ping", a); // same (type, callback, capture): a no-op
t.addEventListener("ping", { handleEvent(e) { seen.push("obj:" + e.type); } });
t.addEventListener("ping", () => seen.push("once"), { once: true });

console.log("dispatch1:", t.dispatchEvent(new Event("ping")), seen.join(" "));
seen.length = 0;
console.log("dispatch2:", t.dispatchEvent(new Event("ping")), seen.join(" "));

// preventDefault only counts on a cancelable event, and dispatchEvent reports it.
const t2 = new EventTarget();
t2.addEventListener("x", (e) => e.preventDefault());
console.log("cancelable:", t2.dispatchEvent(new Event("x", { cancelable: true })));
console.log("not cancelable:", t2.dispatchEvent(new Event("x")));

// A passive listener promises not to cancel, so preventDefault is a no-op.
const t3 = new EventTarget();
t3.addEventListener("p", (e) => { e.preventDefault(); }, { passive: true });
console.log("passive:", t3.dispatchEvent(new Event("p", { cancelable: true })));

// stopImmediatePropagation stops the rest of the list.
const t4 = new EventTarget();
const order = [];
t4.addEventListener("s", (e) => { order.push(1); e.stopImmediatePropagation(); });
t4.addEventListener("s", () => order.push(2));
t4.dispatchEvent(new Event("s"));
console.log("stopImmediate:", order.join(","));

// An abort signal removes the listener.
const ac = new AbortController();
const t5 = new EventTarget();
t5.addEventListener("g", () => console.log("SHOULD NOT PRINT"), { signal: ac.signal });
ac.abort();
t5.dispatchEvent(new Event("g"));
console.log("signal removed listener");

// Event fields, and the target during dispatch.
const t6 = new EventTarget();
t6.addEventListener("f", function (e) {
  console.log("fields:", e.type, e.bubbles, e.cancelable, e.eventPhase, e.target === t6, this === t6);
});
t6.dispatchEvent(new Event("f", { bubbles: true, cancelable: true }));

const ce = new CustomEvent("c", { detail: { n: 1 } });
console.log("custom:", ce.type, ce.detail.n, ce instanceof Event);
console.log("detail default:", new CustomEvent("c").detail);

try { new Event(); } catch (e) { console.log("no-arg:", e.constructor.name); }
try { t.dispatchEvent({ type: "nope" }); } catch (e) { console.log("bad dispatch:", e.constructor.name); }

// AbortSignal is one of these.
console.log("signal is EventTarget:", new AbortController().signal instanceof EventTarget);
console.log("phases:", Event.NONE, Event.CAPTURING_PHASE, Event.AT_TARGET, Event.BUBBLING_PHASE);
