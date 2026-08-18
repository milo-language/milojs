// node:zlib — real DEFLATE, over std's compressors.
//
// This module used to be an identity pass-through: gzipSync returned its input
// uncompressed and gunzipSync handed back whatever it was given, so a round trip
// "worked" while nothing was ever compressed and real gzip data could not be
// read at all.
//
// Payloads cross the native boundary as Uint8Array. They cannot cross as
// strings: milojs strings are UTF-8, so compressed bytes that are not valid
// UTF-8 decode to U+FFFD and the data is destroyed — gzipSync then gunzipSync
// failed with "incorrect header check" for exactly that reason.
"use strict";

var stream = require('stream');
var Buffer = require('buffer').Buffer;
var _err = require('_errors');

function toBytes(x) {
  if (typeof x === 'string') return Buffer.from(x, 'utf8');
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  throw _err.ERR_INVALID_ARG_TYPE('buffer',
    ['string', 'Buffer', 'TypedArray', 'DataView', 'ArrayBuffer'], x);
}

function dataError(msg) {
  var e = new Error(msg);
  e.code = 'Z_DATA_ERROR';
  e.errno = -3;
  return e;
}

function makeSync(nativeFn, name, decompress) {
  return function (buf, options) {
    var out = nativeFn(toBytes(buf));
    // The inflaters answer null for corrupt input; node reports that as a
    // Z_DATA_ERROR rather than returning something plausible.
    if (out === null || out === undefined) {
      if (decompress) throw dataError('incorrect header check');
      throw dataError(name + ' failed');
    }
    return Buffer.from(out);
  };
}

function makeAsync(syncFn) {
  return function (buf, options, cb) {
    if (typeof options === 'function') { cb = options; options = undefined; }
    if (typeof cb !== 'function') throw _err.ERR_INVALID_ARG_TYPE('callback', 'of type function', cb);
    var result, err = null;
    try { result = syncFn(buf, options); } catch (e) { err = e; }
    // Deferred, because node's callback never fires synchronously and callers
    // rely on that ordering.
    setTimeout(function () { cb(err, err ? undefined : result); }, 0);
  };
}

var gzipSync = makeSync(__deflateGzip, 'gzip', false);
var gunzipSync = makeSync(__inflateGzip, 'gunzip', true);
var deflateSync = makeSync(__deflateZlib, 'deflate', false);
var inflateSync = makeSync(__inflateZlib, 'inflate', true);
var deflateRawSync = makeSync(__deflateRaw, 'deflateRaw', false);
var inflateRawSync = makeSync(__inflateRaw, 'inflateRaw', true);

// gzip and zlib streams are self-describing, so unzip picks by magic number
// rather than making the caller say which it has.
function unzipSync(buf, options) {
  var b = toBytes(buf);
  if (b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b) return gunzipSync(buf, options);
  return inflateSync(buf, options);
}

// --- streaming --------------------------------------------------------------
// A Transform that buffers everything and converts on flush. DEFLATE is not
// incremental here, so a chunk-at-a-time codec would produce a stream no other
// implementation could read.

function makeTransform(convert) {
  var chunks = [];
  var t = new stream.Transform({
    transform: function (chunk, enc, cb) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      cb();
    },
    flush: function (cb) {
      var self = this;
      try {
        self.push(convert(chunks.length === 1 ? chunks[0] : Buffer.concat(chunks)));
        cb();
      } catch (e) {
        cb(e);
      }
    },
  });
  return t;
}

exports.createGzip = function () { return makeTransform(gzipSync); };
exports.createGunzip = function () { return makeTransform(gunzipSync); };
exports.createDeflate = function () { return makeTransform(deflateSync); };
exports.createInflate = function () { return makeTransform(inflateSync); };
exports.createDeflateRaw = function () { return makeTransform(deflateRawSync); };
exports.createInflateRaw = function () { return makeTransform(inflateRawSync); };
exports.createUnzip = function () { return makeTransform(unzipSync); };

// Brotli has no implementation in std. Kept as a pass-through rather than
// removed, because middleware probes for the functions' existence — but it is
// NOT compression and is marked so here rather than pretending otherwise.
function brotliPassthrough(buf) { return typeof buf === 'string' ? Buffer.from(buf) : buf; }
exports.createBrotliCompress = function () { return makeTransform(brotliPassthrough); };
exports.createBrotliDecompress = function () { return makeTransform(brotliPassthrough); };
exports.brotliCompressSync = brotliPassthrough;
exports.brotliDecompressSync = brotliPassthrough;
exports.brotliCompress = makeAsync(brotliPassthrough);
exports.brotliDecompress = makeAsync(brotliPassthrough);

exports.gzipSync = gzipSync;
exports.gunzipSync = gunzipSync;
exports.deflateSync = deflateSync;
exports.inflateSync = inflateSync;
exports.deflateRawSync = deflateRawSync;
exports.inflateRawSync = inflateRawSync;
exports.unzipSync = unzipSync;

exports.gzip = makeAsync(gzipSync);
exports.gunzip = makeAsync(gunzipSync);
exports.deflate = makeAsync(deflateSync);
exports.inflate = makeAsync(inflateSync);
exports.deflateRaw = makeAsync(deflateRawSync);
exports.inflateRaw = makeAsync(inflateRawSync);
exports.unzip = makeAsync(unzipSync);

exports.constants = {
  Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3,
  Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6,
  Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3, Z_MEM_ERROR: -4, Z_BUF_ERROR: -5, Z_VERSION_ERROR: -6,
  Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_DEFAULT_STRATEGY: 0, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4,
  DEFLATE: 1, INFLATE: 2, GZIP: 3, GUNZIP: 4, DEFLATERAW: 5, INFLATERAW: 6, UNZIP: 7,
};
exports.codes = {
  Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3, Z_MEM_ERROR: -4, Z_BUF_ERROR: -5, Z_VERSION_ERROR: -6,
};
