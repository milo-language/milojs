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

// DOM Event / EventTarget. Not decoration: AbortSignal, MessagePort,
// FileReader and node's own process-level events are all specified in terms of
// them, and node's tests construct EventTarget subclasses directly. Written
// without capture/bubble phases because there is no tree here to propagate
// through — every dispatch is AT_TARGET — but the listener bookkeeping
// (once, signal, passive, duplicate suppression, handleEvent objects) is the
// part programs actually observe, and that is exact.
function Event(type, options) {
  if (arguments.length === 0) {
    throw new TypeError("Failed to construct 'Event': 1 argument required, but only 0 present.");
  }
  const o = options || {};
  this.type = String(type);
  this.bubbles = !!o.bubbles;
  this.cancelable = !!o.cancelable;
  this.composed = !!o.composed;
  this.defaultPrevented = false;
  this.target = null;
  this.currentTarget = null;
  this.eventPhase = 0;
  this.isTrusted = false;
  this.timeStamp = 0;
  this._stopped = false;
  this._stoppedImmediate = false;
  this._passive = false;
}
Event.prototype.preventDefault = function () {
  // A passive listener is a promise not to cancel, and the spec makes the call
  // a no-op rather than an error.
  if (this.cancelable && !this._passive) this.defaultPrevented = true;
};
Event.prototype.stopPropagation = function () { this._stopped = true; };
Event.prototype.stopImmediatePropagation = function () {
  this._stopped = true;
  this._stoppedImmediate = true;
};
Event.prototype.composedPath = function () { return this.target ? [this.target] : []; };
Event.NONE = 0;
Event.CAPTURING_PHASE = 1;
Event.AT_TARGET = 2;
Event.BUBBLING_PHASE = 3;
Event.prototype.NONE = 0;
Event.prototype.CAPTURING_PHASE = 1;
Event.prototype.AT_TARGET = 2;
Event.prototype.BUBBLING_PHASE = 3;

function CustomEvent(type, options) {
  Event.call(this, type, options);
  this.detail = options && 'detail' in options ? options.detail : null;
}
CustomEvent.prototype = Object.create(Event.prototype);
CustomEvent.prototype.constructor = CustomEvent;

function EventTarget() {
  // Non-enumerable so an EventTarget subclass does not print its listener
  // bookkeeping in console.log, which is what node's inspect tests compare.
  Object.defineProperty(this, '_evt', { value: [], writable: true, enumerable: false, configurable: true });
}

function __evtList(target) {
  if (!target._evt) {
    Object.defineProperty(target, '_evt', { value: [], writable: true, enumerable: false, configurable: true });
  }
  return target._evt;
}

EventTarget.prototype.addEventListener = function (type, listener, options) {
  if (listener === null || listener === undefined) return;
  if (typeof listener !== 'function' && typeof listener.handleEvent !== 'function') {
    throw new TypeError('The "listener" argument must be an object or function');
  }
  const opts = typeof options === 'boolean' ? { capture: options } : (options || {});
  const capture = !!opts.capture;
  const list = __evtList(this);
  // (type, callback, capture) is the identity the spec dedupes on: registering
  // the same trio twice is a no-op, and the second call's other options are
  // discarded rather than merged.
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === type && list[i].fn === listener && list[i].capture === capture) return;
  }
  const rec = {
    type: String(type), fn: listener, capture: capture,
    once: !!opts.once, passive: !!opts.passive, removed: false,
  };
  list.push(rec);
  // An aborted signal removes the listener; an already-aborted one means it was
  // never really added.
  const signal = opts.signal;
  if (signal) {
    if (signal.aborted) { rec.removed = true; list.pop(); return; }
    const self = this;
    signal.addEventListener('abort', function () {
      rec.removed = true;
      self.removeEventListener(type, listener, { capture: capture });
    }, { once: true });
  }
};

EventTarget.prototype.removeEventListener = function (type, listener, options) {
  const opts = typeof options === 'boolean' ? { capture: options } : (options || {});
  const capture = !!opts.capture;
  const list = __evtList(this);
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === type && list[i].fn === listener && list[i].capture === capture) {
      list[i].removed = true;
      list.splice(i, 1);
      return;
    }
  }
};

EventTarget.prototype.dispatchEvent = function (event) {
  if (!(event instanceof Event)) {
    throw new TypeError('The "event" argument must be an instance of Event');
  }
  event.target = this;
  event.currentTarget = this;
  event.eventPhase = 2;
  // Snapshotted: a listener may add or remove others, and only the set present
  // when dispatch began is invoked.
  const list = __evtList(this).slice();
  for (let i = 0; i < list.length; i++) {
    const rec = list[i];
    if (rec.type !== event.type || rec.removed) continue;
    if (rec.once) this.removeEventListener(rec.type, rec.fn, { capture: rec.capture });
    event._passive = rec.passive;
    if (typeof rec.fn === 'function') rec.fn.call(this, event);
    else rec.fn.handleEvent(event);
    event._passive = false;
    if (event._stoppedImmediate) break;
  }
  event.eventPhase = 0;
  event.currentTarget = null;
  return !event.defaultPrevented;
};

// AbortController/AbortSignal. These used to be inert stubs whose
// addEventListener was an empty function: `signal.aborted` flipped, but the
// 'abort' event NEVER fired and `signal.reason` was never set. Every API built
// on abort therefore hung instead of unwinding — an aborted fetch, an aborted
// events.once(), an aborted timers/promises call all wait forever, which is
// strictly worse than not supporting abort at all.
function AbortSignal() {
  EventTarget.call(this);
  this.aborted = false;
  this.reason = undefined;
  this._onabort = null;
}
// A real EventTarget, so the listener bookkeeping (once, signal, handleEvent
// objects, duplicate suppression) is the same code every other event source
// uses, and `signal instanceof EventTarget` holds where node says it does.
AbortSignal.prototype = Object.create(EventTarget.prototype);
AbortSignal.prototype.constructor = AbortSignal;

// `onabort` is an ordinary listener registered at ASSIGNMENT time, not a
// special case fired first. Node's dispatch order is registration order, so a
// handler added with addEventListener before `signal.onabort = fn` runs first;
// treating onabort as a separate hook got that backwards.
Object.defineProperty(AbortSignal.prototype, 'onabort', {
  configurable: true,
  get: function () { return this._onabort; },
  set: function (fn) {
    if (this._onabort) this.removeEventListener('abort', this._onabort);
    this._onabort = typeof fn === 'function' ? fn : null;
    if (this._onabort) this.addEventListener('abort', this._onabort);
  },
});

AbortSignal.prototype.throwIfAborted = function () {
  if (this.aborted) throw this.reason;
};

function __abortSignalAbort(signal, reason) {
  if (signal.aborted) return;
  signal.aborted = true;
  signal.reason = reason === undefined
    ? new DOMException('This operation was aborted', 'AbortError')
    : reason;
  signal.dispatchEvent(new Event('abort'));
}

// A signal with no controller: the static factories and AbortSignal.any all
// need one they can abort themselves.
function __newAbortSignal() { return new AbortSignal(); }

AbortSignal.abort = function (reason) {
  var s = __newAbortSignal();
  __abortSignalAbort(s, reason);
  return s;
};

AbortSignal.timeout = function (ms) {
  var s = __newAbortSignal();
  var t = setTimeout(function () {
    __abortSignalAbort(s, new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  }, ms);
  // node's timeout signal does not hold the event loop open on its own.
  if (t && typeof t.unref === 'function') t.unref();
  return s;
};

AbortSignal.any = function (signals) {
  var s = __newAbortSignal();
  for (var i = 0; i < signals.length; i++) {
    var src = signals[i];
    if (src.aborted) { __abortSignalAbort(s, src.reason); return s; }
  }
  var forward = function (src) {
    return function () { __abortSignalAbort(s, src.reason); };
  };
  for (var j = 0; j < signals.length; j++) {
    signals[j].addEventListener('abort', forward(signals[j]), { once: true });
  }
  return s;
};

function AbortController() {
  this.signal = new AbortSignal();
}
AbortController.prototype.abort = function (reason) {
  __abortSignalAbort(this.signal, reason);
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
    body = typeof options.body === 'string' ? options.body : (options.body instanceof Uint8Array ? options.body.toString() : JSON.stringify(options.body));
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
  // Web IDL constructors are [[Construct]]-only: `URL("...")` without `new` is a
  // TypeError, not a silent undefined. Written as a function rather than a class
  // so the internal call sites and the prototype wiring below stay as they are.
  if (!new.target) throw new TypeError("Class constructor URLSearchParams cannot be invoked without 'new'");
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
// Web IDL requires the argument COUNT before anything else: a required argument
// that was not passed is ERR_MISSING_ARGS, and node's tests assert that code and
// its exact wording. Every one of these answered undefined instead.
function __spNeedName(n) {
  if (n < 1) {
    var e = new TypeError('The "name" argument must be specified');
    e.code = 'ERR_MISSING_ARGS';
    throw e;
  }
}
function __spNeedNameValue(n) {
  if (n < 2) {
    var e = new TypeError('The "name" and "value" arguments must be specified');
    e.code = 'ERR_MISSING_ARGS';
    throw e;
  }
}
URLSearchParams.prototype.get = function (k) {
  __spBrand(this); __spNeedName(arguments.length);
  // The name is stringified, and that conversion can run user code and throw —
  // which is exactly what the tests hand it.
  var key = String(k);
  for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === key) return this._p[i][1];
  return null;
};
URLSearchParams.prototype.getAll = function (k) {
  __spBrand(this); __spNeedName(arguments.length);
  var key = String(k);
  var o = [];
  for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === key) o.push(this._p[i][1]);
  return o;
};
URLSearchParams.prototype.has = function (k, v) {
  __spBrand(this); __spNeedName(arguments.length);
  var key = String(k);
  if (v === undefined) return this.get(key) !== null;
  var val = String(v);
  for (var i = 0; i < this._p.length; i++) if (this._p[i][0] === key && this._p[i][1] === val) return true;
  return false;
};
URLSearchParams.prototype.set = function (k, v) {
  __spBrand(this); __spNeedNameValue(arguments.length);
  var key = String(k);
  var val = String(v);
  // The first match keeps its position and takes the new value; any further
  // pairs with that name are dropped.
  var seen = false;
  var kept = [];
  for (var i = 0; i < this._p.length; i++) {
    if (this._p[i][0] !== key) { kept.push(this._p[i]); continue; }
    if (seen) continue;
    seen = true;
    kept.push([key, val]);
  }
  if (!seen) kept.push([key, val]);
  this._p = kept;
};
URLSearchParams.prototype.append = function (k, v) {
  __spBrand(this); __spNeedNameValue(arguments.length);
  this._p.push([String(k), String(v)]);
};
URLSearchParams.prototype.forEach = function (cb) { __spBrand(this); for (var i = 0; i < this._p.length; i++) cb(this._p[i][1], this._p[i][0], this); };
// Every method is brand-checked. Web IDL says a method called on the wrong
// receiver is a TypeError with code ERR_INVALID_THIS, and node's tests assert
// that code directly — it was the single largest failure bucket in the whatwg
// area.
function __spBrand(v) {
  if (v === null || typeof v !== 'object' || !Array.isArray(v._p)) {
    var e = new TypeError('Value of "this" must be of type URLSearchParams');
    e.code = 'ERR_INVALID_THIS';
    throw e;
  }
  return v;
}

URLSearchParams.prototype['delete'] = function (k, v) {
  __spBrand(this); __spNeedName(arguments.length);
  var key = String(k);
  var kept = [];
  for (var i = 0; i < this._p.length; i++) {
    // The two-argument form deletes only pairs matching BOTH name and value.
    if (this._p[i][0] === key && (v === undefined || this._p[i][1] === String(v))) continue;
    kept.push(this._p[i]);
  }
  this._p = kept;
};

// Sorted by name only, and stably: the spec keeps the relative order of pairs
// with the same name, so a plain comparator that also ordered on value would be
// wrong. Comparison is on code units, not locale.
URLSearchParams.prototype.sort = function () {
  __spBrand(this);
  var idx = this._p.map(function (pair, i) { return { pair: pair, i: i }; });
  idx.sort(function (a, b) {
    if (a.pair[0] === b.pair[0]) return a.i - b.i;
    return a.pair[0] < b.pair[0] ? -1 : 1;
  });
  this._p = idx.map(function (x) { return x.pair; });
};

// A real iterator, not an array. `sp.entries()` returning a copied array made
// String(sp.entries()) read as its contents where node prints
// "[object URLSearchParams Iterator]", and gave it array methods it must not
// have.
function __spIterator(pairs, pick) {
  var i = 0;
  var it = {
    next: function () {
      if (i >= pairs.length) return { value: undefined, done: true };
      return { value: pick(pairs[i++]), done: false };
    },
  };
  it[Symbol.iterator] = function () { return it; };
  it[Symbol.toStringTag] = 'URLSearchParams Iterator';
  return it;
}

URLSearchParams.prototype.entries = function () {
  __spBrand(this);
  return __spIterator(this._p.slice(), function (p) { return [p[0], p[1]]; });
};
URLSearchParams.prototype.keys = function () {
  __spBrand(this);
  return __spIterator(this._p.slice(), function (p) { return p[0]; });
};
URLSearchParams.prototype.values = function () {
  __spBrand(this);
  return __spIterator(this._p.slice(), function (p) { return p[1]; });
};

Object.defineProperty(URLSearchParams.prototype, 'size', {
  configurable: true,
  get: function () { return __spBrand(this)._p.length; },
});

// application/x-www-form-urlencoded, which is NOT encodeURIComponent: a space
// is "+", and the set of characters left alone differs.
function __formEncode(str) {
  var out = '';
  var s = String(str);
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === ' ') { out += '+'; continue; }
    if (/[A-Za-z0-9*\-._]/.test(c)) { out += c; continue; }
    out += encodeURIComponent(c).split('!').join('%21').split("'").join('%27')
      .split('(').join('%28').split(')').join('%29').split('~').join('%7E');
  }
  return out;
}

URLSearchParams.prototype.toString = function () {
  __spBrand(this);
  var o = [];
  for (var i = 0; i < this._p.length; i++) o.push(__formEncode(this._p[i][0]) + '=' + __formEncode(this._p[i][1]));
  return o.join('&');
};
URLSearchParams.prototype[Symbol.iterator] = function () { return this.entries(); };
URLSearchParams.prototype[Symbol.toStringTag] = 'URLSearchParams';

function URL(url, base) {
  // Web IDL constructors are [[Construct]]-only: `URL("...")` without `new` is a
  // TypeError, not a silent undefined. Written as a function rather than a class
  // so the internal call sites and the prototype wiring below stay as they are.
  if (!new.target) throw new TypeError("Class constructor URL cannot be invoked without 'new'");
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
// JSON.stringify(url) has to produce the href, not "{}" — the WHATWG URL has no
// enumerable own properties worth serialising, so without toJSON it round-trips
// to an empty object.
URL.prototype.toJSON = function () { return this.href; };
URL.prototype[Symbol.toStringTag] = 'URL';

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
      acc += (r.value instanceof Uint8Array && typeof r.value.toString === 'function') ? r.value.toString() : String(r.value);
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

// process.config and process.features: pure metadata that a great deal of code
// branches on before doing anything. Node's test harness reads both at load, so
// their absence blocked every test in the suite. The values describe THIS
// runtime, not node's build: no intl data, no inspector, not a shared library.
if (typeof process.config !== "object" || process.config === null) {
  process.config = {
    target_defaults: { cflags: [], default_configuration: "Release", defines: [], include_dirs: [], libraries: [] },
    variables: {
      asan: 0,
      host_arch: process.arch,
      node_shared: false,
      node_use_ffi: false,
      node_use_openssl: true,
      target_arch: process.arch,
      v8_enable_i18n_support: 0,
      v8_enable_temporal_support: 0,
    },
  };
}
if (typeof process.features !== "object" || process.features === null) {
  process.features = {
    inspector: false,
    debug: false,
    uv: false,
    ipv6: true,
    tls_alpn: true,
    tls_sni: true,
    tls_ocsp: false,
    tls: true,
    cached_builtins: true,
    require_module: true,
    typescript: false,
  };
}

// process events. `process.on` was a no-op ("no process event source to fire
// them"), so process.on('uncaughtException') registered nothing and an uncaught
// error killed the process even when the program had asked to handle it. Node
// does NOT exit when a listener is present, and its own tests rely on that.
(function () {
  var listeners = {};
  function list(name) {
    if (!listeners[name]) listeners[name] = [];
    return listeners[name];
  }
  process.on = process.addListener = function (name, fn) { list(name).push(fn); return process; };
  process.once = function (name, fn) {
    var fired = false;
    function wrapper() {
      if (fired) return undefined;
      fired = true;
      process.removeListener(name, wrapper);
      return fn.apply(this, arguments);
    }
    return process.on(name, wrapper);
  };
  process.removeListener = process.off = function (name, fn) {
    var l = list(name);
    var kept = [];
    for (var i = 0; i < l.length; i++) if (l[i] !== fn) kept.push(l[i]);
    listeners[name] = kept;
    return process;
  };
  process.removeAllListeners = function (name) {
    if (name === undefined) listeners = {}; else listeners[name] = [];
    return process;
  };
  process.listeners = function (name) { return list(name).slice(); };
  process.listenerCount = function (name) { return list(name).length; };
  process.prependListener = function (name, fn) { list(name).unshift(fn); return process; };
  process.emit = function (name) {
    var l = list(name).slice();
    if (l.length === 0) return false;
    var args = [];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    for (var j = 0; j < l.length; j++) l[j].apply(process, args);
    return true;
  };

  // Called from the interpreter's uncaught paths. Returns true when the program
  // handled it, which is the signal to keep running instead of exiting.
  globalThis.__dispatchUncaught = function (err) {
    if (list('uncaughtException').length === 0) return false;
    process.emit('uncaughtException', err, 'uncaughtException');
    return true;
  };
})();

// process.execPath: the absolute path of this binary. argv[0] is only the name
// it was invoked as, so fork() and cluster had nothing to re-run.
if (process.execPath === undefined) {
  try { process.execPath = __exePath(); } catch (e) { process.execPath = process.argv[0]; }
}

// The process members node's own test harness opens with. Each was absent, and
// test/common/index.js calls umask() at load, so ALL of node's tests failed
// before running a line of their own.
if (typeof process.umask !== "function") {
  // There is no syscall behind this: the runtime does not create files through
  // a umask, so setting one changes nothing and the value is remembered only so
  // a caller reading it back sees what it wrote. Node's own test harness sets it
  // to 0 at load, so throwing here would block every test in the suite.
  var __umask = 18;
  process.umask = function umask(mask) {
    var prev = __umask;
    if (mask !== undefined) __umask = Number(mask) | 0;
    return prev;
  };
}
// The POSIX id getters. node exposes them on every platform but Windows, and
// its test harness branches on `process.getuid && process.getuid() === 0` to
// decide whether a root-only case can run — an absent getter reads as "not
// root", which is right, but several tests call them unconditionally.
if (typeof process.getuid !== "function" && process.platform !== "win32") {
  // No syscall behind these: milojs never drops privileges, so the honest
  // answer is a stable non-root id rather than a throw that fails the case for
  // a reason unrelated to what it tests.
  var __uid = 501;
  var __gid = 20;
  process.getuid = function getuid() { return __uid; };
  process.geteuid = function geteuid() { return __uid; };
  process.getgid = function getgid() { return __gid; };
  process.getegid = function getegid() { return __gid; };
  process.getgroups = function getgroups() { return [__gid]; };
}
if (typeof process.memoryUsage !== "function") {
  process.memoryUsage = function memoryUsage() {
    return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 };
  };
  process.memoryUsage.rss = function () { return 0; };
}
// Argument validation on the process natives. These are implemented in Milo and
// took whatever they were handed: process.nextTick(42) queued a non-function
// that blew up a tick later with no hint of where it came from, and
// process.kill("SIGTERM") read a string as a pid. Wrapped here rather than
// reimplemented, so the native keeps doing the work.
//
// The shared helpers come from the same module every other lib/ file uses; a
// second copy of the message formats is how they drift apart.
var __perr = require("_errors");


(function () {
  var origNextTick = process.nextTick;
  if (typeof origNextTick === "function") {
    process.nextTick = function nextTick(callback) {
      if (typeof callback !== "function") {
        throw __perr.ERR_INVALID_ARG_TYPE("callback", "of type function", callback);
      }
      // node passes the trailing arguments through to the callback. The native
      // under this took only the function and called it with nothing, so
      // `process.nextTick(cb, err)` — the shape every stream and every
      // node-style callback uses to report failure asynchronously — delivered
      // undefined, and the error vanished. setTimeout and setImmediate already
      // forwarded theirs, which is why this looked like a stream bug.
      if (arguments.length > 1) {
        var extra = Array.prototype.slice.call(arguments, 1);
        return origNextTick.call(process, function () {
          callback.apply(undefined, extra);
        });
      }
      return origNextTick.call(process, callback);
    };
  }

  if (typeof process.setSourceMapsEnabled !== "function") {
    process.setSourceMapsEnabled = function setSourceMapsEnabled(val) {
      if (typeof val !== "boolean") {
        throw __perr.ERR_INVALID_ARG_TYPE("val", "of type boolean", val);
      }
    };
  }
})();

// process.kill did not exist at all, so nothing in this runtime could signal a
// process it did not spawn — including the test harnesses that kill themselves
// to check a signal handler. The native under it is the same one
// child_process's kill() uses.
if (typeof process.kill !== "function") {
  var __SIGNAL_NUMBERS = {
    SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGILL: 4, SIGTRAP: 5, SIGABRT: 6,
    SIGBUS: 10, SIGFPE: 8, SIGKILL: 9, SIGUSR1: 30, SIGSEGV: 11, SIGUSR2: 31,
    SIGPIPE: 13, SIGALRM: 14, SIGTERM: 15, SIGCHLD: 20, SIGCONT: 19,
    SIGSTOP: 17, SIGTSTP: 18, SIGTTIN: 21, SIGTTOU: 22, SIGURG: 16,
    SIGXCPU: 24, SIGXFSZ: 25, SIGVTALRM: 26, SIGPROF: 27, SIGWINCH: 28,
    SIGIO: 23, SIGSYS: 12,
  };
  process.kill = function kill(pid, signal) {
    // The pid is checked before the signal: node rejects a non-integer pid with
    // ERR_INVALID_ARG_TYPE whatever the signal is.
    //
    // This is node's own test, loose equality against the int32 coercion, and it
    // has to stay that literal shape. `Math.floor(pid) !== pid` looks equivalent
    // and is not: it admits Infinity and every value past 2^31, which the native
    // below then TRUNCATES to an i32. Infinity truncated that way lands on -1,
    // and kill(-1, SIGTERM) signals every process the user owns. That is not a
    // hypothetical: it terminated the editor, the browser and the session that
    // was running the probe.
    if (pid != (pid | 0)) {
      throw __perr.ERR_INVALID_ARG_TYPE("pid", "of type number", pid);
    }
    var num;
    if (signal === undefined) {
      num = __SIGNAL_NUMBERS.SIGTERM;
    } else if (typeof signal === "number") {
      num = signal;
    } else if (typeof signal === "string") {
      num = __SIGNAL_NUMBERS[signal];
      // Signal 0 is the existence probe and has no name; an unknown NAME is an
      // error rather than a no-op, because a typo would otherwise silently
      // never deliver.
      if (num === undefined) {
        var unknown = new TypeError("Unknown signal: " + signal);
        unknown.code = "ERR_UNKNOWN_SIGNAL";
        throw unknown;
      }
    } else {
      // Anything else is reported as an unknown SIGNAL, not a bad type, and the
      // value is INSPECTED rather than stringified: node's message for an
      // object is "Unknown signal: {}".
      var shown = typeof __inspect === "function" ? __inspect(signal) : String(signal);
      var badSignal = new TypeError("Unknown signal: " + shown);
      badSignal.code = "ERR_UNKNOWN_SIGNAL";
      throw badSignal;
    }
    var ok = __killPid(pid, num);
    if (!ok) {
      var e = new Error("kill ESRCH");
      e.code = "ESRCH";
      e.errno = -3;
      e.syscall = "kill";
      throw e;
    }
    return true;
  };
}
// `undefined` for a module this runtime does not have, which is exactly what
// node answers: the point of the API is to ask without a try/catch.
if (typeof process.getBuiltinModule !== "function") {
  process.getBuiltinModule = function getBuiltinModule(id) {
    try {
      return require(id);
    } catch (e) {
      return undefined;
    }
  };
}
if (typeof process.hasUncaughtExceptionCaptureCallback !== "function") {
  var __uncaughtCapture = null;
  process.setUncaughtExceptionCaptureCallback = function setUncaughtExceptionCaptureCallback(fn) {
    if (fn === null) { __uncaughtCapture = null; return; }
    if (typeof fn !== "function") {
      throw __perr.ERR_INVALID_ARG_TYPE("fn", "of type function or null", fn);
    }
    __uncaughtCapture = fn;
  };
  process.hasUncaughtExceptionCaptureCallback = function hasUncaughtExceptionCaptureCallback() {
    return __uncaughtCapture !== null;
  };
}
if (typeof process.cpuUsage !== "function") {
  process.cpuUsage = function cpuUsage() {
    return { user: 0, system: 0 };
  };
}
if (typeof process.uptime !== "function") {
  process.uptime = function uptime() { return 0; };
}

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

// --- console: the methods node has that this one did not --------------------
// Each missing one was a TypeError that killed the program, not a degraded log
// line. console.assert is what html-escaper's own test suite calls on its first
// line, and console.time/count are ordinary instrumentation.
//
// These are plain JS over console.log/error, which works because the engine's
// console fast path now defers to a replaced method rather than firing on the
// name alone.
(function () {
  var timers = {};
  var counts = {};
  var groupDepth = 0;
  var nativeLog = console.log;
  var nativeError = console.error;

  function indent() {
    var s = "";
    for (var i = 0; i < groupDepth; i++) s += "  ";
    return s;
  }
  function emit(fn, args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(args[i]);
    if (groupDepth > 0 && parts.length > 0 && typeof parts[0] === "string") {
      parts[0] = indent() + parts[0];
    } else if (groupDepth > 0) {
      parts.unshift(indent().slice(0, -1) || "");
    }
    fn.apply(console, parts);
  }

  console.log = function () { emit(nativeLog, arguments); };
  console.info = console.log;
  console.debug = console.log;
  console.error = function () { emit(nativeError, arguments); };
  console.warn = console.error;

  console.assert = function (cond) {
    if (cond) return;
    var rest = [];
    for (var i = 1; i < arguments.length; i++) rest.push(arguments[i]);
    if (rest.length === 0) console.error("Assertion failed");
    else if (typeof rest[0] === "string") console.error.apply(console, ["Assertion failed: " + rest[0]].concat(rest.slice(1)));
    else console.error.apply(console, ["Assertion failed:"].concat(rest));
  };

  console.group = function () {
    if (arguments.length) console.log.apply(console, arguments);
    groupDepth++;
  };
  console.groupCollapsed = console.group;
  console.groupEnd = function () { if (groupDepth > 0) groupDepth--; };

  // The elapsed figure is real but never reproducible, so nothing that compares
  // output byte for byte can assert it.
  console.time = function (label) { timers[label === undefined ? "default" : label] = Date.now(); };
  console.timeEnd = function (label) {
    var k = label === undefined ? "default" : label;
    if (!(k in timers)) { console.warn("Warning: No such label '" + k + "' for console.timeEnd()"); return; }
    console.log(k + ": " + (Date.now() - timers[k]) + "ms");
    delete timers[k];
  };
  console.timeLog = function (label) {
    var k = label === undefined ? "default" : label;
    if (!(k in timers)) { console.warn("Warning: No such label '" + k + "' for console.timeLog()"); return; }
    var rest = [k + ": " + (Date.now() - timers[k]) + "ms"];
    for (var i = 1; i < arguments.length; i++) rest.push(arguments[i]);
    console.log.apply(console, rest);
  };

  console.count = function (label) {
    var k = label === undefined ? "default" : label;
    counts[k] = (counts[k] || 0) + 1;
    console.log(k + ": " + counts[k]);
  };
  console.countReset = function (label) {
    var k = label === undefined ? "default" : label;
    if (!(k in counts)) { console.warn("Warning: Count for '" + k + "' does not exist"); return; }
    counts[k] = 0;
  };

  console.clear = function () {};

  // NOT node's box-drawing table: this prints the rows so the call does
  // something useful instead of throwing. Anything comparing output byte for
  // byte against node will differ here, deliberately.
  console.table = function (data) {
    if (data === null || typeof data !== "object") { console.log(data); return; }
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) console.log(keys[i], data[keys[i]]);
  };
})();

// --- Timeout objects -------------------------------------------------------
// node's setTimeout/setInterval return a Timeout OBJECT, not the numeric id a
// browser returns. Real code stores properties on it (node's own suite has a
// test that sets `t._repeat`, which under strict mode on a number is a TypeError
// rather than the silent no-op it expects), reads `_idleTimeout`, and compares
// it by identity. The engine's natives still deal in ids; this wraps them.
//
// `unref` is deliberately NOT defined. A no-op unref would let a program that
// unrefs a long interval to allow exit hang forever instead, and a hang is worse
// than the TypeError that calling an absent method already raises today.
(function () {
  var _setTimeout = globalThis.setTimeout;
  var _setInterval = globalThis.setInterval;
  var _clearTimer = globalThis.clearTimeout;

  function Timeout(id, repeat) {
    this._id = id;
    this._idleTimeout = repeat;
    this._repeat = repeat === undefined ? null : repeat;
    this._destroyed = false;
  }
  Timeout.prototype.hasRef = function hasRef() { return !this._destroyed; };
  Timeout.prototype.ref = function ref() { return this; };
  Timeout.prototype.refresh = function refresh() { return this; };
  Timeout.prototype[Symbol.toPrimitive] = function () { return this._id; };
  Timeout.prototype.toString = function () { return String(this._id); };

  function idOf(t) {
    if (t !== null && typeof t === "object") return t._id;
    return t;
  }

  // A non-function callback used to be queued and then blew up when the timer
  // fired, a tick removed from the call that was actually wrong.
  function requireCallback(fn) {
    if (typeof fn !== "function") {
      throw __perr.ERR_INVALID_ARG_TYPE("callback", "of type function", fn);
    }
  }

  globalThis.setTimeout = function setTimeout(fn, delay) {
    requireCallback(fn);
    var rest = Array.prototype.slice.call(arguments, 2);
    return new Timeout(_setTimeout.apply(null, [fn, delay].concat(rest)), undefined);
  };
  globalThis.setInterval = function setInterval(fn, delay) {
    requireCallback(fn);
    var rest = Array.prototype.slice.call(arguments, 2);
    return new Timeout(_setInterval.apply(null, [fn, delay].concat(rest)), delay);
  };
  globalThis.clearTimeout = function clearTimeout(t) {
    if (t !== null && t !== undefined && typeof t === "object") t._destroyed = true;
    return _clearTimer(idOf(t));
  };
  globalThis.clearInterval = globalThis.clearTimeout;
})();
