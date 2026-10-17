// Node-API finalizers run once, after the object is unreachable and collected,
// and not at all for a wrap the addon took back with napi_remove_wrap.
const addon = require(process.env.MILOJS_NAPI_ADDON);
const tick = () => new Promise((r) => setImmediate(r));
const show = (label) => {
  const c = addon.counts();
  console.log(label, "wrap", c.wrap, "add", c.add, "external", c.external, "bad", c.bad);
};

function makeGarbage() {
  const w = addon.makeWrapped();
  console.log("second wrap status:", addon.wrapTwice(w));
  console.log("unwrap of a plain object:", addon.unwrapStatus({}));
  addon.makeMulti();
  addon.makeExternal();
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
  show("before gc:");
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
