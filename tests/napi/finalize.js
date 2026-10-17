// Node-API finalizers run once, after the object is unreachable and collected,
// and not at all for a wrap the addon took back with napi_remove_wrap.
//
// The collector scans stacks conservatively, so a stale stack word can keep any
// one garbage object alive (seen on linux-x64 CI for the single external). Each
// kind is therefore made N times and checked as a range: at least one finalized
// (finalizers run at all) and never more than were made (none runs twice).
const addon = require(process.env.MILOJS_NAPI_ADDON);
const N = 8;
const tick = () => new Promise((r) => setImmediate(r));
const show = (label) => {
  const c = addon.counts();
  // makeMulti adds two finalizers per object; removeOne's wrap must never count
  const inRange = (n, max) => n >= 1 && n <= max;
  console.log(label, "wrap", inRange(c.wrap, N), "add", inRange(c.add, 2 * N),
    "external", inRange(c.external, N), "bad", c.bad);
};

function makeGarbage() {
  const w = addon.makeWrapped();
  console.log("second wrap status:", addon.wrapTwice(w));
  console.log("unwrap of a plain object:", addon.unwrapStatus({}));
  for (let i = 1; i < N; i++) addon.makeWrapped();
  for (let i = 0; i < N; i++) addon.makeMulti();
  for (let i = 0; i < N; i++) addon.makeExternal();
}

function removeOne() {
  const r = addon.makeWrapped();
  console.log("remove_wrap returned the data:", addon.removeWrap(r));
  console.log("unwrap after remove:", addon.unwrapStatus(r));
  console.log("second remove_wrap:", addon.removeWrap(r));
}

(async () => {
  makeGarbage();
  removeOne();
  const kept = addon.makeWrapped();
  const c0 = addon.counts();
  console.log("before gc: wrap", c0.wrap, "add", c0.add, "external", c0.external, "bad", c0.bad);
  globalThis.gc();
  await tick();
  show("after gc and a tick:");
  globalThis.gc();
  await tick();
  show("after a second gc:");
  console.log("kept still wraps:", addon.unwrapStatus(kept));
  globalThis.keepUntilExit = addon.makeExitWrapped();
  console.log("script done");
})();
