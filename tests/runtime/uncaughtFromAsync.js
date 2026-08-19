// A throw from an async callback must reach process.on('uncaughtException'),
// which is node's one documented way to survive one. The escape hatch existed
// but was wired into the timer path only, so a throw from a microtask or from a
// nextTick callback killed the process however many listeners were registered.
process.on("uncaughtException", (e) => console.log("caught:", e.message));

process.nextTick(() => { throw new Error("from nextTick"); });
setTimeout(() => { throw new Error("from timer"); }, 0);

// Validation on the natives, while we are here: nextTick took whatever it was
// handed and queued it, so a non-function blew up a tick later with no hint of
// where it came from.
for (const v of [1, "x", null, {}, undefined]) {
  try { process.nextTick(v); console.log("no throw for", String(v)); }
  catch (e) { console.log("nextTick", String(v).padEnd(9), e.code, "|", e.message); }
}
try { process.setSourceMapsEnabled("yes"); } catch (e) { console.log("setSourceMapsEnabled:", e.code); }

setTimeout(() => console.log("still alive"), 30);
