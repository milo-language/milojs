// node:fs — the synchronous read surface, over the runtime's file natives.
"use strict";

// Node validates every argument before it touches the filesystem and throws a
// coded error, which its tests assert on directly (`fs.chownSync(1, 1, 1)` must
// be ERR_INVALID_ARG_TYPE, not a stringified 1 reaching the syscall). Without
// this the assertion fails before the test reaches any real behaviour.
var _err = require("_errors");
var _isEncoding = require("buffer").Buffer.isEncoding;

// The options argument accepts a string, which is shorthand for { encoding }.
// An unrecognised one is ERR_INVALID_ARG_VALUE, not a silent fallback to utf8.
function checkOptions(options, name) {
  if (options === undefined || options === null) return;
  if (typeof options === "string") {
    if (!_isEncoding(options)) {
      throw _err.ERR_INVALID_ARG_VALUE(name || "options", options, "is invalid");
    }
    return;
  }
  if (typeof options === "function") return;
  if (typeof options !== "object") {
    throw _err.ERR_INVALID_ARG_TYPE(name || "options", ["string", "Object"], options);
  }
  if (options.encoding !== undefined && options.encoding !== null &&
      !_isEncoding(options.encoding)) {
    throw _err.ERR_INVALID_ARG_VALUE("options.encoding", options.encoding, "is invalid");
  }
}

function readFileSync(p, opts) {
  _err.validatePath(p, "path");
  checkOptions(opts);
  var s = __readFileSync(p);
  if (s === undefined || s === null) {
    // node attaches .code so callers can branch on ENOENT rather than parse the
    // message — a very common pattern (fs.readFileSync in a try/catch).
    var e = new Error("ENOENT: no such file or directory, open '" + p + "'");
    e.code = "ENOENT"; e.errno = -2; e.syscall = "open"; e.path = p;
    throw e;
  }
  return s;
}

function existsSync(p) {
  // exists is the one entry point node does NOT throw from: it answers false
  // for anything it cannot interpret as a path.
  try { _err.validatePath(p, "path"); } catch (e) { return false; }
  return __fileExists(p);
}

function readFile(p, opts, cb) {
  var fn = typeof opts === "function" ? opts : cb;
  _err.validatePath(p, "path");
  if (typeof opts !== "function") checkOptions(opts);
  try {
    var data = readFileSync(p);
    if (fn) { fn(null, data); }
  } catch (e) {
    if (fn) { fn(e, undefined); }
  }
}

function makeStats(p) {
  // real S_IFDIR check — the old "readFile returns null ⇒ directory" heuristic
  // was wrong on macOS, where reading a directory yields "" (so every dir
  // reported isDirectory() === false, breaking recursive walks).
  var isDir = __isDir(p);
  var content = isDir ? null : __readFileSync(p);
  // NOT content.length: that counts code points, so any file whose bytes decode
  // as multi-byte UTF-8 (every font, image, archive) reports short and the
  // Content-Length built from it truncates the response.
  var size = content ? __byteLength(content) : 0;
  var now = Date.now();
  return {
    size: size,
    mtimeMs: now, ctimeMs: now, atimeMs: now, birthtimeMs: now,
    mtime: new Date(now), ctime: new Date(now), atime: new Date(now), birthtime: new Date(now),
    mode: 33188, ino: 0, dev: 0, nlink: 1, uid: 0, gid: 0, blksize: 4096, blocks: 0,
    isFile: function () { return !isDir; },
    isDirectory: function () { return isDir; },
    isSymbolicLink: function () { return false; },
    isBlockDevice: function () { return false; },
    isCharacterDevice: function () { return false; },
    isFIFO: function () { return false; },
    isSocket: function () { return false; }
  };
}

function statSync(p, opts) {
  if (!__fileExists(p)) {
    var e = new Error("ENOENT: no such file or directory, stat '" + p + "'");
    e.code = "ENOENT";
    e.errno = -2;
    e.path = p;
    throw e;
  }
  return makeStats(p);
}

function stat(p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  try { var st = statSync(p); if (cb) cb(null, st); }
  catch (e) { if (cb) cb(e); }
}

exports.statSync = statSync;
exports.lstatSync = statSync;
exports.stat = stat;
exports.lstat = stat;
exports.readFileSync = readFileSync;
exports.existsSync = existsSync;
exports.readFile = readFile;

// fs.promises — the async surface the React SPA fallback uses (readFile). Backed
// by the same sync natives; each call resolves/rejects on the microtask queue.
exports.promises = {
  readFile: function (p, opts) {
    return new Promise(function (resolve, reject) {
      var s = __readFileSync(String(p));
      if (s === undefined || s === null) {
        var e = new Error("ENOENT: no such file or directory, open '" + p + "'");
        e.code = "ENOENT"; e.path = p;
        reject(e);
      } else {
        resolve(s);
      }
    });
  },
  writeFile: function (p, data) {
    return new Promise(function (resolve, reject) {
      if (__writeFileSync(String(p), String(data), false)) resolve();
      else reject(new Error("ENOENT: cannot write '" + p + "'"));
    });
  },
  stat: function (p) {
    return new Promise(function (resolve, reject) {
      try { resolve(statSync(p)); } catch (e) { reject(e); }
    });
  },
  access: function (p) {
    return new Promise(function (resolve, reject) {
      if (__fileExists(String(p))) resolve();
      else { var e = new Error("ENOENT: " + p); e.code = "ENOENT"; reject(e); }
    });
  }
};
exports.promises.lstat = exports.promises.stat;

// --- directory + file management (over the runtime's fs natives) -------------
exports.readdirSync = function (p, opts) {
  _err.validatePath(p, "path");
  checkOptions(opts);
  var names = __readdirSync(String(p));
  if (names === null || names === undefined) {
    var e = new Error("ENOENT: no such file or directory, scandir '" + p + "'");
    e.code = "ENOENT"; e.path = p;
    throw e;
  }
  return names;
};
exports.readdir = function (p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  _err.validatePath(p, "path");
  if (typeof optsOrCb !== 'function') checkOptions(optsOrCb);
  try { var r = exports.readdirSync(p); if (cb) cb(null, r); }
  catch (e) { if (cb) cb(e); }
};

exports.mkdirSync = function (p, opts) {
  _err.validatePath(p, "path");
  p = String(p);
  if (opts && opts.recursive) {
    // create every missing ancestor, like `mkdir -p`
    var parts = p.split('/');
    var cur = p[0] === '/' ? '' : '.';
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;
      cur = cur + '/' + parts[i];
      if (!__fileExists(cur)) __mkdirSync(cur);
    }
    return undefined;
  }
  if (!__mkdirSync(p)) {
    var e = new Error("EEXIST/ENOENT: cannot mkdir '" + p + "'");
    e.code = __fileExists(p) ? "EEXIST" : "ENOENT"; e.path = p;
    throw e;
  }
};
exports.mkdir = function (p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  var opts = typeof optsOrCb === 'object' ? optsOrCb : undefined;
  try { exports.mkdirSync(p, opts); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};

exports.unlinkSync = function (p) {
  if (!__unlinkSync(String(p))) {
    var e = new Error("ENOENT: no such file or directory, unlink '" + p + "'");
    e.code = "ENOENT"; e.path = p;
    throw e;
  }
};
exports.unlink = function (p, cb) {
  try { exports.unlinkSync(p); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};

exports.rmdirSync = function (p) {
  if (!__rmdirSync(String(p))) {
    var e = new Error("ENOENT: cannot rmdir '" + p + "'");
    e.code = "ENOENT"; e.path = p;
    throw e;
  }
};
// fs.rmSync(path, {recursive, force}): recursively delete a tree, or a file.
exports.rmSync = function (p, opts) {
  p = String(p);
  var recursive = opts && opts.recursive;
  var force = opts && opts.force;
  if (!__fileExists(p)) { if (force) return; var e = new Error("ENOENT: " + p); e.code = "ENOENT"; throw e; }
  // a path that can't be read as a file is a directory (matches statSync)
  if (!statSync(p).isDirectory()) {
    __unlinkSync(p);
    return;
  }
  var names = __readdirSync(p) || [];
  if (!recursive && names.length > 0) throw new Error("ENOTEMPTY: directory not empty '" + p + "'");
  for (var i = 0; i < names.length; i++) exports.rmSync(p + '/' + names[i], opts);
  __rmdirSync(p);
};
exports.rm = function (p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  var opts = typeof optsOrCb === 'object' ? optsOrCb : undefined;
  try { exports.rmSync(p, opts); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};

exports.renameSync = function (from, to) {
  if (!__renameSync(String(from), String(to))) {
    var e = new Error("ENOENT: cannot rename '" + from + "' -> '" + to + "'");
    e.code = "ENOENT"; throw e;
  }
};
exports.rename = function (from, to, cb) {
  try { exports.renameSync(from, to); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};

exports.copyFileSync = function (from, to) {
  var data = __readFileSync(String(from));
  if (data === undefined || data === null) { var e = new Error("ENOENT: " + from); e.code = "ENOENT"; throw e; }
  if (!__writeFileSync(String(to), data, false)) throw new Error("ENOENT: cannot write '" + to + "'");
};
exports.copyFile = function (from, to, flagsOrCb, maybeCb) {
  var cb = typeof flagsOrCb === 'function' ? flagsOrCb : maybeCb;
  try { exports.copyFileSync(from, to); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};

exports.promises.readdir = function (p) { return new Promise(function (res, rej) { try { res(exports.readdirSync(p)); } catch (e) { rej(e); } }); };
exports.promises.mkdir = function (p, opts) { return new Promise(function (res, rej) { try { exports.mkdirSync(p, opts); res(); } catch (e) { rej(e); } }); };
exports.promises.unlink = function (p) { return new Promise(function (res, rej) { try { exports.unlinkSync(p); res(); } catch (e) { rej(e); } }); };
exports.promises.rm = function (p, opts) { return new Promise(function (res, rej) { try { exports.rmSync(p, opts); res(); } catch (e) { rej(e); } }); };
exports.promises.rename = function (a, b) { return new Promise(function (res, rej) { try { exports.renameSync(a, b); res(); } catch (e) { rej(e); } }); };
exports.promises.copyFile = function (a, b) { return new Promise(function (res, rej) { try { exports.copyFileSync(a, b); res(); } catch (e) { rej(e); } }); };

exports.writeFileSync = function (path, data) {
  if (!__writeFileSync(String(path), String(data), false)) {
    throw new Error("ENOENT: cannot write '" + path + "'");
  }
};
exports.appendFileSync = function (path, data) {
  if (!__writeFileSync(String(path), String(data), true)) {
    throw new Error("ENOENT: cannot append to '" + path + "'");
  }
};
exports.writeFile = function (path, data, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  var ok = __writeFileSync(String(path), String(data), false);
  if (cb) cb(ok ? null : new Error("ENOENT: cannot write '" + path + "'"));
};

// express's `send` streams static files with fs.createReadStream(path, {start,end})
// and pipes the result to the response. There is no async file IO here, so read
// the whole file synchronously and hand it over (sliced for range requests) on the
// next tick, which is when send has finished attaching its error/open/pipe wiring.
exports.createReadStream = function (path, options) {
  var Readable = require("stream").Readable;
  var rs = new Readable();
  rs.path = path;
  rs.bytesRead = 0;
  var start = options && typeof options.start === "number" ? options.start : 0;
  var hasEnd = options && typeof options.end === "number";
  var end = hasEnd ? options.end : undefined;
  setTimeout(function () {
    var content = __readFileSync(String(path));
    if (content === undefined || content === null) {
      var e = new Error("ENOENT: no such file or directory, open '" + path + "'");
      e.code = "ENOENT";
      e.path = path;
      rs.emit("error", e);
      return;
    }
    if (start > 0 || hasEnd) {
      // send passes an inclusive end offset for HTTP range requests
      content = content.slice(start, hasEnd ? end + 1 : content.length);
    }
    rs.bytesRead = content.length;
    rs.emit("open", 0);
    rs.push(content);
    rs.push(null);
  }, 0);
  rs.close = function () { return this; };
  rs.destroy = function () { this.emit("close"); return this; };
  return rs;
};

exports.createWriteStream = function (path) {
  var Writable = require("stream").Writable;
  var ws = new Writable();
  var buf = "";
  ws._writeImpl = function (chunk, enc, cb) {
    buf += chunk instanceof Uint8Array && typeof chunk.toString === "function" ? chunk.toString() : String(chunk);
    if (cb) cb();
  };
  ws.on("finish", function () { __writeFileSync(String(path), buf, false); });
  ws.path = path;
  return ws;
};

// --- the callback/sync surface a promisify target needs ---------------------
// better-sqlite3 opens with `promisify(fs.access)`, and util.promisify rejects a
// non-function, so a missing member here is not a missing feature, it is a
// module that will not load. These are the ones node has that this shim did not.

// fs.constants: the mode bits access() takes. There is no real permission check
// behind this shim, so access() reports existence for every mode.
exports.constants = {
  F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1,
  COPYFILE_EXCL: 1, COPYFILE_FICLONE: 2, COPYFILE_FICLONE_FORCE: 4,
  O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_EXCL: 128,
  O_TRUNC: 512, O_APPEND: 1024
};

exports.accessSync = function (p, mode) {
  if (!__fileExists(String(p))) {
    var e = new Error("ENOENT: no such file or directory, access '" + p + "'");
    e.code = "ENOENT"; e.path = p; e.syscall = "access"; e.errno = -2;
    throw e;
  }
};
exports.access = function (p, modeOrCb, maybeCb) {
  var cb = typeof modeOrCb === 'function' ? modeOrCb : maybeCb;
  try { exports.accessSync(p); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};

exports.appendFileSync = function (p, data, opts) {
  var prev = __fileExists(String(p)) ? __readFileSync(String(p)) : "";
  if (prev === undefined || prev === null) prev = "";
  __writeFileSync(String(p), prev + String(data), false);
};
exports.appendFile = function (p, data, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  try { exports.appendFileSync(p, data); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};

// exists() is deprecated in node and takes a BOOLEAN callback, not (err, ok)
exports.existsSync = existsSync;
exports.exists = function (p, cb) { if (cb) cb(existsSync(p)); };

exports.realpathSync = function (p) { return String(p); };
exports.realpath = function (p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  if (cb) cb(null, String(p));
};
exports.realpathSync.native = exports.realpathSync;
exports.realpath.native = exports.realpath;

// no permission model behind the shim: these succeed without doing anything
// These are no-ops on this runtime, but the ARGUMENT CHECKS are not optional:
// node's tests for them assert only that bad input throws the right code, so a
// silent no-op fails every one of them.
function checkChown(p, uid, gid) {
  _err.validatePath(p, "path");
  _err.validateInteger(uid, "uid", -1, 4294967295);
  _err.validateInteger(gid, "gid", -1, 4294967295);
}
function checkChmod(p, mode) {
  _err.validatePath(p, "path");
  if (typeof mode === "string") {
    var parsed = parseInt(mode, 8);
    if (isNaN(parsed)) throw _err.ERR_INVALID_ARG_VALUE("mode", mode, "must be a 32-bit unsigned integer or an octal string");
    mode = parsed;
  }
  _err.validateInteger(mode, "mode", 0, 4294967295);
}
function checkTime(value, name) {
  if (typeof value === "number") {
    if (isNaN(value) || !isFinite(value)) throw _err.ERR_INVALID_ARG_TYPE(name, ["number", "string", "Date"], value);
    return;
  }
  if (typeof value === "string" || value instanceof Date) return;
  throw _err.ERR_INVALID_ARG_TYPE(name, ["number", "string", "Date"], value);
}

exports.chmodSync = function (p, mode) { checkChmod(p, mode); };
exports.chmod = function (p, mode, cb) { checkChmod(p, mode); _err.validateCallback(cb); cb(null); };
exports.chownSync = function (p, uid, gid) { checkChown(p, uid, gid); };
exports.chown = function (p, uid, gid, cb) { checkChown(p, uid, gid); _err.validateCallback(cb); cb(null); };
exports.utimesSync = function (p, a, m) { _err.validatePath(p, "path"); checkTime(a, "atime"); checkTime(m, "mtime"); };
exports.utimes = function (p, a, m, cb) { _err.validatePath(p, "path"); checkTime(a, "atime"); checkTime(m, "mtime"); _err.validateCallback(cb); cb(null); };

// rmdir is the pre-rm() spelling; several packages still probe for it
if (!exports.rmdirSync) {
  exports.rmdirSync = function (p, opts) { __rmdirSync(String(p)); };
}
exports.rmdir = function (p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  try { exports.rmdirSync(p); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};

// open/close over a tiny descriptor table. Only enough for code that opens a
// path, reads or writes the whole thing, and closes it.
var _fds = {};
var _nextFd = 3;
exports.openSync = function (p, flags, mode) {
  p = String(p);
  var f = flags === undefined ? "r" : String(flags);
  if (f.indexOf("r") === 0 && !__fileExists(p)) {
    var e = new Error("ENOENT: no such file or directory, open '" + p + "'");
    e.code = "ENOENT"; e.path = p; e.syscall = "open"; e.errno = -2;
    throw e;
  }
  if (f.indexOf("w") === 0) __writeFileSync(p, "", false);
  var fd = _nextFd++;
  _fds[fd] = { path: p, flags: f };
  return fd;
};
exports.open = function (p, flagsOrCb, modeOrCb, maybeCb) {
  var cb = typeof flagsOrCb === 'function' ? flagsOrCb
    : (typeof modeOrCb === 'function' ? modeOrCb : maybeCb);
  try { var fd = exports.openSync(p, typeof flagsOrCb === 'function' ? "r" : flagsOrCb); if (cb) cb(null, fd); }
  catch (e) { if (cb) cb(e); }
};
exports.closeSync = function (fd) { delete _fds[fd]; };
exports.close = function (fd, cb) { delete _fds[fd]; if (cb) cb(null); };
exports.fstatSync = function (fd) {
  var e = _fds[fd];
  if (!e) { var err = new Error("EBADF: bad file descriptor, fstat"); err.code = "EBADF"; throw err; }
  return statSync(e.path);
};

exports.promises.appendFile = function (p, data) {
  return new Promise(function (resolve, reject) {
    try { exports.appendFileSync(p, data); resolve(); } catch (e) { reject(e); }
  });
};
exports.promises.readdir = function (p) {
  return new Promise(function (resolve, reject) {
    try { resolve(exports.readdirSync(p)); } catch (e) { reject(e); }
  });
};
exports.promises.mkdir = function (p, opts) {
  return new Promise(function (resolve, reject) {
    try { resolve(exports.mkdirSync(p, opts)); } catch (e) { reject(e); }
  });
};
exports.promises.unlink = function (p) {
  return new Promise(function (resolve, reject) {
    try { resolve(exports.unlinkSync(p)); } catch (e) { reject(e); }
  });
};
exports.promises.realpath = function (p) { return Promise.resolve(String(p)); };
