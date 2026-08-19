// node:events — EventEmitter in the ES5 subset milojs supports. Never stores
// properties on a function value.
//
// Listeners are invoked with `this` set to the emitter. That is not a detail:
// node's own tests lean on it constantly (`server.listen(0, function () {
// this.address().port })`), so calling listeners unbound failed them before
// any real behaviour was exercised.
"use strict";

function EventEmitter(opts) {
  this._events = {};
  if (opts && opts.captureRejections) {
    this._captureRejections = true;
  }
}

// node keys these off well-known symbols, not strings, so a listener registered
// under one cannot collide with an event literally named "error".
var kErrorMonitor = Symbol('events.errorMonitor');
var kRejection = Symbol.for('nodejs.rejection');

EventEmitter.prototype._list = function (name) {
  if (!this._events) {
    this._events = {};
  }
  if (!this._events[name]) {
    this._events[name] = [];
  }
  return this._events[name];
};

EventEmitter.prototype.on = function (name, fn) {
  this._list(name).push(fn);
  return this;
};

EventEmitter.prototype.addListener = function (name, fn) {
  return this.on(name, fn);
};

// prepend* register at the FRONT of the listener list (run before existing ones)
EventEmitter.prototype.prependListener = function (name, fn) {
  this._list(name).unshift(fn);
  return this;
};

EventEmitter.prototype.prependOnceListener = function (name, fn) {
  var self = this;
  var fired = false;
  var wrapper = function () {
    if (fired) return undefined;
    fired = true;
    self.removeListener(name, wrapper);
    return fn.apply(this, arguments);
  };
  this._list(name).unshift(wrapper);
  return this;
};

EventEmitter.prototype.once = function (name, fn) {
  var self = this;
  var fired = false;
  var wrapper = function () {
    if (fired) {
      return undefined;
    }
    fired = true;
    self.removeListener(name, wrapper);
    return fn.apply(this, arguments);
  };
  return this.on(name, wrapper);
};

EventEmitter.prototype.removeListener = function (name, fn) {
  var list = this._list(name);
  var kept = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i] !== fn) {
      kept.push(list[i]);
    }
  }
  this._events[name] = kept;
  return this;
};

EventEmitter.prototype.off = function (name, fn) {
  return this.removeListener(name, fn);
};

EventEmitter.prototype.removeAllListeners = function (name) {
  if (name === undefined) {
    this._events = {};
  } else {
    this._events[name] = [];
  }
  return this;
};

EventEmitter.prototype.listeners = function (name) {
  var list = this._list(name);
  var copy = [];
  for (var i = 0; i < list.length; i++) {
    copy.push(list[i]);
  }
  return copy;
};

EventEmitter.prototype.listenerCount = function (name) {
  return this._list(name).length;
};

// A listener that returns a rejecting promise is otherwise an unhandled
// rejection with no route back to the emitter. node routes it to the emitter's
// Symbol.for('nodejs.rejection') handler, or to 'error' if there is none, but
// only when the emitter was constructed with { captureRejections: true }.
function captureRejection(emitter, result, name, args) {
  if (!result || typeof result.then !== 'function') return;
  result.then(undefined, function (err) {
    if (typeof emitter[kRejection] === 'function') {
      emitter[kRejection](err, name, args);
      return;
    }
    try {
      emitter.emit('error', err);
    } catch (e) {
      // An emitter with no 'error' listener rethrows out of emit(), and there
      // is no caller left to catch it here — surface it as node does, on the
      // next tick, rather than swallowing it inside this .then.
      process.nextTick(function () { throw e; });
    }
  });
}

EventEmitter.prototype.emit = function (name) {
  // errorMonitor listeners observe an error without counting as handling it,
  // so they run before the "was anyone listening" decision, not inside it.
  if (name === 'error' && this._events && this._events[kErrorMonitor]) {
    var mon = this._events[kErrorMonitor];
    for (var mi = 0; mi < mon.length; mi++) {
      mon[mi].call(this, arguments[1]);
    }
  }
  var list = this.listeners(name);
  if (list.length === 0) {
    // An unhandled 'error' event THROWS in node — that is how a failed stream or
    // socket surfaces at all. Returning false silently discarded it, so the
    // failure vanished and whatever was waiting on it hung instead.
    if (name === 'error') {
      var err = arguments[1];
      if (err instanceof Error) throw err;
      var wrapped = new Error('Unhandled error. (' + (err === undefined ? '' : String(err)) + ')');
      wrapped.code = 'ERR_UNHANDLED_ERROR';
      wrapped.context = err;
      throw wrapped;
    }
    return false;
  }
  var args = [];
  for (var i = 1; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  for (var j = 0; j < list.length; j++) {
    var r = list[j].apply(this, args);
    if (this._captureRejections) captureRejection(this, r, name, args);
  }
  return true;
};

EventEmitter.prototype.rawListeners = function (name) {
  return this.listeners(name);
};

EventEmitter.prototype.eventNames = function () {
  if (!this._events) return [];
  var out = [];
  var keys = Object.keys(this._events);
  for (var i = 0; i < keys.length; i++) {
    if (this._events[keys[i]].length > 0) out.push(keys[i]);
  }
  var syms = Object.getOwnPropertySymbols(this._events);
  for (var j = 0; j < syms.length; j++) {
    if (this._events[syms[j]].length > 0) out.push(syms[j]);
  }
  return out;
};

// The max-listeners warning is advisory in node; what programs actually depend
// on is that the accessors exist and round-trip, which is what the tests check.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.prototype.setMaxListeners = function (n) {
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.getMaxListeners = function () {
  return this._maxListeners === undefined
    ? EventEmitter.defaultMaxListeners
    : this._maxListeners;
};

EventEmitter.errorMonitor = kErrorMonitor;
EventEmitter.captureRejectionSymbol = kRejection;

// `EventEmitter.listenerCount(emitter, name)` is the deprecated static form.
// Deprecated is not the same as absent: node still ships it and tests call it.
EventEmitter.listenerCount = function (emitter, name) {
  if (emitter && typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(name);
  }
  return 0;
};

EventEmitter.getEventListeners = function (emitter, name) {
  if (emitter && typeof emitter.listeners === 'function') return emitter.listeners(name);
  return [];
};

EventEmitter.setMaxListeners = function (n) {
  for (var i = 1; i < arguments.length; i++) {
    var t = arguments[i];
    if (t && typeof t.setMaxListeners === 'function') t.setMaxListeners(n);
  }
};

// Both halves of node's dual dispatch: an EventEmitter uses on/off, an
// EventTarget (AbortSignal is the one that matters here) uses
// addEventListener/removeEventListener. Code under test passes either.
function addHandler(target, name, fn, once) {
  if (typeof target.on === 'function') {
    if (once) target.once(name, fn); else target.on(name, fn);
    return function () { target.removeListener(name, fn); };
  }
  target.addEventListener(name, fn, { once: !!once });
  return function () { target.removeEventListener(name, fn); };
}

function abortError() {
  var e = new Error('The operation was aborted');
  e.name = 'AbortError';
  e.code = 'ABORT_ERR';
  return e;
}

EventEmitter.once = function (emitter, name, options) {
  return new Promise(function (resolve, reject) {
    var signal = options && options.signal;
    if (signal && signal.aborted) { reject(abortError()); return; }
    var offValue, offError, offAbort;
    var done = function () {
      if (offValue) offValue();
      if (offError) offError();
      if (offAbort) offAbort();
    };
    offValue = addHandler(emitter, name, function () {
      var args = [];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      done();
      // An EventTarget hands the listener one Event object, not an argument
      // list, and node resolves with that object rather than wrapping it.
      resolve(typeof emitter.on === 'function' ? args : args[0]);
    }, true);
    // Waiting for 'error' itself must not also reject on 'error'.
    if (name !== 'error' && typeof emitter.on === 'function') {
      offError = addHandler(emitter, 'error', function (err) { done(); reject(err); }, true);
    }
    if (signal) {
      offAbort = addHandler(signal, 'abort', function () { done(); reject(abortError()); }, true);
    }
  });
};

// Written as a hand-rolled async iterator rather than an async generator: an
// async generator's body is driven by next() here, and a consumer that calls
// next() without awaiting it is exactly the shape that deadlocks (see the
// "one shape that can hang" note in docs/status.md).
EventEmitter.on = function (emitter, name, options) {
  var queue = [];
  var pending = [];
  var finished = false;
  var failure = null;
  var signal = options && options.signal;

  var push = function () {
    var args = [];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    if (pending.length > 0) pending.shift().resolve({ value: args, done: false });
    else queue.push(args);
  };
  var fail = function (err) {
    failure = err;
    finished = true;
    while (pending.length > 0) pending.shift().reject(err);
  };
  var finish = function () {
    finished = true;
    while (pending.length > 0) pending.shift().resolve({ value: undefined, done: true });
  };

  emitter.on(name, push);
  if (name !== 'error') emitter.on('error', fail);
  if (signal) {
    if (signal.aborted) fail(abortError());
    else addHandler(signal, 'abort', function () { fail(abortError()); }, true);
  }

  var iterator = {
    next: function () {
      if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false });
      if (failure) { var f = failure; failure = null; return Promise.reject(f); }
      if (finished) return Promise.resolve({ value: undefined, done: true });
      return new Promise(function (resolve, reject) { pending.push({ resolve: resolve, reject: reject }); });
    },
    return: function () {
      emitter.removeListener(name, push);
      if (name !== 'error') emitter.removeListener('error', fail);
      finish();
      return Promise.resolve({ value: undefined, done: true });
    },
    throw: function (err) {
      fail(err);
      return Promise.reject(err);
    },
  };
  iterator[Symbol.asyncIterator] = function () { return iterator; };
  return iterator;
};

// The returned disposable is keyed by Symbol.dispose when the engine has it;
// `using` is not required to use this API, and node's own tests call the
// returned value's dispose only in the explicit-resource-management cases.
function disposable(off) {
  var d = {};
  if (typeof Symbol.dispose === 'symbol') d[Symbol.dispose] = off;
  d.dispose = off;
  return d;
}

EventEmitter.addAbortListener = function (signal, listener) {
  if (signal.aborted) {
    queueMicrotask(function () { listener(); });
    return disposable(function () {});
  }
  return disposable(addHandler(signal, 'abort', listener, true));
};

module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;
module.exports.once = EventEmitter.once;
module.exports.on = EventEmitter.on;
module.exports.errorMonitor = EventEmitter.errorMonitor;
module.exports.captureRejectionSymbol = EventEmitter.captureRejectionSymbol;
module.exports.getEventListeners = EventEmitter.getEventListeners;
module.exports.addAbortListener = EventEmitter.addAbortListener;
module.exports.setMaxListeners = EventEmitter.setMaxListeners;
module.exports.listenerCount = EventEmitter.listenerCount;
module.exports.defaultMaxListeners = EventEmitter.defaultMaxListeners;
