const addon = require(process.env.MILOJS_NAPI_ADDON);
// 1 is napi_invalid_arg. Asserting the VALUE, not just that we got here: a
// process that died would print nothing and still exit 0.
console.log("NULL out-param status:", addon.probe());
console.log("still running after it:", true);
