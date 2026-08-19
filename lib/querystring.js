// node:querystring — enough of the API for express/body-parser.
// A %XX run is UTF-8, not a run of code units. Decoding each byte on its own
// turned "%C3%A9" into "Ã©" — every non-ASCII value that round-tripped through
// parse came back as mojibake. decodeURIComponent already does this correctly;
// it only has to be caught, because node's unescape is LENIENT where
// decodeURIComponent throws (a stray "%" or a truncated escape stays literal).
function decodeComponent(s, decodeSpaces) {
  var text = String(s);
  try {
    // Well-formed input never reaches the '+' rule: node's unescape only maps
    // '+' to a space on the FALLBACK path, so unescape("a+b", true) is "a+b".
    return decodeURIComponent(text);
  } catch (e) {
    return lenientDecode(decodeSpaces ? text.split('+').join(' ') : text);
  }
}

// The fallback for input decodeURIComponent rejects: valid escapes still decode,
// and anything malformed is kept verbatim rather than throwing.
function lenientDecode(s) {
  var bytes = [];
  var i = 0;
  while (i < s.length) {
    var c = s.charAt(i);
    if (c === '%' && i + 2 < s.length + 1) {
      var hex = s.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    // A non-escaped character contributes its own UTF-8 bytes.
    var enc = unescape(encodeURIComponent(c));
    for (var b = 0; b < enc.length; b++) bytes.push(enc.charCodeAt(b) & 0xff);
    i += 1;
  }
  return require('buffer').Buffer.from(bytes).toString('utf8');
}

// parse's own decoder, which is where '+' really does mean a space. The
// replacement happens BEFORE the percent-decoding so that "%2B" stays a '+'.
function decode(s) {
  return decodeComponent(String(s).split('+').join(' '), true);
}

// querystring.escape has exactly encodeURIComponent's unescaped set, so it IS
// encodeURIComponent. The hand-rolled version percent-encoded each UTF-16 code
// UNIT rather than the UTF-8 bytes, so "é" came out "%E9" instead of "%C3%A9"
// and an astral character lost its low surrogate entirely ("𝌆" became "%D834").
// Anything non-ASCII round-tripped to mojibake.
function encodeComponent(s) {
  return encodeURIComponent(stringifyPrimitive(s));
}

// escape() is NOT stringify's value conversion: it is defined on the string
// form of whatever it is given, so escape({}) is "%5Bobject%20Object%5D" where
// stringify({ a: {} }) is "a=".
//
// It is also not encodeURIComponent, though the unescaped set is identical.
// node's encoder does not VALIDATE a surrogate pair: it takes the low ten bits
// of whatever follows a high surrogate, so escape("\uD801test") is
// "%F0%90%91%B4est" — the "t" is swallowed into one code point — and a high
// surrogate at the very end is a URIError. encodeURIComponent replaces both with
// U+FFFD instead, and node's tests pin the difference.
var HEX = '0123456789ABCDEF';
function hexOctet(b) {
  return '%' + HEX.charAt((b >> 4) & 0xf) + HEX.charAt(b & 0xf);
}
function isUnescaped(c) {
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) ||
    c === 0x21 || c === 0x27 || c === 0x28 || c === 0x29 || c === 0x2a ||
    c === 0x2d || c === 0x2e || c === 0x5f || c === 0x7e;
}
function escapeAny(v) {
  var str;
  if (typeof v === 'string') str = v;
  else if (typeof v === 'object') str = String(v);
  else str = v + '';
  var out = '';
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) {
      out += isUnescaped(c) ? str.charAt(i) : hexOctet(c);
      continue;
    }
    if (c < 0x800) {
      out += hexOctet(0xc0 | (c >> 6)) + hexOctet(0x80 | (c & 0x3f));
      continue;
    }
    if (c < 0xd800 || c >= 0xe000) {
      out += hexOctet(0xe0 | (c >> 12)) + hexOctet(0x80 | ((c >> 6) & 0x3f)) + hexOctet(0x80 | (c & 0x3f));
      continue;
    }
    i++;
    if (i >= str.length) {
      var e = new URIError('URI malformed');
      e.code = 'ERR_INVALID_URI';
      throw e;
    }
    var cp = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
    out += hexOctet(0xf0 | (cp >> 18)) + hexOctet(0x80 | ((cp >> 12) & 0x3f)) +
           hexOctet(0x80 | ((cp >> 6) & 0x3f)) + hexOctet(0x80 | (cp & 0x3f));
  }
  return out;
}

// node stringifies only the primitives that have an obvious spelling; everything
// else — null, undefined, an object, a symbol — is the EMPTY string, not its
// String() form. `stringify({ a: null })` is "a=", and it was "a=null".
function stringifyPrimitive(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return isFinite(v) ? '' + v : '';
  if (typeof v === 'bigint') return '' + v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '';
}

exports.parse = function (str, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  // A null prototype, because a query string names its own keys: parse
  // ("__proto__=1") has to answer an own __proto__ property, and on an ordinary
  // object that assignment is swallowed by the prototype setter.
  var obj = { __proto__: null };
  if (typeof str !== 'string' || str.length === 0) return obj;

  // node caps the pair count at 1000 unless told otherwise. Only a NUMBER counts
  // as a maxKeys option, and one that is not a positive finite number means "no
  // limit" — NaN, Infinity and -1 all lift the cap rather than setting it.
  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys > 0 && isFinite(options.maxKeys) ? options.maxKeys : Infinity;
  }
  var dec = decode;
  if (options && typeof options.decodeURIComponent === 'function') {
    dec = options.decodeURIComponent;
  }

  var parts = str.split(sep);
  var seen = 0;
  for (var i = 0; i < parts.length; i++) {
    if (seen >= maxKeys) break;
    if (!parts[i]) continue;
    // eq may be MULTI-character, so the value starts past the whole separator
    // and not one character in: parse("a==>1", "&", "==>") answered "=>1".
    var idx = parts[i].indexOf(eq);
    var k, v;
    if (idx < 0) { k = dec(parts[i]); v = ''; }
    else { k = dec(parts[i].slice(0, idx)); v = dec(parts[i].slice(idx + eq.length)); }
    seen++;
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      if (Array.isArray(obj[k])) obj[k].push(v); else obj[k] = [obj[k], v];
    } else { obj[k] = v; }
  }
  return obj;
};

exports.stringify = function (obj, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var enc = encodeComponent;
  if (options && typeof options.encodeURIComponent === 'function') {
    enc = function (v) { return options.encodeURIComponent(stringifyPrimitive(v)); };
  }
  if (!obj || typeof obj !== 'object') return '';
  var pairs = [];
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = obj[k];
    if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) pairs.push(enc(k) + eq + enc(v[j]));
    } else {
      pairs.push(enc(k) + eq + enc(v));
    }
  }
  return pairs.join(sep);
};

exports.escape = escapeAny;
exports.unescape = function (s, decodeSpaces) { return decodeComponent(s, decodeSpaces); };
exports.decode = exports.parse;
exports.encode = exports.stringify;
