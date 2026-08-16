// Globals that are simpler to express in JS than to build out of natives.
// Evaluated in global scope before the entry module, so everything declared here
// with `var`/`function` becomes a global binding.

// --- Intl ------------------------------------------------------------------
// A deliberately minimal, locale-ignoring stub. Packages reach for Intl to
// pretty-print numbers and dates; nothing in the target depends on real
// locale data, so formatting falls back to the plain conversions.
var Intl = {
  NumberFormat: function NumberFormat(locale, options) {
    if (!(this instanceof NumberFormat)) return new NumberFormat(locale, options);
    this.locale = locale;
    this.options = options || {};
    this.format = function (n) {
      var num = Number(n);
      var opts = this.options;
      if (opts && typeof opts.minimumFractionDigits === 'number') {
        return num.toFixed(opts.minimumFractionDigits);
      }
      return String(num);
    };
    // one integer part is enough for code that reassembles the number from parts
    this.formatToParts = function (n) {
      return [{ type: 'integer', value: this.format(n) }];
    };
    this.resolvedOptions = function () { return { locale: this.locale || 'en-US' }; };
  },
  DateTimeFormat: function DateTimeFormat(locale, options) {
    if (!(this instanceof DateTimeFormat)) return new DateTimeFormat(locale, options);
    this.locale = locale;
    this.options = options || {};
    this.format = function (d) {
      var date = (d instanceof Date) ? d : new Date(d);
      return date.toISOString();
    };
    this.formatToParts = function (d) {
      return [{ type: 'literal', value: this.format(d) }];
    };
    this.resolvedOptions = function () {
      return { locale: this.locale || 'en-US', timeZone: 'UTC' };
    };
  },
  Collator: function Collator() {
    if (!(this instanceof Collator)) return new Collator();
    this.compare = function (a, b) {
      var x = String(a), y = String(b);
      if (x < y) return -1;
      if (x > y) return 1;
      return 0;
    };
  }
};

// --- Date.UTC ---------------------------------------------------------------
// Milliseconds since the epoch for a UTC calendar date. Uses Howard Hinnant's
// days-from-civil algorithm so there is no dependence on a native UTC primitive.
Date.UTC = function (y, m, d, h, mi, s, ms) {
  var month = (m || 0) + 1; // JS months are 0-based; the algorithm wants 1-based
  var day = d === undefined ? 1 : d;
  var yy = y - (month <= 2 ? 1 : 0);
  var era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  var yoe = yy - era * 400;
  var doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  var days = era * 146097 + doe - 719468;
  return ((days * 24 + (h || 0)) * 60 + (mi || 0)) * 60 * 1000 + (s || 0) * 1000 + (ms || 0);
};

// --- Promise combinators ---------------------------------------------------
// Written in JS on top of .then now that reactions are real. The native
// versions read promiseState at call time, so a pending element resolved as
// undefined; these wait properly.
Promise.all = function (items) {
  return new Promise(function (resolve, reject) {
    var list = [];
    for (var i = 0; i < items.length; i++) list.push(items[i]);
    var out = [];
    var remaining = list.length;
    if (remaining === 0) { resolve(out); return; }
    for (var j = 0; j < list.length; j++) {
      (function (idx) {
        Promise.resolve(list[idx]).then(function (v) {
          out[idx] = v;
          remaining -= 1;
          if (remaining === 0) resolve(out);
        }, reject);
      })(j);
    }
  });
};

Promise.allSettled = function (items) {
  return new Promise(function (resolve) {
    var list = [];
    for (var i = 0; i < items.length; i++) list.push(items[i]);
    var out = [];
    var remaining = list.length;
    if (remaining === 0) { resolve(out); return; }
    for (var j = 0; j < list.length; j++) {
      (function (idx) {
        Promise.resolve(list[idx]).then(function (v) {
          out[idx] = { status: 'fulfilled', value: v };
          remaining -= 1;
          if (remaining === 0) resolve(out);
        }, function (e) {
          out[idx] = { status: 'rejected', reason: e };
          remaining -= 1;
          if (remaining === 0) resolve(out);
        });
      })(j);
    }
  });
};

Promise.race = function (items) {
  return new Promise(function (resolve, reject) {
    for (var i = 0; i < items.length; i++) {
      Promise.resolve(items[i]).then(resolve, reject);
    }
  });
};

// AggregateError: real error subclass carrying the list of failures on .errors.
// Promise.any rejects with one; some concurrency libs construct it directly.
function AggregateError(errors, message) {
  var e = new Error(message);
  Object.setPrototypeOf(e, AggregateError.prototype);
  e.name = 'AggregateError';
  e.errors = Array.from(errors || []);
  return e;
}
AggregateError.prototype = Object.create(Error.prototype);
AggregateError.prototype.constructor = AggregateError;
AggregateError.prototype.name = 'AggregateError';

Promise.any = function (items) {
  return new Promise(function (resolve, reject) {
    var remaining = items.length;
    var errors = [];
    if (remaining === 0) { reject(new AggregateError([], 'All promises were rejected')); return; }
    for (let i = 0; i < items.length; i++) {
      errors.push(undefined);
      Promise.resolve(items[i]).then(resolve, function (e) {
        errors[i] = e;
        remaining -= 1;
        if (remaining === 0) reject(new AggregateError(errors, 'All promises were rejected'));
      });
    }
  });
};

// --- Error.captureStackTrace and V8 structured stack traces ------------------
// express, depd and debug call captureStackTrace, but the case that MATTERS is
// `bindings` (the loader under better-sqlite3 and most native addons), which
// discovers its caller's filename like this:
//
//     Error.prepareStackTrace = function (_, stack) { return stack[0].getFileName(); };
//     var dummy = {}; Error.captureStackTrace(dummy); var file = dummy.stack;
//
// Recording an empty trace made `file` undefined and the next line threw on
// `fileName.indexOf('file://')`. The frames come from __callFrames(), the module
// paths currently executing, innermost first.
function __makeCallSite(file, isTop) {
  return {
    getFileName: function () { return file; },
    getScriptNameOrSourceURL: function () { return file; },
    getFunctionName: function () { return null; },
    getMethodName: function () { return null; },
    getTypeName: function () { return null; },
    // milojs does not record positions per frame yet; node's own callers treat
    // these as advisory, and reporting 0 is honest where guessing is not
    getLineNumber: function () { return 0; },
    getColumnNumber: function () { return 0; },
    getThis: function () { return undefined; },
    getEvalOrigin: function () { return undefined; },
    isToplevel: function () { return !!isTop; },
    isEval: function () { return false; },
    isNative: function () { return false; },
    isConstructor: function () { return false; },
    isAsync: function () { return false; },
    isPromiseAll: function () { return false; },
    toString: function () { return file + ':0:0'; }
  };
}

function __callSites() {
  var files = typeof __callFrames === 'function' ? __callFrames() : [];
  // captureStackTrace and this helper are themselves frames. node excludes the
  // capture frame, and a caller that walks looking for "the first file that is
  // not mine" (which is exactly what bindings does) is thrown off by them, so
  // drop the shim's own frames off the front.
  var start = 0;
  while (start < files.length && files[start] === 'builtin:prelude') start++;
  var sites = [];
  var limit = typeof Error.stackTraceLimit === 'number' ? Error.stackTraceLimit : 10;
  for (var i = start; i < files.length && (i - start) < limit; i++) {
    sites.push(__makeCallSite(files[i], i === files.length - 1));
  }
  return sites;
}

Error.captureStackTrace = function captureStackTrace(target, ctor) {
  if (!target || typeof target !== 'object') return undefined;
  var sites = __callSites();
  if (typeof Error.prepareStackTrace === 'function') {
    target.stack = Error.prepareStackTrace(target, sites);
  } else {
    var head = (target.name ? target.name : 'Error');
    if (target.message) head += ': ' + target.message;
    var out = head;
    for (var i = 0; i < sites.length; i++) out += '\n    at ' + sites[i].toString();
    target.stack = out;
  }
  return undefined;
};
Error.prepareStackTrace = undefined;
Error.stackTraceLimit = 10;

// BigInt is now a real arbitrary-precision engine primitive (JSValue.BigInt +
// bigint.milo), registered natively — no JS shim. The old double-backed stub
// (lossy past 2^53) is gone.

// --- typed arrays ------------------------------------------------------------
// Deliberately EMPTY. ArrayBuffer, the nine typed arrays and DataView used to be
// redefined here as plain JS arrays with an `_isTypedArray` marker, which
// shadowed the engine's real ones and made the runtime strictly worse than
// milojs-engine: element writes were not coerced (`u8[0] = 300` stayed 300),
// `Object.getPrototypeOf(u8) !== Uint8Array.prototype`, the type tag read
// `[object Array]`, `DataView` had no setUint16/setUint32, and
// `ArrayBuffer.prototype.slice` did not exist. The engine grew real
// `%TypedArray%` prototypes and byte-backed buffers on 2026-08-15; the shim is
// the thing that has to go, not be extended.

// TextEncoder/TextDecoder are host APIs the engine does not provide, so they do
// live here — but over the engine's real Uint8Array, and doing real UTF-8. The
// previous pair truncated each char code to a byte, so "héllo" encoded to five
// latin-1 bytes instead of six UTF-8 ones and decoded back to mojibake.
function TextEncoder() { if (!(this instanceof TextEncoder)) return new TextEncoder(); }
Object.defineProperty(TextEncoder.prototype, 'encoding', { get: function () { return 'utf-8'; } });
TextEncoder.prototype.encode = function (s) {
  var str = String(s === undefined ? '' : s);
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    // a surrogate pair is one code point; a lone surrogate becomes U+FFFD
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00); i++; }
      else c = 0xfffd;
    } else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
    else if (c < 0x10000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
  }
  return new Uint8Array(out);
};

function TextDecoder(label) { if (!(this instanceof TextDecoder)) return new TextDecoder(label); this.encoding = label || 'utf-8'; }
TextDecoder.prototype.decode = function (bytes) {
  if (bytes === undefined || bytes === null) return '';
  var b = bytes;
  if (b instanceof ArrayBuffer) b = new Uint8Array(b);
  else if (b.buffer instanceof ArrayBuffer && b.BYTES_PER_ELEMENT !== 1) b = new Uint8Array(b.buffer);
  var out = '';
  var i = 0;
  while (i < b.length) {
    var c = b[i] & 0xff, n = 0;
    if (c < 0x80) { n = 0; }
    else if ((c & 0xe0) === 0xc0) { c &= 0x1f; n = 1; }
    else if ((c & 0xf0) === 0xe0) { c &= 0x0f; n = 2; }
    else if ((c & 0xf8) === 0xf0) { c &= 0x07; n = 3; }
    else { out += '\ufffd'; i++; continue; }
    if (i + n >= b.length) { out += '\ufffd'; break; }
    for (var k = 1; k <= n; k++) c = (c << 6) | (b[i + k] & 0x3f);
    i += n + 1;
    if (c > 0xffff) { c -= 0x10000; out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff)); }
    else out += String.fromCharCode(c);
  }
  return out;
};

// --- Buffer -----------------------------------------------------------------
// Node exposes Buffer as a global, not only via require('buffer'). express and
// body-parser both reach for it directly.
var Buffer = require('buffer').Buffer;

// --- globalThis ------------------------------------------------------------
// Deliberately NOT redefined here. This used to be a hand-written object listing
// about twenty well-known globals, which SHADOWED the engine's real one: the
// engine resolves a property of globalThis through the global scope, so it sees
// everything, while the whitelist made `globalThis.Symbol`, `globalThis.Reflect`,
// `globalThis.Proxy` and every typed array read as undefined. Feature detection
// is written that way constantly, so the shim reported the runtime as less
// capable than the engine it runs on.
var global = globalThis;

// --- structuredClone -------------------------------------------------------
function structuredClone(v) {
  return JSON.parse(JSON.stringify(v));
}

// --- global fetch (Node 18+ / undici surface) ------------------------------
// Backed by the __httpFetch native (synchronous connect+TLS+request/response in
// Milo). node-fetch re-exports these. Enough of the surface for the app's data
// layer: fetch(url, {method,headers,body}) -> Response with ok/status/json/text.
function Headers(init) {
  this._h = {};
  if (init) {
    if (typeof init.forEach === 'function' && !Array.isArray(init)) {
      var self = this;
      init.forEach(function (v, k) { self._h[String(k).toLowerCase()] = v; });
    } else if (Array.isArray(init)) {
      for (var i = 0; i < init.length; i++) this._h[String(init[i][0]).toLowerCase()] = init[i][1];
    } else {
      var keys = Object.keys(init);
      for (var j = 0; j < keys.length; j++) this._h[keys[j].toLowerCase()] = init[keys[j]];
    }
  }
}
Headers.prototype.get = function (k) { var v = this._h[String(k).toLowerCase()]; return v === undefined ? null : v; };
Headers.prototype.set = function (k, v) { this._h[String(k).toLowerCase()] = v; return this; };
Headers.prototype.has = function (k) { return this._h[String(k).toLowerCase()] !== undefined; };
Headers.prototype.delete = function (k) { delete this._h[String(k).toLowerCase()]; };
Headers.prototype.forEach = function (cb) {
  var keys = Object.keys(this._h);
  for (var i = 0; i < keys.length; i++) cb(this._h[keys[i]], keys[i], this);
};
Headers.prototype.entries = function () {
  var out = [], keys = Object.keys(this._h);
  for (var i = 0; i < keys.length; i++) out.push([keys[i], this._h[keys[i]]]);
  return out;
};

function Request(url, options) { this.url = url; this.options = options || {}; }

function Response(body, init) {
  init = init || {};
  this._body = body == null ? '' : String(body);
  this.status = init.status === undefined ? 200 : init.status;
  this.statusText = init.statusText || '';
  this.ok = this.status >= 200 && this.status < 300;
  this.headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers || {});
  this.url = init.url || '';
  this.bodyUsed = false;
}
Response.prototype.text = function () { this.bodyUsed = true; return Promise.resolve(this._body); };
Response.prototype.json = function () {
  var b = this._body;
  return new Promise(function (resolve, reject) {
    try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
  });
};
Response.prototype.clone = function () {
  return new Response(this._body, { status: this.status, statusText: this.statusText, headers: this.headers, url: this.url });
};

// AbortController/AbortSignal — accepted and ignored (fetch is synchronous here,
// so a request can't actually be aborted mid-flight; the surface just has to exist)
function AbortController() {
  this.signal = { aborted: false, addEventListener: function () {}, removeEventListener: function () {}, onabort: null };
}
AbortController.prototype.abort = function () { this.signal.aborted = true; };
var AbortSignal = {
  timeout: function () { return { aborted: false, addEventListener: function () {}, removeEventListener: function () {} }; },
  abort: function () { return { aborted: true, addEventListener: function () {}, removeEventListener: function () {} }; }
};

function __fetchDechunk(body) {
  var out = '', pos = 0;
  while (pos < body.length) {
    var nl = body.indexOf('\r\n', pos);
    if (nl < 0) break;
    var size = parseInt(body.slice(pos, nl).split(';')[0].trim(), 16);
    if (isNaN(size) || size === 0) break;
    var start = nl + 2;
    out += body.slice(start, start + size);
    pos = start + size + 2;
  }
  return out;
}

function __fetchParse(raw, url) {
  var sep = raw.indexOf('\r\n\r\n');
  var headPart = sep < 0 ? raw : raw.slice(0, sep);
  var body = sep < 0 ? '' : raw.slice(sep + 4);
  var lines = headPart.split('\r\n');
  var sp = (lines[0] || 'HTTP/1.1 200 OK').split(' ');
  var status = parseInt(sp[1], 10) || 200;
  var headers = new Headers();
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var c = line.indexOf(':');
    if (c < 0) continue;
    headers.set(line.slice(0, c).trim(), line.slice(c + 1).trim());
  }
  if (String(headers.get('transfer-encoding') || '').toLowerCase().indexOf('chunked') >= 0) body = __fetchDechunk(body);
  return new Response(body, { status: status, statusText: sp.slice(2).join(' '), headers: headers, url: url });
}

function fetch(url, options) {
  options = options || {};
  var method = (options.method || 'GET').toUpperCase();
  var u = typeof url === 'string' ? url : (url && url.url) || String(url);
  var hdrs = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      var es = options.headers.entries();
      for (var i = 0; i < es.length; i++) hdrs[es[i][0]] = es[i][1];
    } else {
      var ks = Object.keys(options.headers);
      for (var j = 0; j < ks.length; j++) hdrs[ks[j].toLowerCase()] = options.headers[ks[j]];
    }
  }
  if (hdrs['accept'] === undefined) hdrs['accept'] = '*/*';
  hdrs['accept-encoding'] = 'identity';
  if (hdrs['user-agent'] === undefined) hdrs['user-agent'] = 'milojs-fetch/1.0';
  var body = '';
  if (options.body != null) {
    body = typeof options.body === 'string' ? options.body : (options.body && options.body.bytes ? options.body.toString() : JSON.stringify(options.body));
    if (hdrs['content-type'] === undefined && typeof options.body !== 'string') hdrs['content-type'] = 'application/json';
  }
  var headerRaw = '', hk = Object.keys(hdrs);
  for (var k = 0; k < hk.length; k++) headerRaw += hk[k] + ': ' + hdrs[hk[k]] + '\r\n';
  // The request runs on a worker OS thread (TLS included) and the event loop
  // settles this promise when the response lands, so timers keep firing and
  // concurrent requests overlap.
  return __httpFetchAsync(method, u, headerRaw, body).then(function (res) {
    if (res.length > 0 && res.charAt(0) === 'E') {
      throw new Error('fetch failed: ' + res.slice(1) + ' (' + u + ')');
    }
    return __fetchParse(res.length > 0 ? res.slice(1) : '', u);
  });
}

// make Headers for-of iterable ([[k,v],...]) — the node-http adapter does
// `for (const [k,v] of response.headers)`
Headers.prototype[Symbol.iterator] = function () { return this.entries()[Symbol.iterator](); };
Headers.prototype.keys = function () { return Object.keys(this._h)[Symbol.iterator](); };

// --- URLSearchParams / URL (WHATWG) ----------------------------------------
function URLSearchParams(init) {
  this._p = [];
  if (typeof init === 'string') {
    var s = init.charAt(0) === '?' ? init.slice(1) : init;
    if (s.length > 0) {
      var parts = s.split('&');
      for (var i = 0; i < parts.length; i++) {
        var eq = parts[i].indexOf('=');
        var k = eq < 0 ? parts[i] : parts[i].slice(0, eq);
        var v = eq < 0 ? '' : parts[i].slice(eq + 1);
        this._p.push([decodeURIComponent(k.split('+').join(' ')), decodeURIComponent(v.split('+').join(' '))]);
      }
    }
  } else if (init && typeof init === 'object') {
    var ks = Object.keys(init);
    for (var j = 0; j < ks.length; j++) this._p.push([ks[j], String(init[ks[j]])]);
  }
}
URLSearchParams.prototype.get = function (k) { for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === k) return this._p[i][1]; return null; };
URLSearchParams.prototype.getAll = function (k) { var o = []; for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === k) o.push(this._p[i][1]); return o; };
URLSearchParams.prototype.has = function (k) { return this.get(k) !== null; };
URLSearchParams.prototype.set = function (k, v) { for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === k) { this._p[i][1] = String(v); return; } this._p.push([k, String(v)]); };
URLSearchParams.prototype.append = function (k, v) { this._p.push([k, String(v)]); };
URLSearchParams.prototype.forEach = function (cb) { for (var i = 0; i < this._p.length; i++) cb(this._p[i][1], this._p[i][0], this); };
URLSearchParams.prototype.entries = function () { return this._p.slice(); };
URLSearchParams.prototype.toString = function () {
  var o = [];
  for (var i = 0; i < this._p.length; i++) o.push(encodeURIComponent(this._p[i][0]) + '=' + encodeURIComponent(this._p[i][1]));
  return o.join('&');
};
URLSearchParams.prototype[Symbol.iterator] = function () { return this._p.slice()[Symbol.iterator](); };

function URL(url, base) {
  var href = String(url);
  if (base && href.indexOf('://') < 0) {
    var b = String(base);
    href = b.replace(/\/+$/, '') + (href.charAt(0) === '/' ? '' : '/') + href;
  }
  var m = href.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)\/\/([^\/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) throw new TypeError('Invalid URL: ' + href);
  this.protocol = m[1];
  var authority = m[2];
  var at = authority.indexOf('@');
  this.username = '';
  this.password = '';
  if (at >= 0) {
    var userinfo = authority.slice(0, at);
    var uc = userinfo.indexOf(':');
    this.username = uc < 0 ? userinfo : userinfo.slice(0, uc);
    this.password = uc < 0 ? '' : userinfo.slice(uc + 1);
    authority = authority.slice(at + 1);
  }
  var colon = authority.indexOf(':');
  this.hostname = colon < 0 ? authority : authority.slice(0, colon);
  this.port = colon < 0 ? '' : authority.slice(colon + 1);
  this.host = authority;
  this.pathname = m[3] || '/';
  this.search = m[4] || '';
  this.hash = m[5] || '';
  this.searchParams = new URLSearchParams(this.search);
  this.origin = this.protocol + '//' + this.host;
  this.href = href;
}
URL.prototype.toString = function () { return this.href; };

// --- ReadableStream ---------------------------------------------------------
// Enough for the trpc node-http adapter: a pull/push queue with getReader().
// A read() before data arrives returns a pending promise that enqueue()/close()
// settle — which the in-place event-loop drain on await resolves.
function ReadableStream(source) {
  var self = this;
  this._chunks = [];
  this._closed = false;
  this._err = null;
  this._waiters = [];
  var controller = {
    enqueue: function (chunk) {
      if (self._waiters.length > 0) self._waiters.shift().resolve({ value: chunk, done: false });
      else self._chunks.push(chunk);
    },
    close: function () {
      self._closed = true;
      while (self._waiters.length > 0) self._waiters.shift().resolve({ value: undefined, done: true });
    },
    error: function (e) {
      self._err = e;
      while (self._waiters.length > 0) self._waiters.shift().reject(e);
    },
    get desiredSize() { return 1; }
  };
  this._controller = controller;
  if (source && typeof source.start === 'function') {
    try { source.start(controller); } catch (e) { controller.error(e); }
  }
}
ReadableStream.prototype.getReader = function () {
  var self = this;
  return {
    read: function () {
      return new Promise(function (resolve, reject) {
        if (self._err) { reject(self._err); return; }
        if (self._chunks.length > 0) { resolve({ value: self._chunks.shift(), done: false }); return; }
        if (self._closed) { resolve({ value: undefined, done: true }); return; }
        self._waiters.push({ resolve: resolve, reject: reject });
      });
    },
    releaseLock: function () {},
    cancel: function () { self._closed = true; return Promise.resolve(); }
  };
};
ReadableStream.prototype.cancel = function () { this._closed = true; return Promise.resolve(); };
// collect the whole stream into one string — used by Request/Response body accessors
function __streamToString(stream) {
  var reader = stream.getReader();
  var acc = '';
  function step() {
    return reader.read().then(function (r) {
      if (r.done) return acc;
      acc += (r.value && r.value.bytes && typeof r.value.toString === 'function') ? r.value.toString() : String(r.value);
      return step();
    });
  }
  return step();
}

// --- upgrade Request/Response to the streaming WHATWG surface ---------------
function Request(input, init) {
  init = init || {};
  this.url = (input && input.href) ? input.href : String(input);
  this.method = (init.method || (input && input.method) || 'GET').toUpperCase();
  this.headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers || (input && input.headers) || {});
  this._bodyInit = init.body !== undefined ? init.body : (input && input._bodyInit);
  this.signal = init.signal || { aborted: false, addEventListener: function () {}, removeEventListener: function () {} };
  this.bodyUsed = false;
}
Object.defineProperty(Request.prototype, 'body', {
  get: function () {
    var b = this._bodyInit;
    if (b == null) return null;
    if (b instanceof ReadableStream) return b;
    return new ReadableStream({ start: function (c) { c.enqueue(String(b)); c.close(); } });
  }
});
Request.prototype.text = function () {
  var b = this._bodyInit;
  this.bodyUsed = true;
  if (b instanceof ReadableStream) return __streamToString(b);
  return Promise.resolve(b == null ? '' : String(b));
};
Request.prototype.json = function () { return this.text().then(function (t) { return JSON.parse(t); }); };
Request.prototype.clone = function () { var r = new Request(this.url, { method: this.method, headers: this.headers, body: this._bodyInit }); return r; };

// Response gains a streaming body (the adapter reads response.body.getReader())
Response.prototype.json = function () {
  var self = this;
  return this.text().then(function (t) { return JSON.parse(t); });
};
Response.prototype.text = function () {
  this.bodyUsed = true;
  if (this._body instanceof ReadableStream) return __streamToString(this._body);
  return Promise.resolve(this._body == null ? '' : String(this._body));
};
Object.defineProperty(Response.prototype, 'body', {
  get: function () {
    if (this._body == null) return null;
    if (this._body instanceof ReadableStream) return this._body;
    var b = this._body;
    return new ReadableStream({ start: function (c) { c.enqueue(String(b)); c.close(); } });
  }
});
Response.json = function (data, init) {
  init = init || {};
  var h = new Headers(init.headers || {});
  if (!h.has('content-type')) h.set('content-type', 'application/json');
  return new Response(JSON.stringify(data), { status: init.status || 200, statusText: init.statusText, headers: h });
};

// atob/btoa: web globals node also exposes. prisma's runtime decodes its
// embedded schema with them.
function atob(data) {
  return require("buffer").Buffer.from(String(data), "base64").toString("binary");
}

function btoa(data) {
  return require("buffer").Buffer.from(String(data), "binary").toString("base64");
}

// process.dlopen(module, path, flags): how node loads a .node addon. prisma's
// query-engine loader calls it directly rather than going through require.
process.dlopen = function (mod, filename, _flags) {
  mod.exports = __napiLoad(filename);
  return mod.exports;
};

// process.hrtime: the native only stubbed [0,0]. Back it with Date.now (so
// only millisecond resolution, but monotonic-forward and correctly typed).
// process.hrtime.bigint() returns nanoseconds as a real BigInt — perf-timing
// libs read it and `typeof` / comparisons against `0n` must hold.
(function () {
  var now = Date.now;
  process.hrtime = function (prev) {
    var ms = now();
    var s = Math.floor(ms / 1000);
    var ns = Math.floor((ms - s * 1000) * 1e6);
    if (prev) {
      var ds = s - prev[0];
      var dn = ns - prev[1];
      if (dn < 0) { ds -= 1; dn += 1e9; }
      return [ds, dn];
    }
    return [s, ns];
  };
  process.hrtime.bigint = function () {
    return BigInt(now()) * 1000000n;
  };
})();

// Not shared memory — milojs is single-threaded — but the global has to exist:
// `x instanceof SharedArrayBuffer` is a common way to test for a binary buffer
// (prisma does it next to the ArrayBuffer check), and an undefined identifier
// there is a ReferenceError that aborts the whole call.
function SharedArrayBuffer(length) {
  return new ArrayBuffer(length);
}

// Promise.resolve adopts any thenable, not just promises this engine created.
// Every combinator below is written on top of it, so this is the one place
// adoption has to happen — prisma's query builders are plain objects with a
// .then, and without this Promise.all resolved with the builders themselves.
Promise.resolve = function (x) {
  if (x !== null && (typeof x === 'object' || typeof x === 'function') && typeof x.then === 'function') {
    return new Promise(function (res, rej) { x.then(res, rej); });
  }
  return __promiseResolveValue(x);
};

// Promise.withResolvers() (ES2024): a promise plus its resolve/reject exposed.
Promise.withResolvers = function () {
  var resolve, reject;
  var promise = new Promise(function (res, rej) { resolve = res; reject = rej; });
  return { promise: promise, resolve: resolve, reject: reject };
};

// --- ES2024 grouping ---------------------------------------------------------
// Object.groupBy / Map.groupBy. The callback's return value is the key: for
// Object.groupBy it is coerced to a property key, for Map.groupBy it is used as
// a Map key with SameValueZero, so 0 and -0 land together but objects do not.
Object.groupBy = function groupBy(items, callback) {
  var out = {};
  var i = 0;
  for (var it of items) {
    var k = String(callback(it, i));
    if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = [];
    out[k].push(it);
    i++;
  }
  return out;
};

Map.groupBy = function groupBy(items, callback) {
  var out = new Map();
  var i = 0;
  for (var it of items) {
    var k = callback(it, i);
    var bucket = out.get(k);
    if (bucket === undefined && !out.has(k)) { bucket = []; out.set(k, bucket); }
    bucket.push(it);
    i++;
  }
  return out;
};

// isWellFormed/toWellFormed are NOT added here. Assigning to String.prototype
// marks it as touched, which turns off the by-name string dispatch, and methods
// that live only on that path (normalize, localeCompare) then vanish. They are
// implemented in stringMethod instead.

// --- %TypedArray%.of / .from -------------------------------------------------
// Statics on each concrete constructor. `from` takes an iterable or array-like
// plus an optional map function, like Array.from.
(function () {
  var kinds = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
               Int32Array, Uint32Array, Float32Array, Float64Array];
  for (var i = 0; i < kinds.length; i++) {
    var K = kinds[i];
    if (!K) continue;
    (function (Ctor) {
      Ctor.of = function of() {
        var out = new Ctor(arguments.length);
        for (var j = 0; j < arguments.length; j++) out[j] = arguments[j];
        return out;
      };
      Ctor.from = function from(src, mapFn, thisArg) {
        // Spread first, and only fall back to an indexed read: a Set's
        // Symbol.iterator is not readable as a PROPERTY here even though the
        // object is perfectly iterable, so probing for it skipped every
        // iterable that is not an array.
        var vals = [];
        var spread = null;
        try { spread = [...src]; } catch (e) { spread = null; }
        if (spread !== null && spread.length > 0) {
          vals = spread;
        } else if (src && typeof src.length === "number") {
          for (var k = 0; k < src.length; k++) vals.push(src[k]);
        }
        var out = new Ctor(vals.length);
        for (var m = 0; m < vals.length; m++) {
          out[m] = mapFn ? mapFn.call(thisArg, vals[m], m) : vals[m];
        }
        return out;
      };
    })(K);
  }
})();
