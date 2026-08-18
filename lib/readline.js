// node:readline — line-oriented reading over a stream, plus the cursor helpers.
"use strict";

var EventEmitter = require('events').EventEmitter;
var _err = require('_errors');

function Interface(inputOrOptions, output, completer, terminal) {
  if (!(this instanceof Interface)) {
    return new Interface(inputOrOptions, output, completer, terminal);
  }
  EventEmitter.call(this);
  var opts = inputOrOptions;
  if (inputOrOptions === null || inputOrOptions === undefined ||
      typeof inputOrOptions.on === 'function' || typeof inputOrOptions.read === 'function') {
    opts = { input: inputOrOptions, output: output, completer: completer, terminal: terminal };
  }
  opts = opts || {};
  if (!opts.input) throw _err.ERR_INVALID_ARG_TYPE('options.input', 'a stream', opts.input);

  this.input = opts.input;
  this.output = opts.output;
  this.terminal = opts.terminal !== undefined ? !!opts.terminal : !!(opts.output && opts.output.isTTY);
  this.completer = opts.completer;
  this.crlfDelay = opts.crlfDelay || 100;
  this.line = '';
  this.cursor = 0;
  this.closed = false;
  this._pending = '';
  // A lone trailing \r has to wait: the \n that would pair with it may be the
  // first byte of the next chunk, and splitting early turns one line into two.
  this._sawCR = false;
  this._paused = false;
  this._lineQueue = [];
  this._waiters = [];
  this._questionCb = null;

  var self = this;
  this._onData = function (chunk) { self._feed(String(chunk)); };
  this._onEnd = function () { self._flush(); self.close(); };
  this.input.on('data', this._onData);
  this.input.on('end', this._onEnd);
  if (typeof this.input.resume === 'function') this.input.resume();
}
Interface.prototype = Object.create(EventEmitter.prototype);
Interface.prototype.constructor = Interface;

Interface.prototype._emitLine = function (line) {
  // question() takes the next line instead of emitting it, which is what makes
  // the callback form work without the caller also seeing a 'line' event.
  if (this._questionCb) {
    var cb = this._questionCb;
    this._questionCb = null;
    cb(line);
    return;
  }
  if (this._waiters.length > 0) {
    this._waiters.shift()({ value: line, done: false });
    return;
  }
  this._lineQueue.push(line);
  this.emit('line', line);
};

Interface.prototype._feed = function (text) {
  var buf = this._pending + text;
  this._pending = '';
  var start = 0;
  for (var i = 0; i < buf.length; i++) {
    var c = buf.charAt(i);
    if (c === '\n') {
      var end = i;
      // \r\n counts as one separator, and a bare \r is one on its own.
      if (end > start && buf.charAt(end - 1) === '\r') end--;
      this._emitLine(buf.slice(start, end));
      start = i + 1;
    } else if (c === '\r') {
      if (i + 1 < buf.length) {
        if (buf.charAt(i + 1) !== '\n') { this._emitLine(buf.slice(start, i)); start = i + 1; }
      } else {
        // Trailing \r with nothing after it yet: hold the whole remainder.
        break;
      }
    }
  }
  this._pending = buf.slice(start);
};

Interface.prototype._flush = function () {
  if (this._pending.length > 0) {
    var last = this._pending;
    this._pending = '';
    this._emitLine(last);
  }
};

Interface.prototype.question = function (query, optionsOrCb, maybeCb) {
  var cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
  if (this.output && typeof this.output.write === 'function') this.output.write(query);
  if (this._lineQueue.length > 0) {
    var line = this._lineQueue.shift();
    if (cb) cb(line);
    return;
  }
  this._questionCb = cb;
};

Interface.prototype.prompt = function () {
  if (this.output && typeof this.output.write === 'function' && this._prompt) {
    this.output.write(this._prompt);
  }
  return this;
};
Interface.prototype.setPrompt = function (p) { this._prompt = p; return this; };
Interface.prototype.getPrompt = function () { return this._prompt || '> '; };
Interface.prototype.write = function (data) {
  if (this.output && typeof this.output.write === 'function') this.output.write(String(data));
  return this;
};
Interface.prototype.pause = function () {
  this._paused = true;
  if (typeof this.input.pause === 'function') this.input.pause();
  this.emit('pause');
  return this;
};
Interface.prototype.resume = function () {
  this._paused = false;
  if (typeof this.input.resume === 'function') this.input.resume();
  this.emit('resume');
  return this;
};
Interface.prototype.getCursorPos = function () {
  return { rows: 0, cols: this.cursor };
};
Interface.prototype.close = function () {
  if (this.closed) return;
  this.closed = true;
  if (typeof this.input.removeListener === 'function') {
    this.input.removeListener('data', this._onData);
    this.input.removeListener('end', this._onEnd);
  }
  // Anything still awaiting a line gets the end of the iteration, not a hang.
  while (this._waiters.length > 0) this._waiters.shift()({ value: undefined, done: true });
  this.emit('close');
};

// for await (const line of rl). Lines already queued are replayed first so a
// consumer that attaches late does not lose them.
Interface.prototype[Symbol.asyncIterator] = function () {
  var self = this;
  return {
    next: function () {
      if (self._lineQueue.length > 0) {
        return Promise.resolve({ value: self._lineQueue.shift(), done: false });
      }
      if (self.closed) return Promise.resolve({ value: undefined, done: true });
      return new Promise(function (resolve) { self._waiters.push(resolve); });
    },
    return: function () { self.close(); return Promise.resolve({ value: undefined, done: true }); },
    [Symbol.asyncIterator]: function () { return this; },
  };
};

function createInterface(inputOrOptions, output, completer, terminal) {
  return new Interface(inputOrOptions, output, completer, terminal);
}

// --- cursor helpers ---------------------------------------------------------
// Plain ANSI writes. Each returns whether the stream accepted the write, which
// is what node's callers check before queueing more output.

function writeEscape(stream, seq, cb) {
  if (!stream || typeof stream.write !== 'function') {
    if (typeof cb === 'function') cb();
    return true;
  }
  var ok = stream.write(seq);
  if (typeof cb === 'function') cb();
  return ok !== false;
}

function cursorTo(stream, x, y, cb) {
  if (typeof y === 'function') { cb = y; y = undefined; }
  if (typeof x !== 'number' && x !== undefined) {
    throw _err.ERR_INVALID_ARG_TYPE('x', 'of type number', x);
  }
  if (x === undefined && y === undefined) { if (cb) cb(); return true; }
  var seq = y === undefined ? '\x1b[' + (x + 1) + 'G' : '\x1b[' + (y + 1) + ';' + (x + 1) + 'H';
  return writeEscape(stream, seq, cb);
}

function moveCursor(stream, dx, dy, cb) {
  var seq = '';
  if (dx < 0) seq += '\x1b[' + (-dx) + 'D';
  else if (dx > 0) seq += '\x1b[' + dx + 'C';
  if (dy < 0) seq += '\x1b[' + (-dy) + 'A';
  else if (dy > 0) seq += '\x1b[' + dy + 'B';
  return writeEscape(stream, seq, cb);
}

// dir: -1 to cursor start, 1 to end, 0 the whole line.
function clearLine(stream, dir, cb) {
  var seq = dir < 0 ? '\x1b[1K' : (dir > 0 ? '\x1b[0K' : '\x1b[2K');
  return writeEscape(stream, seq, cb);
}

function clearScreenDown(stream, cb) {
  return writeEscape(stream, '\x1b[0J', cb);
}

// Minimal keypress decoding: enough for the plain and control keys tests drive,
// not a full terminfo parser.
function emitKeypressEvents(stream, iface) {
  if (!stream || stream._keypressDecoder) return;
  stream._keypressDecoder = true;
  stream.on('data', function (chunk) {
    var s = String(chunk);
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var key = { sequence: ch, name: undefined, ctrl: false, meta: false, shift: false };
      var code = s.charCodeAt(i);
      if (ch === '\r') key.name = 'return';
      else if (ch === '\n') key.name = 'enter';
      else if (ch === '\t') key.name = 'tab';
      else if (ch === '\x7f') key.name = 'backspace';
      else if (ch === '\x1b') key.name = 'escape';
      else if (ch === ' ') key.name = 'space';
      else if (code < 27 && code > 0) {
        // Control characters are the letter they are produced from.
        key.name = String.fromCharCode(code + 96);
        key.ctrl = true;
      } else if (ch >= 'a' && ch <= 'z') key.name = ch;
      else if (ch >= 'A' && ch <= 'Z') { key.name = ch.toLowerCase(); key.shift = true; }
      stream.emit('keypress', ch, key);
    }
  });
  if (iface && typeof iface.resume === 'function') iface.resume();
}

exports.Interface = Interface;
exports.createInterface = createInterface;
exports.cursorTo = cursorTo;
exports.moveCursor = moveCursor;
exports.clearLine = clearLine;
exports.clearScreenDown = clearScreenDown;
exports.emitKeypressEvents = emitKeypressEvents;
exports.promises = {
  createInterface: function (opts) { return createInterface(opts); },
  Interface: Interface,
};
