process.dlopen(module, process.env.MILOJS_NAPI_ADDON);
console.log(module.exports.callJs(function (value) { return value + 1; }));

const native = module.exports.makeBuffer();
gc();
console.log(Buffer.isBuffer(native), native.length, native[0], native.readUInt16BE(0), native.toString("hex"));
native[0] = 7;
console.log(module.exports.mutateBuffer(native), native[1], native.toString("hex"));

const copy = module.exports.copyBuffer(native);
native[2] = 8;
console.log(copy[2], native[2], copy.toString("hex"));

const javascript = Buffer.from([5, 6, 7]);
console.log(module.exports.mutateBuffer(javascript), javascript[1], javascript.toString("hex"));
