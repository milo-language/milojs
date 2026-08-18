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

function makeStats(p, useLstat) {
  // Real stat(2) via __statSync. This used to READ THE WHOLE FILE and measure
  // the string just to fill in `size`, which turned fs.statSync on a large file
  // into a full load into memory.
  var info = __statSync(String(p), !!useLstat);
  var isDir = info ? info.isDir : __isDir(p);
  var size = info ? info.size : 0;
  var isLink = info ? info.isSymlink : false;
  // mtime is not available from std/fs's FileInfo yet, so the timestamps are
  // still synthesised. Reported as "now" rather than 0 because code that diffs
  // them against Date.now() (build tools, caches) breaks on an epoch date.
  var now = Date.now();
  return {
    size: size,
    mtimeMs: now, ctimeMs: now, atimeMs: now, birthtimeMs: now,
    mtime: new Date(now), ctime: new Date(now), atime: new Date(now), birthtime: new Date(now),
    mode: info ? info.mode : 33188, ino: 0, dev: 0, nlink: 1, uid: 0, gid: 0,
    blksize: 4096, blocks: Math.ceil(size / 512),
    isFile: function () { return info ? info.isFile : !isDir; },
    isDirectory: function () { return isDir; },
    isSymbolicLink: function () { return isLink; },
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

// node's makeStatsCallback: the callback is required and must be a function.
// Accepting anything else meant fs.stat(path, 'foo') silently did nothing.
function statsCallback(cb) {
  if (typeof cb !== "function") throw _err.ERR_INVALID_ARG_TYPE("cb", "of type function", cb);
  return cb;
}

function stat(p, optsOrCb, maybeCb) {
  var cb = statsCallback(typeof optsOrCb === 'function' ? optsOrCb : maybeCb);
  try { var st = statSync(p); cb(null, st); }
  catch (e) { cb(e); }
}

function lstatSync(p, opts) {
  _err.validatePath(p, "path");
  if (!__fileExists(p) && !__statSync(String(p), true)) {
    var e = new Error("ENOENT: no such file or directory, lstat '" + p + "'");
    e.code = "ENOENT"; e.errno = -2; e.path = p;
    throw e;
  }
  return makeStats(p, true);
}
function lstat(p, optsOrCb, maybeCb) {
  var cb = statsCallback(typeof optsOrCb === 'function' ? optsOrCb : maybeCb);
  try { var r = lstatSync(p); cb(null, r); }
  catch (e) { cb(e); }
}
exports.statSync = statSync;
exports.lstatSync = lstatSync;
exports.stat = stat;
exports.lstat = lstat;
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
    // Name which of the two it was: "EEXIST/ENOENT" in the message meant every
    // report of this failure was ambiguous, and the two have opposite causes
    // (the directory is already there vs. its parent is not).
    var exists = __fileExists(p);
    var e = new Error(exists
      ? "EEXIST: file already exists, mkdir '" + p + "'"
      : "ENOENT: no such file or directory, mkdir '" + p + "'");
    e.code = exists ? "EEXIST" : "ENOENT";
    e.errno = exists ? -17 : -2;
    e.syscall = "mkdir";
    e.path = p;
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
  // lstat, NOT stat: a symlink to a directory must be unlinked, not walked.
  // Following it deletes the TARGET's contents (outside the tree being removed)
  // and then fails to rmdir the link itself, leaving the directory behind — which
  // made every later test that shares a temp dir fail with EEXIST on mkdir.
  var info = __statSync(String(p), true);
  if (!info) { if (force) return; var e = new Error("ENOENT: " + p); e.code = "ENOENT"; throw e; }
  if (!info.isDir) {
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
// --- descriptor-level IO ----------------------------------------------------

var OF = __openFlags();
// node's flag strings. 'x' (O_EXCL) is deliberately absent: only two O_ combos
// are exported portably, so O_EXCL cannot be derived the way CREAT/TRUNC/APPEND
// are, and guessing it wrong silently changes whether an existing file is
// clobbered. An x-flag is rejected rather than quietly treated as its non-x
// cousin.
function flagsToNumber(flags) {
  if (typeof flags === 'number') return flags;
  if (flags === undefined || flags === null) return OF.rdonly;
  switch (String(flags)) {
    case 'r': return OF.rdonly;
    case 'r+': return OF.rdwr;
    case 'rs': case 'sr': return OF.rdonly;
    case 'rs+': case 'sr+': return OF.rdwr;
    case 'w': return OF.wronly | OF.creat | OF.trunc;
    case 'w+': return OF.rdwr | OF.creat | OF.trunc;
    case 'a': return OF.wronly | OF.creat | OF.append;
    case 'a+': return OF.rdwr | OF.creat | OF.append;
  }
  throw _err.ERR_INVALID_ARG_VALUE('flags', flags, 'is invalid');
}

function validateFd(fd) {
  if (typeof fd !== 'number' || Math.floor(fd) !== fd || fd < 0) {
    if (typeof fd !== 'number') throw _err.ERR_INVALID_ARG_TYPE('fd', 'of type number', fd);
    throw _err.ERR_OUT_OF_RANGE('fd', '>= 0 and <= 2147483647', fd);
  }
}

exports.openSync = function (p, flags, mode) {
  _err.validatePath(p, "path");
  var fd = __openSync(String(p), flagsToNumber(flags), mode === undefined ? 438 : Number(mode));
  if (fd < 0) throw ioError("ENOENT", "open", p, -2);
  return fd;
};
exports.open = function (p, flagsOrCb, modeOrCb, maybeCb) {
  var cb = typeof flagsOrCb === 'function' ? flagsOrCb
         : typeof modeOrCb === 'function' ? modeOrCb : maybeCb;
  var flags = typeof flagsOrCb === 'function' ? 'r' : flagsOrCb;
  var mode = typeof modeOrCb === 'function' ? undefined : modeOrCb;
  try { var fd = exports.openSync(p, flags, mode); if (cb) cb(null, fd); }
  catch (e) { if (cb) cb(e); }
};
exports.closeSync = function (fd) {
  validateFd(fd);
  if (!__closeSync(fd)) throw ioError("EBADF", "close", String(fd), -9);
};
exports.close = function (fd, cb) {
  try { exports.closeSync(fd); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};

// fs.readSync(fd, buffer, offset, length[, position]). A null position means
// "read from the descriptor's current offset and advance it", which is why the
// native only seeks when position >= 0.
exports.readSync = function (fd, buffer, offset, length, position) {
  validateFd(fd);
  if (!(buffer instanceof Uint8Array)) {
    throw _err.ERR_INVALID_ARG_TYPE('buffer', ['Buffer', 'TypedArray', 'DataView'], buffer);
  }
  if (offset !== null && typeof offset === 'object') {
    // the (fd, buffer, options) form
    position = offset.position;
    length = offset.length;
    offset = offset.offset;
  }
  var off = offset === undefined || offset === null ? 0 : offset;
  var len = length === undefined || length === null ? buffer.length - off : length;
  var pos = position === undefined || position === null ? -1 : position;
  if (off < 0 || off > buffer.length) throw _err.ERR_OUT_OF_RANGE('offset', '>= 0 and <= ' + buffer.length, off);
  if (len < 0 || off + len > buffer.length) throw _err.ERR_OUT_OF_RANGE('length', '<= ' + (buffer.length - off), len);
  var n = __readFdInto(fd, buffer, off, len, pos);
  if (n < 0) throw ioError("EBADF", "read", String(fd), -9);
  return n;
};
exports.read = function (fd, buffer, offset, length, position, cb) {
  var args = Array.prototype.slice.call(arguments);
  var callback = args[args.length - 1];
  try {
    var n = exports.readSync(fd, buffer, offset, length, position);
    if (typeof callback === 'function') callback(null, n, buffer);
  } catch (e) { if (typeof callback === 'function') callback(e); }
};

exports.writeSync = function (fd, bufferOrString, offsetOrPosition, lengthOrEncoding, position) {
  validateFd(fd);
  var buffer = bufferOrString;
  var off, len, pos;
  if (typeof bufferOrString === 'string') {
    // fs.writeSync(fd, string[, position[, encoding]])
    var enc = typeof lengthOrEncoding === 'string' ? lengthOrEncoding : 'utf8';
    buffer = require("buffer").Buffer.from(bufferOrString, enc);
    off = 0;
    len = buffer.length;
    pos = offsetOrPosition === undefined || offsetOrPosition === null ? -1 : offsetOrPosition;
  } else {
    if (!(buffer instanceof Uint8Array)) {
      throw _err.ERR_INVALID_ARG_TYPE('buffer', ['Buffer', 'TypedArray', 'DataView', 'string'], buffer);
    }
    off = offsetOrPosition === undefined || offsetOrPosition === null ? 0 : offsetOrPosition;
    len = lengthOrEncoding === undefined || lengthOrEncoding === null ? buffer.length - off : lengthOrEncoding;
    pos = position === undefined || position === null ? -1 : position;
  }
  var n = __writeFdFrom(fd, buffer, off, len, pos);
  if (n < 0) throw ioError("EBADF", "write", String(fd), -9);
  return n;
};
exports.write = function (fd, bufferOrString) {
  var args = Array.prototype.slice.call(arguments);
  var callback = args[args.length - 1];
  try {
    var n = exports.writeSync(fd, args[1], args[2], args[3], args[4]);
    if (typeof callback === 'function') callback(null, n, bufferOrString);
  } catch (e) { if (typeof callback === 'function') callback(e); }
};

exports.fsyncSync = function (fd) { validateFd(fd); if (!__fsyncSync(fd)) throw ioError("EBADF", "fsync", String(fd), -9); };
exports.fsync = function (fd, cb) { try { exports.fsyncSync(fd); if (cb) cb(null); } catch (e) { if (cb) cb(e); } };
exports.fdatasyncSync = exports.fsyncSync;
exports.fdatasync = exports.fsync;
exports.ftruncateSync = function (fd, len) {
  validateFd(fd);
  if (len !== undefined) _err.validateInteger(len, "len");
  if (!__ftruncateSync(fd, len === undefined ? 0 : len)) throw ioError("EBADF", "ftruncate", String(fd), -9);
};
exports.ftruncate = function (fd, lenOrCb, maybeCb) {
  var cb = typeof lenOrCb === 'function' ? lenOrCb : maybeCb;
  var len = typeof lenOrCb === 'function' ? 0 : lenOrCb;
  try { exports.ftruncateSync(fd, len); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};
exports.fchmodSync = function (fd, mode) {
  validateFd(fd);
  _err.validateInteger(mode, "mode", 0, 4294967295);
  __fchmodSync(fd, Number(mode));
};
exports.fchmod = function (fd, mode, cb) {
  try { exports.fchmodSync(fd, mode); if (cb) cb(null); } catch (e) { if (cb) cb(e); }
};
// fchown has no portable binding yet; it still has to reject bad arguments,
// because that is all node's tests for it check.
exports.fchownSync = function (fd, uid, gid) {
  validateFd(fd);
  _err.validateInteger(uid, "uid", -1, 4294967295);
  _err.validateInteger(gid, "gid", -1, 4294967295);
};
exports.fchown = function (fd, uid, gid, cb) {
  exports.fchownSync(fd, uid, gid); _err.validateCallback(cb); cb(null);
};

function ioError(code, syscall, p, errno) {
  var e = new Error(code + ": " + syscall + " '" + p + "'");
  e.code = code; e.syscall = syscall; e.path = p; e.errno = errno;
  return e;
}

exports.readlinkSync = function (p, opts) {
  _err.validatePath(p, "path");
  checkOptions(opts);
  var t = __readlinkSync(String(p));
  if (t === null || t === undefined) throw ioError("EINVAL", "readlink", p, -22);
  return t;
};
exports.readlink = function (p, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  _err.validatePath(p, "path");
  if (typeof optsOrCb !== 'function') checkOptions(optsOrCb);
  try { var r = exports.readlinkSync(p); if (cb) cb(null, r); }
  catch (e) { if (cb) cb(e); }
};

// node's argument order is (target, path) — the reverse of the shell's ln -s,
// and the single most common way to get this call backwards.
exports.symlinkSync = function (target, p, type) {
  _err.validatePath(target, "target");
  _err.validatePath(p, "path");
  if (!__symlinkSync(String(target), String(p))) throw ioError("EEXIST", "symlink", p, -17);
};
exports.symlink = function (target, p, typeOrCb, maybeCb) {
  var cb = typeof typeOrCb === 'function' ? typeOrCb : maybeCb;
  try { exports.symlinkSync(target, p); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};
exports.linkSync = function (existing, p) {
  _err.validatePath(existing, "existingPath");
  _err.validatePath(p, "newPath");
  if (!__linkSync(String(existing), String(p))) throw ioError("EEXIST", "link", p, -17);
};
exports.link = function (existing, p, cb) {
  try { exports.linkSync(existing, p); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};

exports.truncateSync = function (p, len) {
  _err.validatePath(p, "path");
  if (len !== undefined) _err.validateInteger(len, "len");
  if (!__truncateSync(String(p), len === undefined ? 0 : len)) {
    throw ioError("ENOENT", "truncate", p, -2);
  }
};
exports.truncate = function (p, lenOrCb, maybeCb) {
  var cb = typeof lenOrCb === 'function' ? lenOrCb : maybeCb;
  var len = typeof lenOrCb === 'function' ? 0 : lenOrCb;
  try { exports.truncateSync(p, len); if (cb) cb(null); }
  catch (e) { if (cb) cb(e); }
};

// node appends exactly six random characters to the prefix; callers rely on the
// returned path rather than reconstructing it, but the length is observable.
exports.mkdtempSync = function (prefix, opts) {
  if (typeof prefix !== "string") throw _err.ERR_INVALID_ARG_TYPE("prefix", ["string", "Buffer", "URL"], prefix);
  checkOptions(opts);
  var d = __mkdtempSync(prefix);
  if (d === null || d === undefined) throw ioError("ENOENT", "mkdtemp", prefix, -2);
  return d;
};
exports.mkdtemp = function (prefix, optsOrCb, maybeCb) {
  var cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  if (typeof prefix !== "string") throw _err.ERR_INVALID_ARG_TYPE("prefix", ["string", "Buffer", "URL"], prefix);
  if (typeof optsOrCb !== 'function') checkOptions(optsOrCb);
  try { var r = exports.mkdtempSync(prefix); if (cb) cb(null, r); }
  catch (e) { if (cb) cb(e); }
};

exports.promises.readlink = function (p) { return new Promise(function (res, rej) { try { res(exports.readlinkSync(p)); } catch (e) { rej(e); } }); };
exports.promises.symlink = function (t, p) { return new Promise(function (res, rej) { try { exports.symlinkSync(t, p); res(); } catch (e) { rej(e); } }); };
exports.promises.link = function (a, b) { return new Promise(function (res, rej) { try { exports.linkSync(a, b); res(); } catch (e) { rej(e); } }); };
exports.promises.truncate = function (p, n) { return new Promise(function (res, rej) { try { exports.truncateSync(p, n); res(); } catch (e) { rej(e); } }); };
exports.promises.mkdtemp = function (p) { return new Promise(function (res, rej) { try { res(exports.mkdtempSync(p)); } catch (e) { rej(e); } }); };
exports.promises.realpath = function (p) { return new Promise(function (res, rej) { try { res(exports.realpathSync(p)); } catch (e) { rej(e); } }); };
exports.promises.chmod = function (p, m) { return new Promise(function (res, rej) { try { exports.chmodSync(p, m); res(); } catch (e) { rej(e); } }); };
exports.promises.lstat = function (p) { return new Promise(function (res, rej) { try { res(lstatSync(p)); } catch (e) { rej(e); } }); };

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

exports.realpathSync = function (p) {
  _err.validatePath(p, "path");
  var r = __realpathSync(String(p));
  if (r === null || r === undefined) {
    var e = new Error("ENOENT: no such file or directory, realpath '" + p + "'");
    e.code = "ENOENT"; e.errno = -2; e.path = p;
    throw e;
  }
  return r;
};
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

exports.chmodSync = function (p, mode) { checkChmod(p, mode); __chmodSync(String(p), Number(mode)); };
exports.chmod = function (p, mode, cb) { checkChmod(p, mode); _err.validateCallback(cb); __chmodSync(String(p), Number(mode)); cb(null); };
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

// fd -> path, so fstat can answer without a struct-stat layout to parse. The
// descriptors themselves are REAL (open(2) above); this only remembers what was
// opened. An fd inherited from elsewhere is therefore unknown to fstat, which is
// the one case this cannot answer.
var _fdPaths = {};
var _rawOpenSync = exports.openSync;
exports.openSync = function (p, flags, mode) {
  var fd = _rawOpenSync(p, flags, mode);
  _fdPaths[fd] = String(p);
  return fd;
};
var _rawCloseSync = exports.closeSync;
exports.closeSync = function (fd) {
  delete _fdPaths[fd];
  _rawCloseSync(fd);
};
exports.fstatSync = function (fd) {
  validateFd(fd);
  var path = _fdPaths[fd];
  if (path === undefined) { var err = new Error("EBADF: bad file descriptor, fstat"); err.code = "EBADF"; throw err; }
  return statSync(path);
};
exports.fstat = function (fd, optsOrCb, maybeCb) {
  var cb = statsCallback(typeof optsOrCb === 'function' ? optsOrCb : maybeCb);
  try { var r = exports.fstatSync(fd); cb(null, r); }
  catch (e) { cb(e); }
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
