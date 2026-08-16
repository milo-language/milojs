// node:tls — the surface a package reads at require time, plus honest failures
// for the parts that need a real TLS stack.
//
// `ws` opens with `const tls = require('tls')` and only reaches `tls.connect`
// for a `wss://` client, so the module simply EXISTING is what unblocks a
// WebSocket server. Anything that actually needs to negotiate a session throws
// with a message naming the gap, rather than returning a socket that silently
// never connects.
const net = require('net');
const EventEmitter = require('events').EventEmitter;

function notImplemented(what) {
  const e = new Error(
    what + ' is not implemented under milojs: there is no TLS stack, so an ' +
    'encrypted connection cannot be negotiated. Terminate TLS in front (nginx, ' +
    'a load balancer) and speak plain HTTP to this process.'
  );
  e.code = 'ERR_TLS_NOT_IMPLEMENTED';
  return e;
}

// A TLSSocket exists so `instanceof` checks and prototype patching resolve. It
// is never handed a live connection here.
function TLSSocket(socket, options) {
  if (!(this instanceof TLSSocket)) return new TLSSocket(socket, options);
  EventEmitter.call(this);
  this._parent = socket || null;
  this.encrypted = true;
  this.authorized = false;
  this.authorizationError = null;
}
TLSSocket.prototype = Object.create(EventEmitter.prototype);
TLSSocket.prototype.constructor = TLSSocket;
TLSSocket.prototype.getPeerCertificate = function () { return {}; };
TLSSocket.prototype.getCipher = function () { return null; };
TLSSocket.prototype.getProtocol = function () { return null; };
TLSSocket.prototype.setKeepAlive = function () { return this; };
TLSSocket.prototype.setNoDelay = function () { return this; };
TLSSocket.prototype.setTimeout = function () { return this; };
TLSSocket.prototype.destroy = function () { this.emit('close'); return this; };
TLSSocket.prototype.end = function () { this.emit('close'); return this; };

function Server(options, listener) {
  if (!(this instanceof Server)) return new Server(options, listener);
  EventEmitter.call(this);
}
Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.constructor = Server;
Server.prototype.listen = function () { throw notImplemented('tls.Server#listen'); };
Server.prototype.close = function (cb) { if (cb) cb(); return this; };
Server.prototype.address = function () { return null; };

exports.TLSSocket = TLSSocket;
exports.Server = Server;
exports.connect = function () { throw notImplemented('tls.connect'); };
exports.createServer = function () { throw notImplemented('tls.createServer'); };
exports.createSecurePair = function () { throw notImplemented('tls.createSecurePair'); };

// A secure context is a handle a caller stores and passes back; it needs to
// exist and be distinguishable, not to hold key material.
exports.createSecureContext = function (options) {
  return { context: {}, options: options || {} };
};
exports.SecureContext = function SecureContext() {};

// checkServerIdentity is pure string work over a certificate a caller supplies,
// so it is implemented rather than stubbed: hostname against CN and subjectAltName.
exports.checkServerIdentity = function (hostname, cert) {
  const host = String(hostname).toLowerCase();
  const names = [];
  if (cert && cert.subjectaltname) {
    const parts = String(cert.subjectaltname).split(/,\s*/);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].indexOf('DNS:') === 0) names.push(parts[i].slice(4).toLowerCase());
    }
  }
  if (!names.length && cert && cert.subject && cert.subject.CN) {
    names.push(String(cert.subject.CN).toLowerCase());
  }
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (n === host) return undefined;
    // one leading wildcard label, matching a single label of the hostname
    if (n.indexOf('*.') === 0) {
      const suffix = n.slice(1);
      const at = host.indexOf('.');
      if (at > 0 && host.slice(at) === suffix) return undefined;
    }
  }
  const e = new Error(
    "Hostname/IP does not match certificate's altnames: Host: " + host +
    '. is not in the cert\'s altnames: ' + (cert && cert.subjectaltname ? cert.subjectaltname : '<none>')
  );
  e.code = 'ERR_TLS_CERT_ALTNAME_INVALID';
  e.host = hostname;
  e.cert = cert;
  return e;
};

exports.rootCertificates = [];
exports.DEFAULT_ECDH_CURVE = 'auto';
exports.DEFAULT_MAX_VERSION = 'TLSv1.3';
exports.DEFAULT_MIN_VERSION = 'TLSv1.2';
exports.DEFAULT_CIPHERS = '';
exports.CLIENT_RENEG_LIMIT = 3;
exports.CLIENT_RENEG_WINDOW = 600;
exports.getCiphers = function () { return []; };
exports.convertALPNProtocols = function () {};
