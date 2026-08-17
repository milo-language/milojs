// node:punycode — the RFC 3492 encoding, kept because it is a core module name
// the ecosystem probes for and it is small enough to implement honestly rather
// than stub.
var BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;
var DELIMITER = "-";

function adapt(delta, numPoints, firstTime) {
  delta = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  var k = 0;
  while (delta > ((BASE - TMIN) * TMAX) >> 1) { delta = Math.floor(delta / (BASE - TMIN)); k += BASE; }
  return k + Math.floor(((BASE - TMIN + 1) * delta) / (delta + SKEW));
}
function digitToBasic(digit) { return digit + 22 + (digit < 26 ? 75 : 0); }
function basicToDigit(cp) {
  if (cp >= 48 && cp < 58) return cp - 22;
  if (cp >= 65 && cp < 91) return cp - 65;
  if (cp >= 97 && cp < 123) return cp - 97;
  return BASE;
}
function ucs2decode(str) {
  var out = [];
  for (var i = 0; i < str.length; ) {
    var c = str.codePointAt(i);
    out.push(c);
    i += c > 0xffff ? 2 : 1;
  }
  return out;
}
function encode(input) {
  var output = [], cps = ucs2decode(String(input));
  var n = INITIAL_N, delta = 0, bias = INITIAL_BIAS, basicLength = 0;
  for (var i = 0; i < cps.length; i++) if (cps[i] < 0x80) { output.push(String.fromCharCode(cps[i])); basicLength++; }
  var handled = basicLength;
  if (basicLength) output.push(DELIMITER);
  while (handled < cps.length) {
    var m = 0x7fffffff;
    for (var j = 0; j < cps.length; j++) if (cps[j] >= n && cps[j] < m) m = cps[j];
    delta += (m - n) * (handled + 1);
    n = m;
    for (var k2 = 0; k2 < cps.length; k2++) {
      var cp = cps[k2];
      if (cp < n) delta++;
      if (cp === n) {
        var q = delta, base = BASE;
        for (;;) {
          var t = base <= bias ? TMIN : (base >= bias + TMAX ? TMAX : base - bias);
          if (q < t) break;
          output.push(String.fromCharCode(digitToBasic(t + ((q - t) % (BASE - t)))));
          q = Math.floor((q - t) / (BASE - t));
          base += BASE;
        }
        output.push(String.fromCharCode(digitToBasic(q)));
        bias = adapt(delta, handled + 1, handled === basicLength);
        delta = 0;
        handled++;
      }
    }
    delta++; n++;
  }
  return output.join("");
}
function decode(input) {
  var s = String(input), output = [];
  var basic = s.lastIndexOf(DELIMITER);
  if (basic < 0) basic = 0;
  for (var j = 0; j < basic; j++) output.push(s.charCodeAt(j));
  var n = INITIAL_N, bias = INITIAL_BIAS, i = 0;
  for (var idx = basic > 0 ? basic + 1 : 0; idx < s.length; ) {
    var oldi = i, w = 1, base = BASE;
    for (;;) {
      var digit = basicToDigit(s.charCodeAt(idx++));
      if (digit >= BASE) throw new RangeError("Invalid input");
      i += digit * w;
      var t = base <= bias ? TMIN : (base >= bias + TMAX ? TMAX : base - bias);
      if (digit < t) break;
      w *= BASE - t;
      base += BASE;
    }
    bias = adapt(i - oldi, output.length + 1, oldi === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;
    output.splice(i++, 0, n);
  }
  var out = "";
  for (var q2 = 0; q2 < output.length; q2++) out += String.fromCodePoint(output[q2]);
  return out;
}
function toASCII(domain) {
  return String(domain).split(".").map(function (part) {
    return /[^\0-\x7F]/.test(part) ? "xn--" + encode(part) : part;
  }).join(".");
}
function toUnicode(domain) {
  return String(domain).split(".").map(function (part) {
    return part.slice(0, 4) === "xn--" ? decode(part.slice(4)) : part;
  }).join(".");
}
module.exports = {
  encode: encode, decode: decode, toASCII: toASCII, toUnicode: toUnicode,
  ucs2: { decode: ucs2decode, encode: function (cps) { var o = ""; for (var i = 0; i < cps.length; i++) o += String.fromCodePoint(cps[i]); return o; } },
  version: "2.3.1",
};
