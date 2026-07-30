process.dlopen(module, process.env.MILOJS_NAPI_ADDON);
console.log(module.exports.callJs(function (value) { return value + 1; }));
