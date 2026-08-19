// node:buffer — Buffer as a real Uint8Array subclass.
//
// This used to carry its bytes in a plain `.bytes` array because the engine had
// no typed arrays. It has them now (including subclassing, shared .buffer, and
// DataView), and the shim was the single reason node's buffer suite scored 10%:
// its tests index `buf[i]`, assert `buf instanceof Uint8Array`, hand Buffers to
// DataView, and compare them structurally. Extending Uint8Array gets all of
// that from the engine instead of re-implementing it approximately.
//
// The other half of the suite is argument validation. Node throws coded errors
// (ERR_OUT_OF_RANGE, ERR_INVALID_ARG_TYPE) for bad input and its tests assert on
// `err.code`, so a function that quietly returns something for `Buffer.alloc(-1)`
// fails a test that never looks at the return value.

var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
var B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var K_MAX_LENGTH = 4294967296;
var K_STRING_MAX_LENGTH = 536870888;

// --- node-style errors ------------------------------------------------------
// Tests match on `.code` and on the constructor, so both have to be right; the
// message text is node's so that the tests which do check it also pass.

function codedError(Ctor, code, message) {
  var e = new Ctor(message);
  e.code = code;
  // node reports the code inside the name ("TypeError [ERR_INVALID_ARG_TYPE]")
  // but restores the plain name on the prototype, so `err.name` reads back as
  // "TypeError". Matching that exactly matters: assert.throws({name}) compares it.
  return e;
}

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an instance of Array';
  var t = typeof value;
  if (t === 'object') {
    var ctor = value.constructor;
    if (ctor && ctor.name) return 'an instance of ' + ctor.name;
    return 'an instance of Object';
  }
  return 'type ' + t;
}

function inspectish(value) {
  if (typeof value === 'string') return " ('" + value + "')";
  if (typeof value === 'number' || typeof value === 'boolean') return ' (' + value + ')';
  if (typeof value === 'bigint') return ' (' + value + 'n)';
  return '';
}

function invalidArgType(name, expected, actual) {
  return codedError(TypeError, 'ERR_INVALID_ARG_TYPE',
    'The "' + name + '" argument must be ' + expected + '. Received ' +
    typeName(actual) + inspectish(actual));
}

function outOfRange(name, range, actual) {
  return codedError(RangeError, 'ERR_OUT_OF_RANGE',
    'The value of "' + name + '" is out of range. It must be ' + range +
    '. Received ' + (typeof actual === 'bigint' ? actual + 'n' : actual));
}

function unknownEncoding(enc) {
  return codedError(TypeError, 'ERR_UNKNOWN_ENCODING', 'Unknown encoding: ' + enc);
}

function bufferOutOfBounds(name) {
  return codedError(RangeError, 'ERR_BUFFER_OUT_OF_BOUNDS',
    name ? '"' + name + '" is outside of buffer bounds'
         : 'Attempt to access memory outside buffer bounds');
}

// Node accepts only a real number here — not a numeric string, not a boxed
// Number — and rejects NaN through the range check rather than the type check.
function validateNumber(value, name) {
  if (typeof value !== 'number') throw invalidArgType(name, 'of type number', value);
}

function validateSize(size) {
  validateNumber(size, 'size');
  if (!(size >= 0 && size <= K_MAX_LENGTH) || Math.floor(size) !== size) {
    throw outOfRange('size', '>= 0 and <= ' + K_MAX_LENGTH, size);
  }
}

function validateOffset(value, name, min, max) {
  if (typeof value !== 'number') throw invalidArgType(name, 'of type number', value);
  if (Math.floor(value) !== value) throw outOfRange(name, 'an integer', value);
  if (value < min || value > max) throw outOfRange(name, '>= ' + min + ' and <= ' + max, value);
}

// --- encodings --------------------------------------------------------------

function normalizeEncoding(enc) {
  if (enc === undefined || enc === null) return 'utf8';
  if (typeof enc !== 'string') return null;
  var e = enc.toLowerCase();
  if (e === 'utf8' || e === 'utf-8') return 'utf8';
  if (e === 'ucs2' || e === 'ucs-2' || e === 'utf16le' || e === 'utf-16le') return 'utf16le';
  if (e === 'latin1' || e === 'binary') return 'latin1';
  if (e === 'base64url') return 'base64url';
  if (e === 'ascii' || e === 'hex' || e === 'base64') return e;
  return null;
}

function requireEncoding(enc) {
  var e = normalizeEncoding(enc);
  if (e === null) throw unknownEncoding(enc);
  return e;
}

function utf8Encode(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    // combine a surrogate pair back into one code point
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function utf8Decode(bytes, start, end) {
  var out = '';
  var i = start;
  while (i < end) {
    var b = bytes[i] & 0xff;
    var cp, need;
    if (b < 0x80) { cp = b; need = 0; }
    else if ((b & 0xe0) === 0xc0) { cp = b & 0x1f; need = 1; }
    else if ((b & 0xf0) === 0xe0) { cp = b & 0x0f; need = 2; }
    else if ((b & 0xf8) === 0xf0) { cp = b & 0x07; need = 3; }
    else { out += String.fromCharCode(0xfffd); i++; continue; }
    if (i + need >= end) { out += String.fromCharCode(0xfffd); break; }
    var bad = false;
    for (var k = 1; k <= need; k++) {
      var cb = bytes[i + k] & 0xff;
      if ((cb & 0xc0) !== 0x80) { bad = true; break; }
      cp = (cp << 6) | (cb & 0x3f);
    }
    if (bad) { out += String.fromCharCode(0xfffd); i++; continue; }
    i += need + 1;
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return out;
}

function hexDecode(str) {
  var out = [];
  for (var i = 0; i + 1 < str.length; i += 2) {
    var v = parseInt(str.substr(i, 2), 16);
    // node stops at the first non-hex pair rather than encoding NaN as a byte
    if (v !== v) break;
    out.push(v);
  }
  return out;
}

function hexEncode(bytes, start, end) {
  var out = '';
  for (var i = start; i < end; i++) {
    var h = (bytes[i] & 0xff).toString(16);
    if (h.length < 2) h = '0' + h;
    out += h;
  }
  return out;
}

function b64Encode(bytes, start, end, alphabet, pad) {
  var out = '';
  for (var i = start; i < end; i += 3) {
    var b0 = bytes[i];
    var b1 = i + 1 < end ? bytes[i + 1] : undefined;
    var b2 = i + 2 < end ? bytes[i + 2] : undefined;
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
    out += b1 === undefined ? (pad ? '=' : '') : alphabet[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
    out += b2 === undefined ? (pad ? '=' : '') : alphabet[b2 & 63];
  }
  return out;
}

function b64Decode(str) {
  var out = [];
  var buf = 0, bits = 0;
  for (var i = 0; i < str.length; i++) {
    var ch = str[i];
    if (ch === '=') continue;
    var v = B64.indexOf(ch);
    if (v < 0) v = B64URL.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
  }
  return out;
}

// Encode a string to a plain array of bytes under `enc` (already normalized).
function encodeFrom(str, enc) {
  var out, i;
  if (enc === 'hex') return hexDecode(str);
  if (enc === 'base64' || enc === 'base64url') return b64Decode(str);
  if (enc === 'latin1' || enc === 'ascii') {
    out = [];
    for (i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
    return out;
  }
  if (enc === 'utf16le') {
    out = [];
    for (i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      out.push(c & 0xff, (c >> 8) & 0xff);
    }
    return out;
  }
  return utf8Encode(str);
}

function decodeTo(bytes, start, end, enc) {
  var s = '';
  var i;
  if (enc === 'hex') return hexEncode(bytes, start, end);
  if (enc === 'base64') return b64Encode(bytes, start, end, B64, true);
  if (enc === 'base64url') return b64Encode(bytes, start, end, B64URL, false);
  if (enc === 'latin1') {
    for (i = start; i < end; i++) s += String.fromCharCode(bytes[i] & 0xff);
    return s;
  }
  if (enc === 'ascii') {
    // ascii is a 7-bit decode in node: the high bit is stripped, not preserved.
    for (i = start; i < end; i++) s += String.fromCharCode(bytes[i] & 0x7f);
    return s;
  }
  if (enc === 'utf16le') {
    for (i = start; i + 1 < end; i += 2) s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
    return s;
  }
  return utf8Decode(bytes, start, end);
}

function byteLengthOf(str, enc) {
  if (enc === 'hex') return str.length >>> 1;
  if (enc === 'latin1' || enc === 'ascii') return str.length;
  if (enc === 'utf16le') return str.length * 2;
  if (enc === 'base64' || enc === 'base64url') return b64Decode(str).length;
  return __byteLength(str);
}

// --- the class --------------------------------------------------------------

class Buffer extends Uint8Array {
  constructor(arg, encodingOrOffset, length) {
    if (typeof arg === 'number') {
      // legacy `new Buffer(size)`: zero-filled, unlike node's historical
      // allocUnsafe behaviour, because leaking previous heap contents is worse
      // than being slightly slower.
      validateSize(arg);
      super(arg);
      return;
    }
    if (typeof arg === 'string') {
      var bytes = encodeFrom(arg, requireEncoding(encodingOrOffset));
      super(bytes.length);
      for (var i = 0; i < bytes.length; i++) this[i] = bytes[i];
      return;
    }
    if (arg instanceof ArrayBuffer) {
      // Shares memory with the ArrayBuffer, which is the whole point of this
      // form; copying here would silently break every zero-copy caller.
      if (encodingOrOffset === undefined) super(arg);
      else if (length === undefined) super(arg, encodingOrOffset);
      else super(arg, encodingOrOffset, length);
      return;
    }
    if (arg instanceof Uint8Array || Array.isArray(arg)) {
      super(arg.length);
      for (var j = 0; j < arg.length; j++) this[j] = arg[j] & 0xff;
      return;
    }
    if (arg && typeof arg === 'object' && typeof arg.length === 'number') {
      super(arg.length >= 0 ? arg.length : 0);
      for (var k = 0; k < this.length; k++) this[k] = arg[k] & 0xff;
      return;
    }
    if (arg === undefined || arg === null) {
      throw invalidArgType('value',
        'of type string, Buffer, ArrayBuffer, Array, or Array-like Object', arg);
    }
    super(0);
  }

  toString(encoding, start, end) {
    var enc = requireEncoding(encoding);
    var len = this.length;
    var s = start === undefined ? 0 : Math.trunc(start) || 0;
    var e = end === undefined ? len : Math.trunc(end) || 0;
    if (s < 0) s = 0;
    if (e > len) e = len;
    if (e <= s) return '';
    return decodeTo(this, s, e, enc);
  }

  toJSON() {
    var data = [];
    for (var i = 0; i < this.length; i++) data.push(this[i]);
    return { type: 'Buffer', data: data };
  }

  equals(other) {
    if (!(other instanceof Uint8Array)) {
      throw invalidArgType('otherBuffer', 'an instance of Buffer or Uint8Array', other);
    }
    if (other === this) return true;
    if (other.length !== this.length) return false;
    for (var i = 0; i < this.length; i++) if (other[i] !== this[i]) return false;
    return true;
  }

  compare(target, targetStart, targetEnd, sourceStart, sourceEnd) {
    if (!(target instanceof Uint8Array)) {
      throw invalidArgType('target', 'an instance of Buffer or Uint8Array', target);
    }
    var ts = targetStart === undefined ? 0 : targetStart;
    var te = targetEnd === undefined ? target.length : targetEnd;
    var ss = sourceStart === undefined ? 0 : sourceStart;
    var se = sourceEnd === undefined ? this.length : sourceEnd;
    if (ts < 0 || te > target.length || ss < 0 || se > this.length) {
      throw outOfRange('targetStart', 'in range', ts);
    }
    var i = ss, j = ts;
    while (i < se && j < te) {
      if (this[i] !== target[j]) return this[i] < target[j] ? -1 : 1;
      i++; j++;
    }
    var a = se - ss, b = te - ts;
    return a === b ? 0 : (a < b ? -1 : 1);
  }

  copy(target, targetStart, sourceStart, sourceEnd) {
    if (!(target instanceof Uint8Array)) {
      throw invalidArgType('target', 'an instance of Buffer or Uint8Array', target);
    }
    var ts = targetStart === undefined ? 0 : Math.trunc(targetStart) || 0;
    var ss = sourceStart === undefined ? 0 : Math.trunc(sourceStart) || 0;
    var se = sourceEnd === undefined ? this.length : Math.trunc(sourceEnd) || 0;
    if (ts < 0) throw outOfRange('targetStart', '>= 0', ts);
    if (ss < 0) throw outOfRange('sourceStart', '>= 0', ss);
    if (se > this.length) se = this.length;
    if (ts >= target.length || ss >= se) return 0;
    var n = Math.min(se - ss, target.length - ts);
    // Copy through a snapshot when the ranges overlap in the same store, or a
    // forward copy would read bytes it has already overwritten.
    if (target.buffer === this.buffer && ts > ss) {
      for (var k = n - 1; k >= 0; k--) target[ts + k] = this[ss + k];
    } else {
      for (var i = 0; i < n; i++) target[ts + i] = this[ss + i];
    }
    return n;
  }

  fill(value, offset, end, encoding) {
    if (typeof offset === 'string') { encoding = offset; offset = 0; end = this.length; }
    else if (typeof end === 'string') { encoding = end; end = this.length; }
    var s = offset === undefined ? 0 : Math.trunc(offset) || 0;
    var e = end === undefined ? this.length : Math.trunc(end) || 0;
    if (s < 0 || e > this.length || s > e) throw bufferOutOfBounds();
    var pattern;
    if (typeof value === 'number') pattern = [value & 0xff];
    else if (typeof value === 'string') {
      if (value.length === 0) pattern = [0];
      else pattern = encodeFrom(value, requireEncoding(encoding));
    } else if (value instanceof Uint8Array) {
      pattern = value.length === 0 ? [0] : value;
    } else if (typeof value === 'boolean') pattern = [value ? 1 : 0];
    else pattern = [0];
    if (pattern.length === 0) pattern = [0];
    for (var i = s; i < e; i++) this[i] = pattern[(i - s) % pattern.length] & 0xff;
    return this;
  }

  write(string, offset, length, encoding) {
    if (typeof string !== 'string') throw invalidArgType('string', 'of type string', string);
    var off = 0, len, enc;
    if (offset === undefined) { off = 0; len = this.length; enc = 'utf8'; }
    else if (typeof offset === 'string') { enc = offset; off = 0; len = this.length; }
    else {
      off = Math.trunc(offset) || 0;
      if (typeof length === 'string') { enc = length; len = this.length - off; }
      else if (length === undefined) { len = this.length - off; enc = encoding; }
      else { len = Math.trunc(length) || 0; enc = encoding; }
    }
    enc = requireEncoding(enc);
    if (off < 0 || off > this.length) throw outOfRange('offset', '>= 0 and <= ' + this.length, off);
    var src = encodeFrom(string, enc);
    var max = Math.min(len, this.length - off, src.length);
    for (var i = 0; i < max; i++) this[off + i] = src[i];
    return max < 0 ? 0 : max;
  }

  // node's slice IS subarray: it shares memory rather than copying. Returning a
  // copy here made mutations through a slice silently invisible to the parent.
  slice(start, end) { return this.subarray(start, end); }

  subarray(start, end) {
    var len = this.length;
    var s = start === undefined ? 0 : Math.trunc(start) || 0;
    var e = end === undefined ? len : Math.trunc(end) || 0;
    if (s < 0) { s = len + s; if (s < 0) s = 0; } else if (s > len) s = len;
    if (e < 0) { e = len + e; if (e < 0) e = 0; } else if (e > len) e = len;
    if (e < s) e = s;
    return new Buffer(this.buffer, this.byteOffset + s, e - s);
  }

  indexOf(value, byteOffset, encoding) { return bufIndexOf(this, value, byteOffset, encoding, true); }
  lastIndexOf(value, byteOffset, encoding) { return bufIndexOf(this, value, byteOffset, encoding, false); }
  includes(value, byteOffset, encoding) { return this.indexOf(value, byteOffset, encoding) !== -1; }

  swap16() {
    if (this.length % 2 !== 0) throw codedError(RangeError, 'ERR_INVALID_BUFFER_SIZE', 'Buffer size must be a multiple of 16-bits');
    for (var i = 0; i < this.length; i += 2) { var t = this[i]; this[i] = this[i + 1]; this[i + 1] = t; }
    return this;
  }
  swap32() {
    if (this.length % 4 !== 0) throw codedError(RangeError, 'ERR_INVALID_BUFFER_SIZE', 'Buffer size must be a multiple of 32-bits');
    for (var i = 0; i < this.length; i += 4) {
      var a = this[i], b = this[i + 1];
      this[i] = this[i + 3]; this[i + 3] = a;
      this[i + 1] = this[i + 2]; this[i + 2] = b;
    }
    return this;
  }
  swap64() {
    if (this.length % 8 !== 0) throw codedError(RangeError, 'ERR_INVALID_BUFFER_SIZE', 'Buffer size must be a multiple of 64-bits');
    for (var i = 0; i < this.length; i += 8) {
      for (var k = 0; k < 4; k++) {
        var t = this[i + k]; this[i + k] = this[i + 7 - k]; this[i + 7 - k] = t;
      }
    }
    return this;
  }

  toLocaleString(encoding, start, end) { return this.toString(encoding, start, end); }
}

function bufIndexOf(buf, value, byteOffset, encoding, forward) {
  if (typeof byteOffset === 'string') { encoding = byteOffset; byteOffset = undefined; }
  var needle;
  if (typeof value === 'string') needle = encodeFrom(value, requireEncoding(encoding));
  else if (typeof value === 'number') needle = [value & 0xff];
  else if (value instanceof Uint8Array) needle = value;
  else throw invalidArgType('value', 'one of type number, string, Buffer, or Uint8Array', value);

  var len = buf.length;
  var off = byteOffset === undefined ? (forward ? 0 : len - needle.length) : (Math.trunc(byteOffset) || 0);
  if (off < 0) off = len + off;
  if (needle.length === 0) return forward ? (off > len ? len : (off < 0 ? 0 : off)) : len;
  if (forward) {
    if (off < 0) off = 0;
    for (var i = off; i + needle.length <= len; i++) {
      var hit = true;
      for (var j = 0; j < needle.length; j++) if (buf[i + j] !== (needle[j] & 0xff)) { hit = false; break; }
      if (hit) return i;
    }
    return -1;
  }
  if (off > len - needle.length) off = len - needle.length;
  for (var p = off; p >= 0; p--) {
    var ok = true;
    for (var q = 0; q < needle.length; q++) if (buf[p + q] !== (needle[q] & 0xff)) { ok = false; break; }
    if (ok) return p;
  }
  return -1;
}

// --- numeric accessors ------------------------------------------------------
// Integer forms are written by hand over the bytes (exact to 48 bits, which is
// node's own limit for the non-Big variants); float and BigInt go through a
// DataView on the same store, so the engine does the IEEE-754 and 64-bit work.

function checkBounds(buf, offset, size) {
  if (typeof offset !== 'number') throw invalidArgType('offset', 'of type number', offset);
  if (offset < 0 || offset + size > buf.length) {
    throw outOfRange('offset', '>= 0 and <= ' + (buf.length - size), offset);
  }
}

function viewOf(buf) { return new DataView(buf.buffer, buf.byteOffset, buf.length); }

function _rdU(buf, off, len, be) {
  var v = 0;
  for (var i = 0; i < len; i++) v = v * 256 + (buf[off + (be ? i : len - 1 - i)] & 0xff);
  return v;
}
function _wrU(buf, val, off, len, be) {
  var v = val;
  for (var i = 0; i < len; i++) {
    var b = v % 256;
    buf[off + (be ? len - 1 - i : i)] = b & 0xff;
    v = Math.floor(v / 256);
  }
  return off + len;
}
function _sgn(v, bits) { var m = Math.pow(2, bits); return v >= m / 2 ? v - m : v; }

function defRead(name, size, fn) {
  Buffer.prototype[name] = function (offset) {
    var o = offset === undefined ? 0 : offset;
    checkBounds(this, o, size);
    return fn(this, o);
  };
}
function defWrite(name, size, fn) {
  Buffer.prototype[name] = function (value, offset) {
    var o = offset === undefined ? 0 : offset;
    checkBounds(this, o, size);
    fn(this, value, o);
    return o + size;
  };
}

defRead('readUInt8', 1, function (b, o) { return b[o] & 0xff; });
defRead('readUInt16BE', 2, function (b, o) { return _rdU(b, o, 2, true); });
defRead('readUInt16LE', 2, function (b, o) { return _rdU(b, o, 2, false); });
defRead('readUInt32BE', 4, function (b, o) { return _rdU(b, o, 4, true); });
defRead('readUInt32LE', 4, function (b, o) { return _rdU(b, o, 4, false); });
defRead('readInt8', 1, function (b, o) { return _sgn(b[o] & 0xff, 8); });
defRead('readInt16BE', 2, function (b, o) { return _sgn(_rdU(b, o, 2, true), 16); });
defRead('readInt16LE', 2, function (b, o) { return _sgn(_rdU(b, o, 2, false), 16); });
defRead('readInt32BE', 4, function (b, o) { return _sgn(_rdU(b, o, 4, true), 32); });
defRead('readInt32LE', 4, function (b, o) { return _sgn(_rdU(b, o, 4, false), 32); });
defRead('readFloatLE', 4, function (b, o) { return viewOf(b).getFloat32(o, true); });
defRead('readFloatBE', 4, function (b, o) { return viewOf(b).getFloat32(o, false); });
defRead('readDoubleLE', 8, function (b, o) { return viewOf(b).getFloat64(o, true); });
defRead('readDoubleBE', 8, function (b, o) { return viewOf(b).getFloat64(o, false); });

defWrite('writeUInt8', 1, function (b, v, o) { b[o] = v & 0xff; });
defWrite('writeUInt16BE', 2, function (b, v, o) { _wrU(b, v, o, 2, true); });
defWrite('writeUInt16LE', 2, function (b, v, o) { _wrU(b, v, o, 2, false); });
defWrite('writeUInt32BE', 4, function (b, v, o) { _wrU(b, v, o, 4, true); });
defWrite('writeUInt32LE', 4, function (b, v, o) { _wrU(b, v, o, 4, false); });
defWrite('writeInt8', 1, function (b, v, o) { b[o] = v & 0xff; });
defWrite('writeInt16BE', 2, function (b, v, o) { _wrU(b, v < 0 ? v + 0x10000 : v, o, 2, true); });
defWrite('writeInt16LE', 2, function (b, v, o) { _wrU(b, v < 0 ? v + 0x10000 : v, o, 2, false); });
defWrite('writeInt32BE', 4, function (b, v, o) { _wrU(b, v < 0 ? v + 0x100000000 : v, o, 4, true); });
defWrite('writeInt32LE', 4, function (b, v, o) { _wrU(b, v < 0 ? v + 0x100000000 : v, o, 4, false); });
defWrite('writeFloatLE', 4, function (b, v, o) { viewOf(b).setFloat32(o, v, true); });
defWrite('writeFloatBE', 4, function (b, v, o) { viewOf(b).setFloat32(o, v, false); });
defWrite('writeDoubleLE', 8, function (b, v, o) { viewOf(b).setFloat64(o, v, true); });
defWrite('writeDoubleBE', 8, function (b, v, o) { viewOf(b).setFloat64(o, v, false); });

// The variable-width forms take their length as a second argument, so they
// cannot go through defRead/defWrite's fixed size.
Buffer.prototype.readUIntBE = function (o, len) { checkBounds(this, o || 0, len); return _rdU(this, o || 0, len, true); };
Buffer.prototype.readUIntLE = function (o, len) { checkBounds(this, o || 0, len); return _rdU(this, o || 0, len, false); };
Buffer.prototype.readIntBE = function (o, len) { checkBounds(this, o || 0, len); return _sgn(_rdU(this, o || 0, len, true), len * 8); };
Buffer.prototype.readIntLE = function (o, len) { checkBounds(this, o || 0, len); return _sgn(_rdU(this, o || 0, len, false), len * 8); };
Buffer.prototype.writeUIntBE = function (v, o, len) { checkBounds(this, o || 0, len); return _wrU(this, v, o || 0, len, true); };
Buffer.prototype.writeUIntLE = function (v, o, len) { checkBounds(this, o || 0, len); return _wrU(this, v, o || 0, len, false); };
Buffer.prototype.writeIntBE = function (v, o, len) { checkBounds(this, o || 0, len); return _wrU(this, v < 0 ? v + Math.pow(2, len * 8) : v, o || 0, len, true); };
Buffer.prototype.writeIntLE = function (v, o, len) { checkBounds(this, o || 0, len); return _wrU(this, v < 0 ? v + Math.pow(2, len * 8) : v, o || 0, len, false); };

// 64-bit integers cannot round-trip through a double, so these stay in BigInt
// the whole way and read/write the bytes directly.
function bigRead(buf, off, le, signed) {
  var v = 0n;
  for (var i = 0; i < 8; i++) {
    var b = BigInt(buf[off + (le ? 7 - i : i)] & 0xff);
    v = (v << 8n) | b;
  }
  if (signed && v >= 0x8000000000000000n) v -= 0x10000000000000000n;
  return v;
}
function bigWrite(buf, value, off, le) {
  if (typeof value !== 'bigint') throw invalidArgType('value', 'of type bigint', value);
  var v = value < 0n ? value + 0x10000000000000000n : value;
  for (var i = 0; i < 8; i++) {
    var byte = Number(v & 0xffn);
    buf[off + (le ? i : 7 - i)] = byte;
    v >>= 8n;
  }
  return off + 8;
}
defRead('readBigInt64LE', 8, function (b, o) { return bigRead(b, o, true, true); });
defRead('readBigInt64BE', 8, function (b, o) { return bigRead(b, o, false, true); });
defRead('readBigUInt64LE', 8, function (b, o) { return bigRead(b, o, true, false); });
defRead('readBigUInt64BE', 8, function (b, o) { return bigRead(b, o, false, false); });
defWrite('writeBigInt64LE', 8, function (b, v, o) { bigWrite(b, v, o, true); });
defWrite('writeBigInt64BE', 8, function (b, v, o) { bigWrite(b, v, o, false); });
defWrite('writeBigUInt64LE', 8, function (b, v, o) { bigWrite(b, v, o, true); });
defWrite('writeBigUInt64BE', 8, function (b, v, o) { bigWrite(b, v, o, false); });

// node's aliases, which real code uses interchangeably with the UInt spellings
Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE;
Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE;
Buffer.prototype.writeUintBE = Buffer.prototype.writeUIntBE;
Buffer.prototype.writeUintLE = Buffer.prototype.writeUIntLE;
Buffer.prototype.readBigUint64LE = Buffer.prototype.readBigUInt64LE;
Buffer.prototype.readBigUint64BE = Buffer.prototype.readBigUInt64BE;
Buffer.prototype.writeBigUint64LE = Buffer.prototype.writeBigUInt64LE;
Buffer.prototype.writeBigUint64BE = Buffer.prototype.writeBigUInt64BE;
var uintAliases = ['readUint8', 'readUint16BE', 'readUint16LE', 'readUint32BE', 'readUint32LE',
                   'writeUint8', 'writeUint16BE', 'writeUint16LE', 'writeUint32BE', 'writeUint32LE'];
for (var ua = 0; ua < uintAliases.length; ua++) {
  Buffer.prototype[uintAliases[ua]] = Buffer.prototype[uintAliases[ua].replace('Uint', 'UInt')];
}

// --- statics ----------------------------------------------------------------

Buffer.poolSize = 8192;

Buffer.alloc = function (size, fill, encoding) {
  validateSize(size);
  var buf = new Buffer(size);
  if (fill !== undefined && fill !== 0 && size > 0) buf.fill(fill, 0, size, encoding);
  return buf;
};
Buffer.allocUnsafe = function (size) { validateSize(size); return new Buffer(size); };
Buffer.allocUnsafeSlow = function (size) { validateSize(size); return new Buffer(size); };

Buffer.from = function (value, encodingOrOffset, length) {
  if (typeof value === 'string') return new Buffer(value, encodingOrOffset);
  if (value instanceof ArrayBuffer) return new Buffer(value, encodingOrOffset, length);
  if (value instanceof Uint8Array || Array.isArray(value)) return new Buffer(value);
  if (value && typeof value === 'object') {
    // node consults valueOf and Symbol.toPrimitive before giving up, which is
    // how `Buffer.from(new String('abc'))` and boxed values work.
    if (typeof value[Symbol.toPrimitive] === 'function') {
      var prim = value[Symbol.toPrimitive]('string');
      if (typeof prim === 'string') return new Buffer(prim, encodingOrOffset);
    }
    if (typeof value.valueOf === 'function') {
      var v = value.valueOf();
      if (v !== value && (typeof v === 'string' || v instanceof Uint8Array || Array.isArray(v))) {
        return Buffer.from(v, encodingOrOffset, length);
      }
    }
    if (typeof value.length === 'number') return new Buffer(value);
  }
  throw invalidArgType('first argument',
    'of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object', value);
};

Buffer.of = function () {
  var out = new Buffer(arguments.length);
  for (var i = 0; i < arguments.length; i++) out[i] = arguments[i] & 0xff;
  return out;
};

Buffer.concat = function (list, totalLength) {
  if (!Array.isArray(list)) throw invalidArgType('list', 'an instance of Array', list);
  var i, total = 0;
  for (i = 0; i < list.length; i++) {
    if (!(list[i] instanceof Uint8Array)) {
      throw invalidArgType('list[' + i + ']', 'an instance of Buffer or Uint8Array', list[i]);
    }
    total += list[i].length;
  }
  if (totalLength !== undefined) { validateNumber(totalLength, 'totalLength'); total = totalLength; }
  var out = new Buffer(total);
  var pos = 0;
  for (i = 0; i < list.length && pos < total; i++) {
    var src = list[i];
    for (var j = 0; j < src.length && pos < total; j++) out[pos++] = src[j];
  }
  return out;
};

Buffer.byteLength = function (value, encoding) {
  if (typeof value === 'string') return byteLengthOf(value, requireEncoding(encoding));
  if (value instanceof Uint8Array) return value.length;
  if (value instanceof ArrayBuffer) return value.byteLength;
  throw invalidArgType('string',
    'of type string or an instance of Buffer or ArrayBuffer', value);
};

Buffer.isBuffer = function (v) { return v instanceof Buffer; };

Buffer.isEncoding = function (enc) {
  if (typeof enc !== 'string') return false;
  return normalizeEncoding(enc) !== null;
};

Buffer.compare = function (a, b) {
  if (!(a instanceof Uint8Array)) throw invalidArgType('buf1', 'an instance of Buffer or Uint8Array', a);
  if (!(b instanceof Uint8Array)) throw invalidArgType('buf2', 'an instance of Buffer or Uint8Array', b);
  var n = Math.min(a.length, b.length);
  for (var i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return a.length === b.length ? 0 : (a.length < b.length ? -1 : 1);
};

// --- module surface ---------------------------------------------------------

function isUtf8(input) {
  if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) {
    throw invalidArgType('input', 'an instance of ArrayBuffer, Buffer, or Uint8Array', input);
  }
  var b = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  var i = 0;
  while (i < b.length) {
    var c = b[i];
    var need;
    if (c < 0x80) { i++; continue; }
    else if ((c & 0xe0) === 0xc0) { need = 1; if (c < 0xc2) return false; }
    else if ((c & 0xf0) === 0xe0) need = 2;
    else if ((c & 0xf8) === 0xf0) { need = 3; if (c > 0xf4) return false; }
    else return false;
    if (i + need >= b.length + 0 && i + need > b.length - 1) return false;
    for (var k = 1; k <= need; k++) if ((b[i + k] & 0xc0) !== 0x80) return false;
    i += need + 1;
  }
  return true;
}

function isAscii(input) {
  if (!(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) {
    throw invalidArgType('input', 'an instance of ArrayBuffer, Buffer, or Uint8Array', input);
  }
  var b = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  for (var i = 0; i < b.length; i++) if (b[i] > 0x7f) return false;
  return true;
}

// node's Buffer is a callable FUNCTION, not a class: `Buffer(10)` and
// `Buffer('x')` are deprecated but legal and still used by older packages, and
// node's own test suite asserts that `Buffer(-1)` throws ERR_OUT_OF_RANGE rather
// than "cannot be invoked without 'new'". The class above stays as the
// implementation and keeps the Uint8Array subclassing; this wrapper is what the
// module exports, so both call forms work and `instanceof` still answers on the
// same prototype.
function BufferCallable(arg, encodingOrOffset, length) {
  if (typeof arg === "number") return Buffer.alloc(arg);
  return Buffer.from(arg, encodingOrOffset, length);
}
BufferCallable.prototype = Buffer.prototype;
var __bufStatics = Object.getOwnPropertyNames(Buffer);
for (var __bi = 0; __bi < __bufStatics.length; __bi++) {
  var __bk = __bufStatics[__bi];
  if (__bk === "prototype" || __bk === "name" || __bk === "length") continue;
  BufferCallable[__bk] = Buffer[__bk];
}

exports.Buffer = BufferCallable;
exports.SlowBuffer = function (size) { return Buffer.alloc(size); };
exports.isUtf8 = isUtf8;
exports.isAscii = isAscii;
exports.kMaxLength = K_MAX_LENGTH;
exports.kStringMaxLength = K_STRING_MAX_LENGTH;
exports.constants = { MAX_LENGTH: K_MAX_LENGTH, MAX_STRING_LENGTH: K_STRING_MAX_LENGTH };
exports.btoa = function (data) { return Buffer.from(String(data), 'binary').toString('base64'); };
exports.atob = function (data) { return Buffer.from(String(data), 'base64').toString('binary'); };
