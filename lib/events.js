// node:events — EventEmitter in the ES5 subset milojs supports. Never stores
// properties on a function value.
//
// Listeners are invoked with `this` set to the emitter. That is not a detail:
// node's own tests lean on it constantly (`server.listen(0, function () {
// this.address().port })`), so calling listeners unbound failed them before
// any real behaviour was exercised.
"use strict";

function EventEmitter() {
  this._events = {};
}

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

EventEmitter.prototype.emit = function (name) {
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
    list[j].apply(this, args);
  }
  return true;
};

module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;
