// node:domain — error routing for a group of async operations.
//
// Deprecated in node but still exercised by a large part of its suite. The whole
// module rests on one idea: while a domain is "active", any error that would
// otherwise be uncaught is emitted on that domain instead of ending the process.
//
// Node implements the async part with async_hooks. This binds at the two places
// a callback can outlive the active domain instead — timers and event emitters —
// which covers what the tests actually drive without an async_hooks dependency.
"use strict";

var EventEmitter = require('events').EventEmitter;

var stack = [];
// The domain a callback should re-enter, captured when the callback was created.
// Without this a timer scheduled inside d.run() would run with no active domain
// and its error would kill the process, which is the case domains exist for.
function active() {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function Domain() {
  if (!(this instanceof Domain)) return new Domain();
  EventEmitter.call(this);
  this.members = [];
  this._disposed = false;
}
Domain.prototype = Object.create(EventEmitter.prototype);
Domain.prototype.constructor = Domain;

Domain.prototype.enter = function () {
  if (this._disposed) return this;
  stack.push(this);
  process.domain = this;
  return this;
};

Domain.prototype.exit = function () {
  // Pops this domain AND anything entered above it, which is what node does:
  // exiting an outer domain cannot leave inner ones active.
  var i = stack.lastIndexOf(this);
  if (i >= 0) stack.length = i;
  process.domain = active();
  return this;
};

// run returns the function's return value — several tests assert exactly that,
// so it cannot swallow the result while catching errors.
Domain.prototype.run = function (fn) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  this.enter();
  var result;
  try {
    result = fn.apply(this, args);
  } catch (e) {
    this._emitError(e);
  } finally {
    this.exit();
  }
  return result;
};

Domain.prototype.add = function (emitter) {
  if (!emitter || this.members.indexOf(emitter) !== -1) return this;
  emitter.domain = this;
  this.members.push(emitter);
  return this;
};

Domain.prototype.remove = function (emitter) {
  if (!emitter) return this;
  if (emitter.domain === this) emitter.domain = null;
  var i = this.members.indexOf(emitter);
  if (i !== -1) this.members.splice(i, 1);
  return this;
};

Domain.prototype.bind = function (cb) {
  var self = this;
  return function () {
    self.enter();
    try {
      return cb.apply(this, arguments);
    } catch (e) {
      self._emitError(e);
    } finally {
      self.exit();
    }
  };
};

// intercept is bind plus node's error-first convention: a truthy first argument
// goes to the domain and the callback is not called at all.
Domain.prototype.intercept = function (cb) {
  var self = this;
  return function (err) {
    if (err) { self._emitError(err); return undefined; }
    var rest = [];
    for (var i = 1; i < arguments.length; i++) rest.push(arguments[i]);
    self.enter();
    try {
      return cb.apply(this, rest);
    } catch (e) {
      self._emitError(e);
    } finally {
      self.exit();
    }
  };
};

Domain.prototype.dispose = function () {
  this._disposed = true;
  this.exit();
  this.removeAllListeners();
  return this;
};

// An error with no handler on this domain is still uncaught: rethrowing lets it
// reach the process, which is node's behaviour and what the abort-on-uncaught
// tests check. Swallowing it here would turn a crash into silence.
Domain.prototype._emitError = function (err) {
  if (err !== null && typeof err === 'object') {
    err.domain = this;
    err.domainThrown = true;
  }
  if (this.listenerCount('error') === 0) throw err;
  this.emit('error', err);
};

// --- binding callbacks to the domain that created them ----------------------
// Patched once, when this module is first required, so a program that never
// touches domains pays nothing and behaves exactly as before.

var patched = false;
function patchAsyncEntryPoints() {
  if (patched) return;
  patched = true;

  var realSetTimeout = globalThis.setTimeout;
  var realSetInterval = globalThis.setInterval;

  function wrapCallback(fn) {
    var d = active();
    if (!d || typeof fn !== 'function') return fn;
    return function () {
      d.enter();
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        d._emitError(e);
      } finally {
        d.exit();
      }
    };
  }

  globalThis.setTimeout = function (fn, ms) {
    var rest = [];
    for (var i = 2; i < arguments.length; i++) rest.push(arguments[i]);
    return realSetTimeout.apply(this, [wrapCallback(fn), ms].concat(rest));
  };
  globalThis.setInterval = function (fn, ms) {
    var rest = [];
    for (var i = 2; i < arguments.length; i++) rest.push(arguments[i]);
    return realSetInterval.apply(this, [wrapCallback(fn), ms].concat(rest));
  };

  // An emitter added to a domain runs its listeners inside that domain, so an
  // error thrown by a listener reaches the domain rather than the process.
  var realEmit = EventEmitter.prototype.emit;
  EventEmitter.prototype.emit = function (name) {
    var d = this.domain;
    if (!d || name === 'error') return realEmit.apply(this, arguments);
    d.enter();
    try {
      return realEmit.apply(this, arguments);
    } catch (e) {
      d._emitError(e);
    } finally {
      d.exit();
    }
  };

  // Last line: an error that escaped everything still belongs to the domain that
  // was active when it happened.
  var priorDispatch = globalThis.__dispatchUncaught;
  globalThis.__dispatchUncaught = function (err) {
    var d = (err && err.domain) || active();
    if (d && d.listenerCount('error') > 0) {
      d.emit('error', err);
      return true;
    }
    return typeof priorDispatch === 'function' ? priorDispatch(err) : false;
  };
}

function create() {
  patchAsyncEntryPoints();
  return new Domain();
}

// The module itself is a Domain in node, so `domain.on('error')` and
// `domain.run()` work on the default instance as well as on created ones.
patchAsyncEntryPoints();

exports.Domain = Domain;
exports.create = create;
exports.createDomain = create;
exports.active = null;
exports._stack = stack;
