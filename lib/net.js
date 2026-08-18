// node:net — only what express/http touch. Real socket objects come from the
// http module; this exists so `require('net')` resolves and isIP works.
exports.isIP = function (s) {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(String(s))) return 4;
  if (String(s).indexOf(':') >= 0) return 6;
  return 0;
};
exports.isIPv4 = function (s) { return exports.isIP(s) === 4; };
exports.isIPv6 = function (s) { return exports.isIP(s) === 6; };
var EventEmitter = require('events').EventEmitter;

// A connected TCP endpoint, either accepted by a Server or opened by connect().
// Reads are pumped by the event loop through _pump rather than by a blocking
// recv: parking on a socket stalls timers, microtasks and every other server,
// which is the same rule the http server's accept loop follows.
function Socket(connId) {
  EventEmitter.call(this);
  this._connId = connId === undefined ? -1 : connId;
  this.readable = this._connId >= 0;
  this.writable = this._connId >= 0;
  this.destroyed = false;
  this._ended = false;
}
Socket.prototype = Object.create(EventEmitter.prototype);
Socket.prototype.constructor = Socket;

Socket.prototype.write = function (data, encoding, cb) {
  if (this._connId < 0 || this.destroyed) return false;
  __tcpSend(this._connId, String(data));
  if (typeof encoding === 'function') cb = encoding;
  if (cb) setTimeout(cb, 0);
  return true;
};

Socket.prototype.end = function (data, encoding, cb) {
  if (data !== undefined && data !== null && typeof data !== 'function') {
    this.write(data);
  }
  if (typeof data === 'function') cb = data;
  else if (typeof encoding === 'function') cb = encoding;
  if (!this._ended) {
    this._ended = true;
    this.writable = false;
    var self = this;
    setTimeout(function () {
      self.emit('finish');
      self.destroy();
    }, 0);
  }
  if (cb) setTimeout(cb, 0);
  return this;
};

Socket.prototype.destroy = function (err) {
  if (this.destroyed) return this;
  this.destroyed = true;
  this.readable = false;
  this.writable = false;
  if (this._connId >= 0) __tcpClose(this._connId);
  var self = this;
  setTimeout(function () {
    if (err) self.emit('error', err);
    self.emit('close', Boolean(err));
  }, 0);
  return this;
};

Socket.prototype.setEncoding = function () { return this; };
Socket.prototype.setTimeout = function () { return this; };
Socket.prototype.setNoDelay = function () { return this; };
Socket.prototype.setKeepAlive = function () { return this; };
Socket.prototype.ref = function () { return this; };
Socket.prototype.unref = function () { return this; };
Socket.prototype.address = function () {
  return { address: '127.0.0.1', family: 'IPv4', port: this._port || 0 };
};

// One non-blocking read. Returns false when the peer has closed, which is how
// the loop knows to stop pumping this socket.
Socket.prototype._pump = function () {
  if (this._connId < 0 || this.destroyed) return false;
  var chunk = __tcpRecv(this._connId);
  if (chunk === null || chunk === undefined || chunk.length === 0) return true;
  this.emit('data', chunk);
  return true;
};

function connect(port, host, cb) {
  if (typeof port === 'object' && port !== null) {
    cb = typeof host === 'function' ? host : cb;
    host = port.host;
    port = port.port;
  }
  if (typeof host === 'function') { cb = host; host = undefined; }
  var sock = new Socket(-1);
  sock._port = Number(port) || 0;
  // Connecting is synchronous underneath, but 'connect' has to be observable,
  // so it is emitted on the next tick the way node does.
  setTimeout(function () {
    var id = __tcpConnect(String(host || '127.0.0.1'), Number(port) || 0);
    if (id < 0) {
      var err = new Error('connect ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      sock.destroy(err);
      return;
    }
    sock._connId = id;
    sock.readable = true;
    sock.writable = true;
    if (cb) cb();
    sock.emit('connect');
    __netRegisterSocket(sock);
  }, 0);
  return sock;
}

function Server(handler) {
  EventEmitter.call(this);
  this._listenerId = -1;
  this.listening = false;
  this._sockets = [];
  if (typeof handler === 'function') this.on('connection', handler);
}
Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.constructor = Server;

Server.prototype.listen = function (port, hostOrCb, maybeCb) {
  var cb = typeof hostOrCb === 'function' ? hostOrCb : maybeCb;
  var p = typeof port === 'object' && port !== null ? port.port : port;
  if (typeof port === 'function') { cb = port; p = 0; }
  this._listenerId = __tcpListen(Number(p) || 0);
  if (this._listenerId < 0) {
    var err = new Error('EADDRINUSE: failed to bind port ' + p);
    err.code = 'EADDRINUSE';
    if (this.listenerCount && this.listenerCount('error') > 0) {
      this.emit('error', err);
      return this;
    }
    throw err;
  }
  // Binding 0 lets the OS choose, so the REQUESTED port is not the bound one;
  // node's tests almost all listen(0) and then read address().port.
  var bound = __tcpPort(this._listenerId);
  this._port = bound > 0 ? bound : (Number(p) || 0);
  this.listening = true;
  // The loop services any object it has been handed that exposes _serveOnce;
  // the http server registers the same way.
  __httpRegister(this);
  var self = this;
  setTimeout(function () {
    if (cb) cb();
    self.emit('listening');
  }, 0);
  return this;
};

Server.prototype.address = function () {
  return { address: '127.0.0.1', family: 'IPv4', port: this._port || 0 };
};

Server.prototype.close = function (cb) {
  this.listening = false;
  __httpUnregister(this);
  var self = this;
  setTimeout(function () {
    if (cb) cb();
    self.emit('close');
  }, 0);
  return this;
};

Server.prototype.ref = function () { return this; };
Server.prototype.unref = function () { return this; };
Server.prototype.getConnections = function (cb) {
  var n = this._sockets.length;
  setTimeout(function () { cb(null, n); }, 0);
};

// Called by the event loop. Accepts at most one connection per turn and pumps
// the sockets already open, so no single socket can monopolise the loop.
Server.prototype._serveOnce = function (mayBlock) {
  var did = false;
  var connId = __tcpAccept(this._listenerId, mayBlock);
  if (connId >= 0) {
    var sock = new Socket(connId);
    sock._port = this._port;
    this._sockets.push(sock);
    this.emit('connection', sock);
    did = true;
  }
  for (var i = this._sockets.length - 1; i >= 0; i--) {
    var s = this._sockets[i];
    if (s.destroyed) { this._sockets.splice(i, 1); continue; }
    if (s._pump()) did = true;
  }
  return did;
};

// Client sockets are not owned by a server, so they need their own place in the
// loop's rotation to be read at all.
var pending = [];
function __netRegisterSocket(sock) {
  var wasEmpty = pending.length === 0;
  pending.push(sock);
  if (wasEmpty) __httpRegister(pumpAll);
}
var pumpAll = {
  _serveOnce: function () {
    var did = false;
    for (var i = pending.length - 1; i >= 0; i--) {
      if (pending[i].destroyed) { pending.splice(i, 1); continue; }
      if (pending[i]._pump()) did = true;
    }
    // Unregister once the last client socket is gone. Staying registered keeps
    // the event loop with something to service forever, so a program that closed
    // everything still never exited: the round-trip completed and then the
    // process hung until the harness killed it. That was 75 of the net area's
    // 116 failures, all reported as timeouts.
    if (pending.length === 0) __httpUnregister(pumpAll);
    return did;
  },
};

exports.Socket = Socket;
exports.Stream = Socket;
exports.Server = Server;
exports.connect = connect;
exports.createConnection = connect;
exports.createServer = function (optionsOrHandler, maybeHandler) {
  var handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
  return new Server(handler);
};

// Node's test harness calls setDefaultAutoSelectFamilyAttemptTimeout at load, so
// its absence blocked every test in the suite. There is no happy-eyeballs path
// in this runtime's connect, so the values are remembered and nothing reads them.
let __autoSelectFamilyTimeout = 250;
let __autoSelectFamily = false;
exports.setDefaultAutoSelectFamilyAttemptTimeout = function (value) {
  __autoSelectFamilyTimeout = Number(value) | 0;
};
exports.getDefaultAutoSelectFamilyAttemptTimeout = function () {
  return __autoSelectFamilyTimeout;
};
exports.setDefaultAutoSelectFamily = function (value) {
  __autoSelectFamily = Boolean(value);
};
exports.getDefaultAutoSelectFamily = function () {
  return __autoSelectFamily;
};
