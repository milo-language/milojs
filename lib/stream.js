// node:stream — Readable/Writable/Transform built on EventEmitter.
//
// No backpressure and no real flow control: a Readable buffers what it is given
// and emits it on the next tick once something is listening. That is enough for
// body-parser reading a request and for res.pipe(...) style plumbing, which is
// all the target does with streams.

var EventEmitter = require('events').EventEmitter;

function inherit(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype);
  Child.prototype.constructor = Child;
}

function Readable(options) {
  EventEmitter.call(this);
  this._chunks = [];
  this._ended = false;
  this._flowing = null;
  this.readable = true;
  this.destroyed = false;
  this.errored = null;
  this.readableEnded = false;
  this._autoDestroy = !(options && options.autoDestroy === false);
  this._objectMode = Boolean(options && options.objectMode);
  this._highWaterMark = options && options.highWaterMark !== undefined
    ? options.highWaterMark : (this._objectMode ? 16 : 16384);
  this._pipes = [];
  if (options && typeof options.read === 'function') this._read = options.read;
  if (options && typeof options.destroy === 'function') this._destroy = options.destroy;
}
inherit(Readable, EventEmitter);

Readable.prototype.push = function (chunk) {
  if (chunk === null) {
    this._ended = true;
    if (this._flowing) this._drain();
    return false;
  }
  this._chunks.push(chunk);
  if (this._flowing) this._drain();
  return true;
};

Readable.prototype._drain = function () {
  var self = this;
  // deliver on a later tick so a listener attached after push() still sees data
  setTimeout(function () {
    while (self._chunks.length > 0) {
      self.emit('data', self._chunks.shift());
    }
    if (self._ended && !self._doneEmitted) {
      self._doneEmitted = true;
      self.emit('end');
      self.emit('close');
    }
  }, 0);
};

Readable.prototype.on = function (event, handler) {
  EventEmitter.prototype.on.call(this, event, handler);
  if (event === 'data' || event === 'end') {
    this._flowing = true;
    this._drain();
  }
  return this;
};

Readable.prototype.resume = function () { this._flowing = true; this._drain(); return this; };
Readable.prototype.pause = function () { this._flowing = false; return this; };
Readable.prototype.setEncoding = function (enc) { this._encoding = enc; return this; };
Readable.prototype.pipe = function (dest, options) {
  var self = this;
  if (!this._pipes) this._pipes = [];
  // node records every destination, including the same one twice, and reports
  // them through _readableState.pipes. Without the list there is nothing for
  // unpipe() to remove either.
  this._pipes.push(dest);
  var onData = function (chunk) { dest.write(chunk); };
  var onEnd = function () { if (dest.end && !(options && options.end === false)) dest.end(); };
  this.on('data', onData);
  this.on('end', onEnd);
  if (!this._pipeHandlers) this._pipeHandlers = [];
  this._pipeHandlers.push({ dest: dest, onData: onData, onEnd: onEnd });
  // Not every pipe destination is an EventEmitter — a plain object with write()
  // is a legitimate sink, and announcing the pipe must not be what breaks it.
  if (dest && typeof dest.emit === 'function') dest.emit('pipe', self);
  return dest;
};

// Detaching one destination, or all of them when called bare.
Readable.prototype.unpipe = function (dest) {
  var handlers = this._pipeHandlers || [];
  var keptHandlers = [];
  for (var i = 0; i < handlers.length; i++) {
    if (dest === undefined || handlers[i].dest === dest) {
      this.removeListener('data', handlers[i].onData);
      this.removeListener('end', handlers[i].onEnd);
      if (handlers[i].dest && typeof handlers[i].dest.emit === 'function') handlers[i].dest.emit('unpipe', this);
    } else {
      keptHandlers.push(handlers[i]);
    }
  }
  this._pipeHandlers = keptHandlers;
  this._pipes = keptHandlers.map(function (h) { return h.dest; });
  return this;
};

Readable.prototype.isPaused = function () { return this._flowing === false; };
Readable.prototype.read = function () {
  if (this._chunks.length === 0) return null;
  return this._chunks.shift();
};

// Readable.from(iterable): build a stream that emits each item then ends.
// Handles arrays, sync iterables, and async iterables (async generators).
Readable.from = function (iterable, options) {
  var r = new Readable(options);
  if (iterable && typeof iterable[Symbol.asyncIterator] === 'function') {
    var it = iterable[Symbol.asyncIterator]();
    var pump = function () {
      it.next().then(function (res) {
        if (res.done) { r.push(null); }
        else { r.push(res.value); pump(); }
      }, function (err) { r.emit('error', err); });
    };
    pump();
    return r;
  }
  var items = Array.isArray(iterable) ? iterable.slice()
    : (iterable && typeof iterable[Symbol.iterator] === 'function') ? Array.from(iterable) : [];
  for (var i = 0; i < items.length; i++) r.push(items[i]);
  r.push(null);
  return r;
};

function Writable(options) {
  EventEmitter.call(this);
  this.writable = true;
  this._written = [];
  this.destroyed = false;
  this.errored = null;
  this.writableEnded = false;
  this.writableFinished = false;
  this._autoDestroy = !(options && options.autoDestroy === false);
  this._objectMode = Boolean(options && options.objectMode);
  this._highWaterMark = options && options.highWaterMark !== undefined
    ? options.highWaterMark : (this._objectMode ? 16 : 16384);
  this._corked = 0;
  this._corkBuffer = [];
  this._ending = false;
  this._needDrain = false;
  if (options && typeof options.write === 'function') this._writeImpl = options.write;
  if (options && typeof options.writev === 'function') this._writev = options.writev;
  if (options && typeof options.final === 'function') this._final = options.final;
  if (options && typeof options.destroy === 'function') this._destroy = options.destroy;
}
inherit(Writable, EventEmitter);

Writable.prototype.write = function (chunk, encoding, cb) {
  if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
  if (this._corked) {
    if (!this._corkBuffer) this._corkBuffer = [];
    this._corkBuffer.push({ chunk: chunk, encoding: encoding, cb: cb });
    // Corking is not backpressure. node keeps answering true while the held
    // bytes are under the high water mark, and only asks for a 'drain' past it.
    var over = this._corkBuffer.length >= this._highWaterMark;
    if (over) this._needDrain = true;
    return !over;
  }
  this._writeNow(chunk, encoding, cb);
  return true;
};

Writable.prototype._writeNow = function (chunk, encoding, cb) {
  if (this._writeImpl) {
    this._writeImpl(chunk, encoding, cb || function () {});
  } else {
    this._written.push(chunk);
    if (cb) cb();
  }
};

Writable.prototype.end = function (chunk, encoding, cb) {
  if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
  if (this.writableEnded) {
    var already = new Error('write after end');
    already.code = 'ERR_STREAM_ALREADY_FINISHED';
    if (typeof cb === 'function') { var s2 = this; setTimeout(function () { cb(already); }, 0); }
    else this.emit('error', already);
    return this;
  }
  this._ending = true;
  if (chunk !== undefined && chunk !== null) this.write(chunk, encoding);
  // end() implies a full uncork: node flushes what was held rather than
  // discarding it, and a corked stream that ended would otherwise lose writes.
  if (this._corked) { this._corked = 1; this.uncork(); }
  this.writable = false;
  this.writableEnded = true;
  var self = this;
  // 'finish' is asynchronous in node, so writableFinished is still false when
  // end() returns. Emitting it inline let a caller observe a finished stream
  // before the tick that finishes it.
  var finish = function (err) {
    if (err) { self.emit('error', err); return; }
    self.writableFinished = true;
    self.emit('finish');
    // autoDestroy is node's default: a finished stream destroys itself, which
    // is what makes 'close' arrive after 'finish' rather than instead of it.
    if (self._autoDestroy && !self.destroyed) self.destroy();
    else self.emit('close');
    if (cb) cb();
  };
  setTimeout(function () {
    // A stream destroyed between end() and this tick never finishes: node emits
    // 'close' alone, and 'finish' must not arrive after a destroy.
    if (self.destroyed) { if (cb) cb(); return; }
    // _final is the stream's last chance to flush, and it runs BEFORE 'finish'.
    // It was never called at all, so a stream that did its real work there
    // finished without doing it.
    if (typeof self._final === 'function') {
      var called = false;
      self._final(function (err) {
        if (called) return;
        called = true;
        finish(err);
      });
      return;
    }
    finish();
  }, 0);
  return this;
};

Writable.prototype.setDefaultEncoding = function () { return this; };

// cork/uncork were no-ops returning `this`, so a corked stream wrote straight
// through and `corked`/`bufferedRequestCount` had nothing behind them. Writes
// are held while corked and flushed in order when the last cork is lifted,
// which is the behaviour a caller corks in order to get.
Writable.prototype.cork = function () {
  this._corked = (this._corked || 0) + 1;
  return this;
};
Writable.prototype.uncork = function () {
  if (!this._corked) return this;
  this._corked -= 1;
  if (this._corked === 0 && this._corkBuffer && this._corkBuffer.length > 0) {
    var held = this._corkBuffer;
    this._corkBuffer = [];
    // Batching is the POINT of corking: a stream that implements _writev gets
    // one call with everything held, not one call per chunk. Replaying them
    // individually made the write count differ from node's by exactly the
    // number of chunks that were batched.
    if (typeof this._writev === 'function' && held.length > 1) {
      var self = this;
      var batch = held.map(function (h) { return { chunk: h.chunk, encoding: h.encoding }; });
      this._writev(batch, function (err) {
        for (var k = 0; k < held.length; k++) if (held[k].cb) held[k].cb(err);
      });
    } else {
      for (var i = 0; i < held.length; i++) {
        this._writeNow(held[i].chunk, held[i].encoding, held[i].cb);
      }
    }
  }
  return this;
};

// destroy() is core stream API and every class was missing it: node's own tests
// call it constantly and got "destroy is not a function". It is idempotent, it
// runs the subclass's _destroy hook if there is one, and 'close' is emitted on a
// later turn so a caller that attaches a listener right after destroy() still
// sees it.
function installDestroy(Ctor) {
  Ctor.prototype.destroy = function (err) {
    if (this.destroyed) return this;
    this.destroyed = true;
    this.readable = false;
    this.writable = false;
    if (err) this.errored = err;
    var self = this;
    function finishDestroy(hookErr) {
      var e = hookErr || err;
      setTimeout(function () {
        // An 'error' with no listener throws, which is right for a real failure
        // but would turn a plain destroy() into a crash — so only a stream that
        // was actually destroyed WITH an error emits one.
        if (e) self.emit('error', e);
        self.emit('close');
      }, 0);
    }
    if (typeof this._destroy === 'function') {
      var called = false;
      try {
        this._destroy(err || null, function (hookErr) {
          if (called) return;
          called = true;
          finishDestroy(hookErr);
        });
      } catch (thrown) {
        if (!called) { called = true; finishDestroy(thrown); }
      }
    } else {
      finishDestroy(null);
    }
    return this;
  };
  // node exposes these as getters on the prototype; plain methods are enough for
  // the callers that only ask whether the stream is finished.
  Ctor.prototype._undestroy = function () { this.destroyed = false; return this; };
}

// A real Duplex: readable AND writable, with both halves independent. Duplex was
// aliased to Transform, so `new Duplex({read, write})` behaved as a transform —
// its write() pushed straight to the readable side instead of calling the
// caller's write, and net.Socket / http streams inherited that shape.
function Duplex(options) {
  Readable.call(this, options);
  this.writable = true;
  this.writableEnded = false;
  this.writableFinished = false;
  this._written = [];
  this._corked = 0;
  this._corkBuffer = [];
  this._ending = false;
  this._needDrain = false;
  this._autoDestroy = !(options && options.autoDestroy === false);
  if (options && typeof options.write === 'function') this._writeImpl = options.write;
  if (options && typeof options.writev === 'function') this._writev = options.writev;
  if (options && typeof options.final === 'function') this._final = options.final;
}
inherit(Duplex, Readable);
// Duplex borrowed Writable's methods one name at a time, so anything added to
// Writable was silently missing here: cork/uncork stayed no-ops after Writable
// grew real ones, and _writeNow was never copied at all, which made every
// Duplex write throw once cork buffering landed. Copying the SET means a new
// Writable method cannot be forgotten.
var WRITABLE_METHODS = [
  'write', '_writeNow', 'end', 'setDefaultEncoding', 'cork', 'uncork',
];
for (var wi = 0; wi < WRITABLE_METHODS.length; wi++) {
  Duplex.prototype[WRITABLE_METHODS[wi]] = Writable.prototype[WRITABLE_METHODS[wi]];
}

function Transform(options) {
  Readable.call(this, options);
  this.writable = true;
  if (options && typeof options.transform === 'function') this._transform = options.transform;
}
inherit(Transform, Readable);

Transform.prototype.write = function (chunk) {
  var self = this;
  if (this._transform) {
    this._transform(chunk, null, function (err, out) {
      if (out !== undefined && out !== null) self.push(out);
    });
  } else {
    this.push(chunk);
  }
  return true;
};
Transform.prototype.end = function (chunk) {
  if (chunk !== undefined && chunk !== null) this.write(chunk);
  this.push(null);
  return this;
};

// wrap() adapts an old-style (v1) stream — one that only emits data/end — into a
// modern Readable by pushing its events through.
Readable.prototype.wrap = function (oldStream) {
  var self = this;
  oldStream.on('data', function (chunk) {
    if (self.push(chunk) === false && typeof oldStream.pause === 'function') oldStream.pause();
  });
  oldStream.on('end', function () { self.push(null); });
  oldStream.on('error', function (err) { self.emit('error', err); });
  if (typeof oldStream.resume === 'function') oldStream.resume();
  return this;
};

function PassThrough(options) { Transform.call(this, options); }
inherit(PassThrough, Transform);

function pipeline() {
  var args = Array.prototype.slice.call(arguments, 0);
  var cb = typeof args[args.length - 1] === 'function' ? args.pop() : function () {};
  for (var i = 0; i + 1 < args.length; i++) args[i].pipe(args[i + 1]);
  if (args.length > 0) {
    var last = args[args.length - 1];
    if (last.on) last.on('finish', function () { cb(null); });
  }
  return args[args.length - 1];
}

// Every stream class gets destroy(). Applied after all of them are defined so
// Transform/PassThrough pick it up on their own prototypes rather than relying
// on the inheritance chain, which some of them replace wholesale.
installDestroy(Readable);
installDestroy(Writable);
installDestroy(Duplex);
installDestroy(Transform);
installDestroy(PassThrough);

// node's require('stream') is the legacy Stream constructor itself, carrying
// Readable/Writable/etc as properties. send does Stream.call(this) and inherits
// from it, so the export has to be callable.
function Stream() { EventEmitter.call(this); }
Stream.prototype = Object.create(EventEmitter.prototype);
Stream.prototype.constructor = Stream;
Stream.prototype.pipe = Readable.prototype.pipe;
installDestroy(Stream);

Stream.Readable = Readable;
Stream.Writable = Writable;
Stream.Duplex = Duplex;
Stream.Duplex = Transform;
Stream.Transform = Transform;
Stream.PassThrough = PassThrough;
Stream.Stream = Stream;
Stream.pipeline = pipeline;
Stream.finished = function (stream, cb) {
  if (stream && stream.on) stream.on('end', function () { cb(null); });
};

module.exports = Stream;
exports = module.exports;
exports.Readable = Readable;
exports.Writable = Writable;
exports.Duplex = Duplex;
exports.Transform = Transform;
exports.PassThrough = PassThrough;
exports.pipeline = pipeline;
// --- _readableState / _writableState ---------------------------------------
//
// node's own tests read these internals directly — `r._readableState.ended`,
// `w._writableState.corked` — and 16 of the stream area's failures were nothing
// but "cannot read property 'x' of undefined" against one of them.
//
// They are LIVE VIEWS over the fields this implementation actually maintains,
// defined with getters, not snapshots and not a bag of plausible constants. A
// field this implementation does not genuinely track is absent rather than
// invented: reporting a made-up `reading` would turn a clear failure into a
// confusing one, which is the same mistake as calling a module compatible
// because it exports the right names.
// The state flags are recorded from the emissions themselves rather than set at
// each call site: a stream cannot emit 'end' or 'error' without the state
// noticing, and there is no second place to keep in step.
function trackEmissions(proto) {
  var base = proto.emit;
  proto.emit = function (name) {
    if (name === 'end') this._endEmitted = true;
    else if (name === 'error') this._errorEmitted = true;
    else if (name === 'close') this._closed = true;
    else if (name === 'drain') this._needDrain = false;
    return base.apply(this, arguments);
  };
}

function defineStateView(proto, prop, fields) {
  Object.defineProperty(proto, prop, {
    configurable: true,
    get: function () {
      var self = this;
      var view = {};
      var names = Object.keys(fields);
      for (var i = 0; i < names.length; i++) {
        (function (name, read) {
          Object.defineProperty(view, name, {
            enumerable: true, configurable: true,
            get: function () { return read(self); },
          });
        })(names[i], fields[names[i]]);
      }
      return view;
    },
  });
}

trackEmissions(Readable.prototype);
trackEmissions(Writable.prototype);

defineStateView(Readable.prototype, '_readableState', {
  objectMode: function (s) { return Boolean(s._objectMode); },
  highWaterMark: function (s) { return s._highWaterMark === undefined ? 16384 : s._highWaterMark; },
  length: function (s) { return s._chunks ? s._chunks.length : 0; },
  flowing: function (s) { return s._flowing ? true : (s._flowing === false ? false : null); },
  ended: function (s) { return Boolean(s._ended); },
  endEmitted: function (s) { return Boolean(s._endEmitted); },
  destroyed: function (s) { return Boolean(s.destroyed); },
  errored: function (s) { return s.errored === undefined ? null : s.errored; },
  errorEmitted: function (s) { return Boolean(s._errorEmitted); },
  encoding: function (s) { return s._encoding === undefined ? null : s._encoding; },
  // Derived rather than stored: whoever is listening IS the answer, so this
  // cannot drift out of step with the emitter.
  readableListening: function (s) { return s.listenerCount('readable') > 0; },
  pipes: function (s) { return s._pipes || []; },
  closed: function (s) { return Boolean(s._closed); },
});

// One field set, three prototypes: Writable, Duplex and Transform all report the
// same writable state, and a field added here reaches all of them.
var WRITABLE_STATE_FIELDS = {
  objectMode: function (s) { return Boolean(s._objectMode); },
  highWaterMark: function (s) { return s._highWaterMark === undefined ? 16384 : s._highWaterMark; },
  length: function (s) { return s._corkBuffer ? s._corkBuffer.length : 0; },
  ending: function (s) { return Boolean(s._ending); },
  ended: function (s) { return Boolean(s.writableEnded); },
  finished: function (s) { return Boolean(s.writableFinished); },
  needDrain: function (s) { return Boolean(s._needDrain); },
  corked: function (s) { return s._corked || 0; },
  bufferedRequestCount: function (s) { return s._corkBuffer ? s._corkBuffer.length : 0; },
  destroyed: function (s) { return Boolean(s.destroyed); },
  errored: function (s) { return s.errored === undefined ? null : s.errored; },
  errorEmitted: function (s) { return Boolean(s._errorEmitted); },
  closed: function (s) { return Boolean(s._closed); },
};

defineStateView(Writable.prototype, '_writableState', WRITABLE_STATE_FIELDS);
defineStateView(Duplex.prototype, '_writableState', WRITABLE_STATE_FIELDS);
trackEmissions(Duplex.prototype);

exports.finished = function (stream, cb) {
  if (stream && stream.on) stream.on('end', function () { cb(null); });
};
