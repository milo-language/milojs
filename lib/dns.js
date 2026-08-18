// node:dns. There is no resolver in this runtime, so only the cases that need
// none are answered: a dotted-quad or bracketed IPv6 literal resolves to itself,
// and localhost resolves to loopback. Anything else reports ENOTFOUND rather
// than a plausible-looking address, because a wrong IP is worse than a refusal.
const net = require('net');

const V4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function resolveLiteral(hostname) {
  const h = String(hostname);
  if (h === 'localhost') return { address: '127.0.0.1', family: 4 };
  if (V4.test(h)) return { address: h, family: 4 };
  if (net.isIPv6(h)) return { address: h, family: 6 };
  return null;
}

function notFound(hostname, syscall) {
  const err = new Error(`${syscall} ENOTFOUND ${hostname}`);
  err.code = 'ENOTFOUND';
  err.errno = -3008;
  err.syscall = syscall;
  err.hostname = String(hostname);
  return err;
}

function lookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  const opts = options === null || options === undefined ? {} : options;
  const all = typeof opts === 'object' && opts.all === true;
  const hit = resolveLiteral(hostname);
  setTimeout(() => {
    if (!hit) { callback(notFound(hostname, 'getaddrinfo')); return; }
    if (all) callback(null, [hit]);
    else callback(null, hit.address, hit.family);
  }, 0);
}

function makeResolve(kind) {
  return function (hostname, callback) {
    const hit = resolveLiteral(hostname);
    setTimeout(() => {
      if (!hit || (kind === 4 && hit.family !== 4) || (kind === 6 && hit.family !== 6)) {
        callback(notFound(hostname, 'queryA'));
        return;
      }
      callback(null, [hit.address]);
    }, 0);
  };
}

const promises = {
  lookup(hostname, options) {
    return new Promise((res, rej) => {
      lookup(hostname, options, (err, address, family) => {
        if (err) rej(err);
        else res(typeof address === 'object' ? address : { address, family });
      });
    });
  },
  resolve4(hostname) {
    return new Promise((res, rej) => makeResolve(4)(hostname, (e, a) => (e ? rej(e) : res(a))));
  },
  resolve6(hostname) {
    return new Promise((res, rej) => makeResolve(6)(hostname, (e, a) => (e ? rej(e) : res(a))));
  },
};

class Resolver {
  constructor() {}
  setServers() {}
  getServers() { return []; }
  resolve4(h, cb) { return makeResolve(4)(h, cb); }
  resolve6(h, cb) { return makeResolve(6)(h, cb); }
}

module.exports = {
  lookup, Resolver, promises,
  resolve4: makeResolve(4),
  resolve6: makeResolve(6),
  setServers() {},
  getServers() { return []; },
  setDefaultResultOrder() {},
  getDefaultResultOrder() { return 'verbatim'; },
  ADDRCONFIG: 1024, ALL: 256, V4MAPPED: 8,
  NODATA: 'ENODATA', FORMERR: 'EFORMERR', SERVFAIL: 'ESERVFAIL', NOTFOUND: 'ENOTFOUND',
};
