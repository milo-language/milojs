// node:dgram — UDP sockets over the raw socket syscalls.
//
// std/net is TCP-only, so this sits directly on __udpBind/__udpSend/__udpRecv.
// Addresses cross the native boundary as a network-order u32 because formatting
// a dotted quad needs string primitives the native side would otherwise have to
// grow; both directions are handled here.
"use strict";

var EventEmitter = require('events').EventEmitter;
var _err = require('_errors');

// Network byte order: "1.2.3.4" -> 0x04030201. Anything that is not four
// numeric parts is INADDR_ANY, which is what an unset bind address means.
function ipToU32(str) {
  if (str === undefined || str === null || str === '') return 0;
  var parts = String(str).split('.');
  if (parts.length !== 4) return 0;
  var out = 0;
  for (var i = 0; i < 4; i++) {
    var n = parseInt(parts[i], 10);
    if (isNaN(n) || n < 0 || n > 255) return 0;
    out += (n & 255) * Math.pow(256, i);
  }
  return out;
}

function u32ToIp(n) {
  var v = n >>> 0;
  return (v & 255) + '.' + ((v >>> 8) & 255) + '.' + ((v >>> 16) & 255) + '.' + ((v >>> 24) & 255);
}

function Socket(typeOrOptions, listener) {
  if (!(this instanceof Socket)) return new Socket(typeOrOptions, listener);
  EventEmitter.call(this);
  var opts = typeof typeOrOptions === 'string' ? { type: typeOrOptions } : (typeOrOptions || {});
  this.type = opts.type || 'udp4';
  if (this.type !== 'udp4' && this.type !== 'udp6') {
    throw _err.ERR_INVALID_ARG_VALUE('type', this.type, 'is invalid');
  }
  this._fd = -1;
  this._bound = false;
  this._closed = false;
  this._queued = [];
  if (typeof listener === 'function') this.on('message', listener);
  else if (typeof opts.recvBufferSize === 'undefined' && typeof typeOrOptions === 'object' &&
           typeof listener === 'function') this.on('message', listener);
}
Socket.prototype = Object.create(EventEmitter.prototype);
Socket.prototype.constructor = Socket;

// Registered with the same loop rotation the net sockets use: a datagram socket
// with no reader would otherwise never be polled.
var pending = [];
var pumpAll = {
  _serveOnce: function () {
    var did = false;
    for (var i = pending.length - 1; i >= 0; i--) {
      var s = pending[i];
      if (s._closed || s._fd < 0) { pending.splice(i, 1); continue; }
      var msg = __udpRecv(s._fd);
      // null is "nothing waiting", NOT work done. Reporting it as work spins the
      // event loop at 100% CPU — the same bug net.Socket._pump had.
      if (msg === null || msg === undefined) continue;
      did = true;
      s.emit('message', require('buffer').Buffer.from(msg.data, 'latin1'), {
        address: u32ToIp(msg.addr),
        family: 'IPv4',
        port: msg.port,
        size: msg.size,
      });
    }
    if (pending.length === 0) __httpUnregister(pumpAll);
    return did;
  },
};
function register(sock) {
  var wasEmpty = pending.length === 0;
  pending.push(sock);
  if (wasEmpty) __httpRegister(pumpAll);
}

Socket.prototype.bind = function (portOrOpts, addressOrCb, maybeCb) {
  var port = portOrOpts, address = addressOrCb, cb = maybeCb;
  if (portOrOpts !== null && typeof portOrOpts === 'object') {
    port = portOrOpts.port;
    address = portOrOpts.address;
    cb = typeof addressOrCb === 'function' ? addressOrCb : maybeCb;
  }
  if (typeof portOrOpts === 'function') { cb = portOrOpts; port = 0; address = undefined; }
  if (typeof address === 'function') { cb = address; address = undefined; }
  if (this._bound) throw _err.codedError(Error, 'ERR_SOCKET_ALREADY_BOUND', 'Socket is already bound');

  var fd = __udpBind(Number(port) || 0, ipToU32(address));
  if (fd < 0) {
    var e = new Error('bind EADDRINUSE');
    e.code = 'EADDRINUSE';
    var self0 = this;
    setTimeout(function () { self0.emit('error', e); }, 0);
    return this;
  }
  this._fd = fd;
  this._bound = true;
  register(this);
  // 'listening' is registered as a one-shot listener rather than called, so the
  // callback runs with `this` === the socket, and it is emitted on a later turn
  // so nothing observes it before bind() returns.
  if (cb) this.once('listening', cb);
  var self = this;
  setTimeout(function () { self.emit('listening'); }, 0);
  return this;
};

// send(msg[, offset, length][, port][, address][, callback]) — node accepts the
// short form (msg, port, address, cb) as well as the offset/length one.
Socket.prototype.send = function (buf, offsetOrPort, lengthOrAddress, portOrCb, addressOrCb, maybeCb) {
  var offset, length, port, address, cb;
  if (typeof offsetOrPort === 'number' && typeof lengthOrAddress === 'number' &&
      (typeof portOrCb === 'number' || portOrCb === undefined)) {
    offset = offsetOrPort; length = lengthOrAddress; port = portOrCb;
    address = typeof addressOrCb === 'function' ? undefined : addressOrCb;
    cb = typeof addressOrCb === 'function' ? addressOrCb : maybeCb;
  } else {
    offset = 0; length = undefined; port = offsetOrPort;
    address = typeof lengthOrAddress === 'function' ? undefined : lengthOrAddress;
    cb = typeof lengthOrAddress === 'function' ? lengthOrAddress
       : (typeof portOrCb === 'function' ? portOrCb : addressOrCb);
  }

  var Buffer = require('buffer').Buffer;
  var payload;
  if (typeof buf === 'string') payload = buf;
  else if (Array.isArray(buf)) payload = Buffer.concat(buf.map(function (b) {
    return typeof b === 'string' ? Buffer.from(b) : b;
  })).toString('latin1');
  else if (buf instanceof Uint8Array) payload = Buffer.from(buf).toString('latin1');
  else throw _err.ERR_INVALID_ARG_TYPE('buffer', ['Buffer', 'TypedArray', 'DataView', 'string'], buf);

  if (length !== undefined) payload = payload.slice(offset, offset + length);
  else if (offset) payload = payload.slice(offset);

  // Sending before bind() implicitly binds to an ephemeral port, exactly as node
  // does; without this a send-only socket has no fd to send from.
  if (!this._bound) this.bind(0);

  var self = this;
  var n = __udpSend(this._fd, payload, Number(port) || 0, ipToU32(address || '127.0.0.1'));
  setTimeout(function () {
    if (n < 0) {
      var e = new Error('send failed');
      e.code = 'ERR_SOCKET_BAD_PORT';
      if (cb) cb(e); else self.emit('error', e);
      return;
    }
    if (cb) cb(null, n);
  }, 0);
  return this;
};

Socket.prototype.address = function () {
  if (!this._bound) {
    throw _err.codedError(Error, 'ERR_SOCKET_DGRAM_NOT_RUNNING', 'Not running');
  }
  var port = __udpAddress(this._fd);
  return { address: '0.0.0.0', family: 'IPv4', port: port < 0 ? 0 : port };
};

Socket.prototype.close = function (cb) {
  if (this._closed) {
    if (cb) this.once('close', cb);
    return this;
  }
  this._closed = true;
  if (this._fd >= 0) __udpClose(this._fd);
  this._fd = -1;
  if (cb) this.once('close', cb);
  var self = this;
  setTimeout(function () { self.emit('close'); }, 0);
  return this;
};

// Present so callers can chain; there is no reference counting in this loop yet.
Socket.prototype.ref = function () { return this; };
Socket.prototype.unref = function () { return this; };
Socket.prototype.setBroadcast = function () { return this; };
Socket.prototype.setTTL = function () { return this; };
Socket.prototype.setMulticastTTL = function () { return this; };
Socket.prototype.setMulticastLoopback = function () { return this; };
Socket.prototype.addMembership = function () { return this; };
Socket.prototype.dropMembership = function () { return this; };
Socket.prototype.setRecvBufferSize = function () { return this; };
Socket.prototype.setSendBufferSize = function () { return this; };
Socket.prototype.getRecvBufferSize = function () { return 65536; };
Socket.prototype.getSendBufferSize = function () { return 65536; };

function createSocket(typeOrOptions, listener) {
  return new Socket(typeOrOptions, listener);
}

exports.createSocket = createSocket;
exports.Socket = Socket;
