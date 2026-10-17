// A second require of a loaded addon answers the cached exports object. The first load here
// happens inside a native callback, so the load-time napi handle (a host root) is released
// when the callback returns and the cache in napiAddonExports is the only thing keeping the
// exports alive: collect must mark it, or `tag` is gone (milojs printed undefined).
process.dlopen(module, process.env.MILOJS_NAPI_ADDON);
const other = process.env.MILOJS_NAPI_OTHER;
// first load happens inside a native callback: its handle scope closes on return
module.exports.callJs(function () { require(other).tag = 42; return 1; });
gc();
const junk = [];
for (let i = 0; i < 3000; i++) junk.push({ i, a: [i, 's' + i] });
gc();
console.log(require(other).tag);
