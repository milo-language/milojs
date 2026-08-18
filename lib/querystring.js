// node:querystring — enough of the API for express/body-parser.
function decode(s) {
  return decodeComponent(String(s).replace(/\+/g, ' '));
}

function decodeComponent(s) {
  var out = '';
  var i = 0;
  while (i < s.length) {
    var c = s[i];
    if (c === '%' && i + 2 < s.length + 1) {
      var hex = s.substr(i + 1, 2);
      var code = parseInt(hex, 16);
      if (!isNaN(code)) { out += String.fromCharCode(code); i += 3; continue; }
    }
    out += c;
    i += 1;
  }
  return out;
}

// querystring.escape has exactly encodeURIComponent's unescaped set, so it IS
// encodeURIComponent. The hand-rolled version percent-encoded each UTF-16 code
// UNIT rather than the UTF-8 bytes, so "é" came out "%E9" instead of "%C3%A9"
// and an astral character lost its low surrogate entirely ("𝌆" became "%D834").
// Anything non-ASCII round-tripped to mojibake.
function encodeComponent(s) {
  return encodeURIComponent(String(s));
}

exports.parse = function (str, sep, eq) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};
  if (!str) return obj;
  var parts = String(str).split(sep);
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var idx = parts[i].indexOf(eq);
    var k, v;
    if (idx < 0) { k = decode(parts[i]); v = ''; }
    else { k = decode(parts[i].slice(0, idx)); v = decode(parts[i].slice(idx + 1)); }
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      if (Array.isArray(obj[k])) obj[k].push(v); else obj[k] = [obj[k], v];
    } else { obj[k] = v; }
  }
  return obj;
};

exports.stringify = function (obj, sep, eq) {
  sep = sep || '&';
  eq = eq || '=';
  if (!obj || typeof obj !== 'object') return '';
  var pairs = [];
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = obj[k];
    if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) pairs.push(encodeComponent(k) + eq + encodeComponent(v[j]));
    } else {
      pairs.push(encodeComponent(k) + eq + encodeComponent(v));
    }
  }
  return pairs.join(sep);
};

exports.escape = encodeComponent;
exports.unescape = decodeComponent;
exports.decode = exports.parse;
exports.encode = exports.stringify;
