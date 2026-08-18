// node:http — a server built on the raw TCP natives (__tcpListen/__tcpAccept/
// __tcpRecv/__tcpSend/__tcpClose).
//
// One connection is handled at a time and accept() blocks, so the event loop
// only reaches it when nothing else is runnable. That means timers do not fire
// while waiting for a connection. It is enough to serve requests; it is not a
// concurrent server.
//
// Keep-alive is not implemented: every response closes the connection.

var EventEmitter = require('events').EventEmitter;

var STATUS_CODES = {
  200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently',
  302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
  403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  409: 'Conflict', 413: 'Payload Too Large', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway',
  503: 'Service Unavailable'
};

function parseRequest(raw) {
  var headerEnd = raw.indexOf('\r\n\r\n');
  var sep = 4;
  if (headerEnd < 0) { headerEnd = raw.indexOf('\n\n'); sep = 2; }
  if (headerEnd < 0) { headerEnd = raw.length; sep = 0; }
  var head = raw.slice(0, headerEnd);
  var body = sep > 0 ? raw.slice(headerEnd + sep) : '';
  var lines = head.split('\n');
  var first = (lines[0] || '').split('\r').join('');
  var parts = first.split(' ');
  var headers = {};
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].split('\r').join('');
    if (!line) continue;
    var colon = line.indexOf(':');
    if (colon < 0) continue;
    var name = line.slice(0, colon).trim().toLowerCase();
    headers[name] = line.slice(colon + 1).trim();
  }
  return {
    method: parts[0] || 'GET',
    url: parts[1] || '/',
    httpVersion: (parts[2] || 'HTTP/1.1').split('/')[1] || '1.1',
    headers: headers,
    body: body
  };
}

function IncomingMessage(parsed, connId) {
  EventEmitter.call(this);
  this.method = parsed.method;
  this.url = parsed.url;
  this.headers = parsed.headers;
  this.httpVersion = parsed.httpVersion;
  this.rawBody = parsed.body;
  this.socket = { remoteAddress: '127.0.0.1', encrypted: false, destroy: function () {} };
  this.connection = this.socket;
  this.complete = true;
  this._connId = connId;
}
IncomingMessage.prototype = Object.create(EventEmitter.prototype);
IncomingMessage.prototype.constructor = IncomingMessage;

// body-parser attaches 'data'/'end' listeners; the whole body is already read,
// so hand it over on the next tick and finish.
IncomingMessage.prototype.on = function (event, handler) {
  EventEmitter.prototype.on.call(this, event, handler);
  var self = this;
  if (event === 'end' || event === 'data') {
    if (!self._scheduled) {
      self._scheduled = true;
      setTimeout(function () {
        if (self.rawBody && self.rawBody.length > 0) self.emit('data', self.rawBody);
        self.emit('end');
      }, 0);
    }
  }
  return this;
};
IncomingMessage.prototype.setEncoding = function () { return this; };
IncomingMessage.prototype.pause = function () { return this; };
IncomingMessage.prototype.resume = function () { return this; };
IncomingMessage.prototype.destroy = function () { return this; };

function ServerResponse(connId) {
  EventEmitter.call(this);
  this._connId = connId;
  this._headers = {};
  this._sent = false;
  this.statusCode = 200;
  this.statusMessage = null;
  this.headersSent = false;
  this.finished = false;
  // trpc's node-http adapter streams the body with `while(...){ if(!res.writable)
  // break; res.write(chunk) }` — without this flag res.writable is undefined, the
  // loop breaks before the first write, and every response goes out with an empty
  // body (200 but 0 bytes → every client widget stuck on its loading skeleton).
  this.writable = true;
  this.socket = { destroy: function () {} };
}
ServerResponse.prototype = Object.create(EventEmitter.prototype);
ServerResponse.prototype.constructor = ServerResponse;

ServerResponse.prototype.setHeader = function (name, value) {
  this._headers[String(name).toLowerCase()] = value;
  return this;
};
ServerResponse.prototype.getHeader = function (name) {
  return this._headers[String(name).toLowerCase()];
};
ServerResponse.prototype.removeHeader = function (name) {
  delete this._headers[String(name).toLowerCase()];
  return this;
};
ServerResponse.prototype.getHeaders = function () { return this._headers; };
ServerResponse.prototype.hasHeader = function (name) {
  return this._headers[String(name).toLowerCase()] !== undefined;
};
ServerResponse.prototype.writeHead = function (status, reasonOrHeaders, maybeHeaders) {
  this.statusCode = status;
  var headers = maybeHeaders;
  if (reasonOrHeaders && typeof reasonOrHeaders === 'object') headers = reasonOrHeaders;
  else if (typeof reasonOrHeaders === 'string') this.statusMessage = reasonOrHeaders;
  if (headers) {
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) this.setHeader(keys[i], headers[keys[i]]);
  }
  return this;
};
// The status line + headers, sent exactly once. Everything below is built on
// this: the response used to be buffered whole and written by end(), so a
// handler that flushed headers and then kept the connection open (SSE, long
// poll, `res.flushHeaders()` on its own) sent NOTHING until it finished, and a
// client waiting on those headers waited forever.
ServerResponse.prototype._sendHeaders = function () {
  if (this.headersSent) return;
  var body = this._headers;
  // Without a declared length the body has to be framed some other way, or the
  // client cannot tell a slow response from a finished one. Chunked is that
  // framing; it is chosen HERE because once headers are out the choice cannot
  // be revised.
  if (body['content-length'] === undefined && this._streaming) {
    this.setHeader('Transfer-Encoding', 'chunked');
    this._chunked = true;
  }
  var reason = this.statusMessage || STATUS_CODES[this.statusCode] || 'OK';
  var out = 'HTTP/1.1 ' + this.statusCode + ' ' + reason + '\r\n';
  var names = Object.keys(this._headers);
  for (var i = 0; i < names.length; i++) {
    var v = this._headers[names[i]];
    if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) out += names[i] + ': ' + v[j] + '\r\n';
    } else {
      out += names[i] + ': ' + v + '\r\n';
    }
  }
  if (this._headers['connection'] === undefined) out += 'Connection: close\r\n';
  out += '\r\n';
  __tcpSend(this._connId, out);
  this.headersSent = true;
};
// Node internal that compression and other middleware call to force the status
// line + headers out before streaming a body.
ServerResponse.prototype._implicitHeader = function () {
  this._streaming = true;
  this._sendHeaders();
};
// Idempotent, which node's own test asserts by calling it twice.
ServerResponse.prototype.flushHeaders = function () {
  this._streaming = true;
  this._sendHeaders();
};
ServerResponse.prototype.writeContinue = function () {};
function chunkToString(chunk) {
  if (chunk == null) return '';
  // express passes a Buffer to res.end; String(buffer) would give [object Object]
  if (chunk instanceof Uint8Array && typeof chunk.toString === 'function') return chunk.toString();
  return String(chunk);
}
ServerResponse.prototype.write = function (chunk, encoding, cb) {
  if (typeof encoding === 'function') { cb = encoding; }
  var text = chunkToString(chunk);
  if (this.headersSent) {
    // Headers already went out, so this chunk has to go out too — buffering it
    // would strand a client that is waiting on it.
    if (this._chunked) {
      if (text.length > 0) __tcpSend(this._connId, __byteLength(text).toString(16) + '\r\n' + text + '\r\n');
    } else {
      __tcpSend(this._connId, text);
    }
  } else {
    // Not yet committed: hold it, so a handler that writes then ends still gets
    // an exact Content-Length rather than being forced into chunked framing.
    this._pending = (this._pending || '') + text;
  }
  if (typeof cb === 'function') cb();
  return true;
};
ServerResponse.prototype.end = function (chunk, encoding, cb) {
  if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
  if (this._sent) { if (cb) cb(); return this; }
  var body = (this._pending || '') + chunkToString(chunk);
  // Streaming already started: the framing is fixed, so finish it rather than
  // re-sending a header block.
  if (this.headersSent) {
    if (this._chunked) {
      if (body.length > 0) __tcpSend(this._connId, __byteLength(body).toString(16) + '\r\n' + body + '\r\n');
      __tcpSend(this._connId, '0\r\n\r\n');
    } else if (body.length > 0) {
      __tcpSend(this._connId, body);
    }
    __tcpClose(this._connId);
    this._sent = true;
    this.finished = true;
    this.writable = false;
    this.emit('finish');
    this.emit('close');
    if (cb) cb();
    return this;
  }
  if (this.getHeader('content-length') === undefined) {
    // byte count, not code-point count — see fs.makeStats. A short Content-Length
    // makes the client stop reading mid-body, which is what turned served fonts
    // into "incorrect file size in WOFF header".
    this.setHeader('Content-Length', __byteLength(body));
  }
  var reason = this.statusMessage || STATUS_CODES[this.statusCode] || 'OK';
  var out = 'HTTP/1.1 ' + this.statusCode + ' ' + reason + '\r\n';
  var names = Object.keys(this._headers);
  for (var i = 0; i < names.length; i++) {
    var v = this._headers[names[i]];
    if (Array.isArray(v)) {
      for (var j = 0; j < v.length; j++) out += names[i] + ': ' + v[j] + '\r\n';
    } else {
      out += names[i] + ': ' + v + '\r\n';
    }
  }
  out += 'Connection: close\r\n\r\n' + body;
  __tcpSend(this._connId, out);
  __tcpClose(this._connId);
  this._sent = true;
  this.headersSent = true;
  this.finished = true;
  this.writable = false;
  this.emit('finish');
  this.emit('close');
  if (cb) cb();
  return this;
};

function Server(handler) {
  // Callable without `new`, as node's constructors are: a great deal of code
  // says `http.Server(handler)` and then `.listen(...)`, which answered
  // undefined here and failed one property read later with no hint of why.
  if (!(this instanceof Server)) return new Server(handler);
  EventEmitter.call(this);
  this._handler = handler;
  this._listenerId = -1;
  this.listening = false;
}
Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.constructor = Server;

Server.prototype.listen = function (port, hostOrCb, maybeCb) {
  // listen(port[, host[, backlog]][, callback]): the callback is the trailing
  // function argument, whatever position it lands in.
  var cb;
  for (var ci = arguments.length - 1; ci >= 0; ci--) {
    if (typeof arguments[ci] === 'function') { cb = arguments[ci]; break; }
  }
  var p = typeof port === 'object' && port !== null ? port.port : port;
  this._listenerId = __tcpListen(Number(p) || 0);
  if (this._listenerId < 0) {
    var err = new Error('EADDRINUSE: failed to bind port ' + p);
    err.code = 'EADDRINUSE';
    // node exits on an unhandled 'error' event. Swallowing it left the process
    // running, never firing the listen callback, while an OLDER process on the
    // port answered requests — the failure looked like a hang in unrelated code.
    if (this.listenerCount && this.listenerCount('error') > 0) {
      this.emit('error', err);
      return this;
    }
    throw err;
  }
  // The OS picks the port when 0 is requested, and address() has to report the
  // one actually bound rather than the one asked for.
  var bound = __tcpPort(this._listenerId);
  this._port = bound > 0 ? bound : (Number(p) || 0);
  this.listening = true;
  // registered natively so the event loop can find and service it
  __httpRegister(this);
  // A one-shot 'listening' listener rather than a bare callback: that is how
  // node gives it `this` === the server, and the emit is deferred so nothing
  // observes 'listening' before listen() has returned.
  if (cb) this.once('listening', cb);
  var self = this;
  setTimeout(function () { self.emit('listening'); }, 0);
  return this;
};

Server.prototype.address = function () {
  return { address: '0.0.0.0', family: 'IPv4', port: this._port || 0 };
};

Server.prototype.close = function (cb) {
  this.listening = false;
  __httpUnregister(this);
  if (cb) this.once('close', cb);
  var self = this;
  setTimeout(function () { self.emit('close'); }, 0);
  return this;
};

// Accept one connection and run the handler. Called by the event loop, which
// passes mayBlock=true only when it is idle enough to park on the listener —
// a blocking accept stalls timers/microtasks/fetch servicing until the next
// connection, so it must never happen while other work is pending.
Server.prototype._serveOnce = function (mayBlock) {
  var connId = __tcpAccept(this._listenerId, mayBlock);
  if (connId < 0) return false;
  var raw = __tcpRecv(connId);
  if (!raw || raw.length === 0) { __tcpClose(connId); return true; }
  var parsed = parseRequest(raw);
  var req = new IncomingMessage(parsed, connId);
  var res = new ServerResponse(connId);
  this.emit('request', req, res);
  if (this._handler) this._handler(req, res);
  return true;
};

function createServer(optionsOrHandler, maybeHandler) {
  var handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
  return new Server(handler);
}

exports.createServer = createServer;
exports.Server = Server;
exports.IncomingMessage = IncomingMessage;
exports.ServerResponse = ServerResponse;
exports.STATUS_CODES = STATUS_CODES;
exports.METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
exports.globalAgent = {};
exports.Agent = function Agent() {};

// --- client -----------------------------------------------------------------
// Built on __httpFetchAsync, the same native the global fetch uses, rather than
// on a second raw connect/read path. That buys TLS and redirects for free and
// costs the socket-level control node exposes: `req.socket` is not a real
// socket, and a test that manipulates the connection underneath the request
// will not find one.
//
// Being absent was worse than being partial. `http.request` threw, so a client
// test would start its server, throw inside the response callback, and then sit
// on a live listener until the harness killed it: the failure surfaced as a
// TIMEOUT, which reads like an event-loop bug rather than a missing API.

function ClientResponse(status, statusMessage, headers, body) {
  EventEmitter.call(this);
  this.statusCode = status;
  this.statusMessage = statusMessage;
  this.headers = headers;
  this.rawHeaders = [];
  for (var k in headers) { this.rawHeaders.push(k); this.rawHeaders.push(headers[k]); }
  this.httpVersion = '1.1';
  this.complete = true;
  this._body = body;
}
ClientResponse.prototype = Object.create(EventEmitter.prototype);
ClientResponse.prototype.constructor = ClientResponse;
ClientResponse.prototype.setEncoding = function () { return this; };
ClientResponse.prototype.resume = function () { return this; };
ClientResponse.prototype.pause = function () { return this; };
ClientResponse.prototype.destroy = function () { return this; };
ClientResponse.prototype.pipe = function (dest) {
  if (this._body.length > 0 && dest.write) dest.write(this._body);
  if (dest.end) dest.end();
  return dest;
};
// The body is already in hand, so the stream is replayed on the next tick: a
// caller that attaches its handlers after the callback returns still sees it.
ClientResponse.prototype._deliver = function () {
  var self = this;
  setTimeout(function () {
    if (self._body.length > 0) self.emit('data', self._body);
    self.emit('end');
    self.emit('close');
  }, 0);
};

function parseRawResponse(raw) {
  var sep = raw.indexOf('\r\n\r\n');
  var head = sep < 0 ? raw : raw.slice(0, sep);
  var body = sep < 0 ? '' : raw.slice(sep + 4);
  var lines = head.split('\r\n');
  var first = (lines[0] || 'HTTP/1.1 200 OK').split(' ');
  var status = parseInt(first[1], 10) || 200;
  var message = first.slice(2).join(' ') || STATUS_CODES[status] || '';
  var headers = {};
  for (var i = 1; i < lines.length; i++) {
    var c = lines[i].indexOf(':');
    if (c > 0) headers[lines[i].slice(0, c).trim().toLowerCase()] = lines[i].slice(c + 1).trim();
  }
  // Chunked responses arrive with their framing intact, and every consumer here
  // wants the decoded body: leaving it in delivers "6\r\npart1|\r\n0\r\n\r\n"
  // to res.on('data'). The framing is stripped here rather than in each caller.
  if (String(headers['transfer-encoding'] || '').toLowerCase().indexOf('chunked') >= 0) {
    body = dechunk(body);
    delete headers['transfer-encoding'];
  }
  return { status: status, message: message, headers: headers, body: body };
}

// size-in-hex CRLF, data, CRLF, ... terminated by a zero-length chunk. A
// malformed stream stops the decode rather than looping: a bad length would
// otherwise never advance and hang the parser.
function dechunk(raw) {
  var out = '';
  var i = 0;
  while (i < raw.length) {
    var nl = raw.indexOf('\r\n', i);
    if (nl < 0) break;
    var sizeLine = raw.slice(i, nl);
    var semi = sizeLine.indexOf(';');       // chunk extensions, ignored
    if (semi >= 0) sizeLine = sizeLine.slice(0, semi);
    var n = parseInt(sizeLine.trim(), 16);
    if (isNaN(n) || n < 0) break;
    if (n === 0) break;
    out += raw.slice(nl + 2, nl + 2 + n);
    i = nl + 2 + n + 2;
  }
  return out;
}

function ClientRequest(options, cb) {
  if (!(this instanceof ClientRequest)) return new ClientRequest(options, cb);
  EventEmitter.call(this);
  var opts = typeof options === 'string' ? parseUrlish(options) : (options || {});
  this._method = (opts.method || 'GET').toUpperCase();
  this._headers = {};
  var given = opts.headers || {};
  for (var k in given) this._headers[k] = given[k];
  var host = opts.hostname || opts.host || '127.0.0.1';
  var port = opts.port === undefined || opts.port === null ? '' : ':' + opts.port;
  var path = opts.path || '/';
  var proto = opts.protocol === 'https:' ? 'https' : 'http';
  this._url = opts.href || (proto + '://' + host + port + path);
  this._chunks = [];
  this.finished = false;
  // Not a real socket. Exposed because a great deal of code reads
  // req.socket/req.connection to decide whether a request is still live.
  this.socket = null;
  this.connection = null;
  if (cb) this.once('response', cb);
}
ClientRequest.prototype = Object.create(EventEmitter.prototype);
ClientRequest.prototype.constructor = ClientRequest;

ClientRequest.prototype.setHeader = function (name, value) { this._headers[name] = value; return this; };
ClientRequest.prototype.getHeader = function (name) { return this._headers[name]; };
ClientRequest.prototype.removeHeader = function (name) { delete this._headers[name]; return this; };
ClientRequest.prototype.setTimeout = function () { return this; };
ClientRequest.prototype.setNoDelay = function () { return this; };
ClientRequest.prototype.setSocketKeepAlive = function () { return this; };
ClientRequest.prototype.abort = function () { this.destroy(); };
ClientRequest.prototype.destroy = function () {
  if (this.destroyed) return this;
  this.destroyed = true;
  return this;
};
ClientRequest.prototype.write = function (chunk, encoding, cb) {
  if (chunk !== undefined && chunk !== null) this._chunks.push(String(chunk));
  if (typeof encoding === 'function') cb = encoding;
  if (cb) setTimeout(cb, 0);
  return true;
};
ClientRequest.prototype.end = function (chunk, encoding, cb) {
  if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
  else if (typeof encoding === 'function') { cb = encoding; }
  if (chunk !== undefined && chunk !== null) this._chunks.push(String(chunk));
  if (this.finished) return this;
  this.finished = true;
  var self = this;
  var body = this._chunks.join('');
  var headerRaw = '';
  for (var h in this._headers) headerRaw += h + ': ' + this._headers[h] + '\n';
  __httpFetchAsync(this._method, this._url, headerRaw, body).then(function (res) {
    if (self.destroyed) return;
    if (res.length > 0 && res.charAt(0) === 'E') {
      var err = new Error(res.slice(1));
      err.code = 'ECONNREFUSED';
      self.emit('error', err);
      return;
    }
    var parsed = parseRawResponse(res.length > 0 ? res.slice(1) : '');
    var response = new ClientResponse(parsed.status, parsed.message, parsed.headers, parsed.body);
    self.emit('response', response);
    response._deliver();
  });
  if (cb) setTimeout(cb, 0);
  return this;
};

// `http.request("http://host:port/path")` — the string form, split without a
// URL parser so this module keeps no dependency on one.
function parseUrlish(u) {
  var s = String(u);
  var proto = s.indexOf('://') > 0 ? s.slice(0, s.indexOf(':') + 1) : 'http:';
  var rest = s.indexOf('://') > 0 ? s.slice(s.indexOf('://') + 3) : s;
  var slash = rest.indexOf('/');
  var hostport = slash < 0 ? rest : rest.slice(0, slash);
  var path = slash < 0 ? '/' : rest.slice(slash);
  var colon = hostport.lastIndexOf(':');
  return {
    protocol: proto,
    hostname: colon > 0 ? hostport.slice(0, colon) : hostport,
    port: colon > 0 ? hostport.slice(colon + 1) : undefined,
    path: path,
    href: s,
  };
}

exports.ClientRequest = ClientRequest;
exports.IncomingMessage = IncomingMessage;
exports.request = function (options, maybeOptions, cb) {
  if (typeof maybeOptions === 'function') { cb = maybeOptions; maybeOptions = undefined; }
  if (typeof options === 'string' && maybeOptions !== undefined) {
    var base = parseUrlish(options);
    for (var k in maybeOptions) base[k] = maybeOptions[k];
    base.href = undefined;
    options = base;
  }
  return new ClientRequest(options, cb);
};
exports.get = function (options, maybeOptions, cb) {
  var req = exports.request(options, maybeOptions, cb);
  req.end();
  return req;
};
