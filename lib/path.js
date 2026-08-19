// node:path — POSIX only. Written in the ES5 subset milojs supports.
"use strict";

function normalizeParts(parts, allowAboveRoot) {
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p === "" || p === ".") {
      continue;
    }
    if (p === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") {
        out.pop();
      } else if (allowAboveRoot) {
        out.push("..");
      }
      continue;
    }
    out.push(p);
  }
  return out;
}

function normalize(p) {
  var isAbs = p.charAt(0) === "/";
  var trailing = p.length > 1 && p.charAt(p.length - 1) === "/";
  var parts = normalizeParts(p.split("/"), !isAbs);
  var joined = parts.join("/");
  if (joined === "" && !isAbs) {
    joined = ".";
  }
  if (joined !== "" && trailing) {
    joined = joined + "/";
  }
  return (isAbs ? "/" : "") + joined;
}

function join() {
  var segs = [];
  for (var i = 0; i < arguments.length; i++) {
    var a = arguments[i];
    if (typeof a === "string" && a !== "") {
      segs.push(a);
    }
  }
  if (segs.length === 0) {
    return ".";
  }
  return normalize(segs.join("/"));
}

function resolve() {
  var resolved = "";
  var isAbs = false;
  for (var i = arguments.length - 1; i >= 0; i--) {
    var p = arguments[i];
    if (typeof p !== "string" || p === "") {
      continue;
    }
    resolved = resolved === "" ? p : p + "/" + resolved;
    if (p.charAt(0) === "/") {
      isAbs = true;
      i = -1;
    }
  }
  var parts = normalizeParts(resolved.split("/"), !isAbs);
  var joined = parts.join("/");
  if (isAbs) {
    return "/" + joined;
  }
  return joined === "" ? "." : joined;
}

function dirname(p) {
  if (p.length === 0) {
    return ".";
  }
  var idx = -1;
  for (var i = 0; i < p.length; i++) {
    if (p.charAt(i) === "/") {
      idx = i;
    }
  }
  if (idx < 0) {
    return ".";
  }
  if (idx === 0) {
    return "/";
  }
  return p.slice(0, idx);
}

// Ported from node's posix basename rather than approximated, because the ext
// rule is not the obvious one: basename("aaa/bbb", "bbb") is "bbb" (an ext that
// spans the WHOLE basename is not stripped) while basename(".ext", ".ext") is ""
// (an ext equal to the whole PATH is). The old version scanned the raw string,
// so any path with a trailing slash answered "".
function basename(p, ext) {
  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;
  if (ext !== undefined && ext.length > 0 && ext.length <= p.length) {
    if (ext === p) return "";
    var extIdx = ext.length - 1;
    var firstNonSlashEnd = -1;
    for (i = p.length - 1; i >= 0; i--) {
      var code = p.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) { start = i + 1; break; }
      } else {
        if (firstNonSlashEnd === -1) { matchedSlash = false; firstNonSlashEnd = i + 1; }
        if (extIdx >= 0) {
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1) end = i;
          } else {
            extIdx = -1;
            end = firstNonSlashEnd;
          }
        }
      }
    }
    if (start === end) end = firstNonSlashEnd;
    else if (end === -1) end = p.length;
    return p.slice(start, end);
  }
  for (i = p.length - 1; i >= 0; i--) {
    if (p.charCodeAt(i) === 47) {
      if (!matchedSlash) { start = i + 1; break; }
    } else if (end === -1) {
      matchedSlash = false;
      end = i + 1;
    }
  }
  if (end === -1) return "";
  return p.slice(start, end);
}

function extname(p) {
  var base = basename(p);
  var dot = -1;
  for (var i = 0; i < base.length; i++) {
    if (base.charAt(i) === ".") {
      dot = i;
    }
  }
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot);
}

function isAbsolute(p) {
  return p.charAt(0) === "/";
}

// { root, dir, base, ext, name } — the inverse of format()
function parse(p) {
  var base = basename(p);
  var ext = extname(p);
  var dir = dirname(p);
  var name = ext ? base.slice(0, base.length - ext.length) : base;
  return {
    root: isAbsolute(p) ? "/" : "",
    dir: dir,
    base: base,
    ext: ext,
    name: name,
  };
}

// inverse of parse(): prefer dir+base, else root+name+ext
function format(o) {
  var dir = o.dir || o.root || "";
  var base = o.base || (o.name || "") + (o.ext || "");
  if (!dir) {
    return base;
  }
  return dir === "/" ? "/" + base : dir + "/" + base;
}

function relative(a, b) {
  var from = resolve(a).split("/");
  var to = resolve(b).split("/");
  var i = 0;
  while (i < from.length && i < to.length && from[i] === to[i]) {
    i = i + 1;
  }
  var up = [];
  for (var j = i; j < from.length; j++) {
    if (from[j] !== "") {
      up.push("..");
    }
  }
  for (var k = i; k < to.length; k++) {
    if (to[k] !== "") {
      up.push(to[k]);
    }
  }
  return up.join("/");
}

// --- argument validation ----------------------------------------------------
//
// Every path function takes strings, and these took whatever they were handed:
// path.join(1) answered "1" and path.basename(null) answered "null", so a bug
// that put a number where a path belonged produced a plausible-looking path
// instead of an error. node throws ERR_INVALID_ARG_TYPE, and its tests assert
// the code.
var _pathErr = require("_errors");

function validatePathString(value, name) {
  if (typeof value !== 'string') {
    throw _pathErr.ERR_INVALID_ARG_TYPE(name || 'path', ['string'], value);
  }
}

// join/resolve are variadic: every argument is a path, and node checks them all
// before doing any work rather than failing partway through.
function wrapVariadic(fn) {
  return function () {
    for (var i = 0; i < arguments.length; i++) validatePathString(arguments[i], 'path');
    return fn.apply(this, arguments);
  };
}

function wrapFirst(fn, name) {
  return function (p) {
    validatePathString(p, name || 'path');
    return fn.apply(this, arguments);
  };
}

join = wrapVariadic(join);
resolve = wrapVariadic(resolve);
normalize = wrapFirst(normalize);
dirname = wrapFirst(dirname);
extname = wrapFirst(extname);
isAbsolute = wrapFirst(isAbsolute);
parse = wrapFirst(parse);
// basename's optional second argument is a suffix, and node type-checks it too.
var _basename = basename;
basename = function (p, ext) {
  validatePathString(p, 'path');
  if (ext !== undefined) validatePathString(ext, 'suffix');
  return _basename(p, ext);
};
var _relative = relative;
relative = function (from, to) {
  validatePathString(from, 'from');
  validatePathString(to, 'to');
  return _relative(from, to);
};

exports.sep = "/";
exports.delimiter = ":";
exports.normalize = normalize;
exports.join = join;
exports.resolve = resolve;
exports.dirname = dirname;
exports.basename = basename;
exports.extname = extname;
exports.isAbsolute = isAbsolute;
exports.relative = relative;
exports.parse = parse;
exports.format = format;
exports.posix = exports;

// posix no-op (only Windows namespaces paths); prisma calls it before dlopen
exports.toNamespacedPath = function (p) { return p; };

// --- win32 ------------------------------------------------------------------
//
// `path.win32` was undefined, and node's path tests exercise BOTH variants in
// one file — so eleven of them died on their first line without testing
// anything. Aliasing it to posix would be worse than the absence: the tests
// would then compare posix answers against win32 expectations and fail on
// content rather than on a missing object.
//
// Written separately rather than parameterised on a separator, because the
// differences are structural, not cosmetic: two separators are legal, a path
// can be rooted on a DRIVE, `C:foo` is relative to that drive's own current
// directory while `C:\foo` is absolute, and `\\server\share` is a third kind of
// root again.
(function () {
  var win32 = {};

  function isSep(c) { return c === '\\' || c === '/'; }
  function isLetter(c) {
    var n = c.charCodeAt(0);
    return (n >= 65 && n <= 90) || (n >= 97 && n <= 122);
  }

  // Splits a path into its root and the rest. The root is one of: "" (relative),
  // "\" (rooted on the current drive), "C:" (relative to C's own directory),
  // "C:\" (absolute), or "\\server\share\" (UNC).
  function splitRoot(p) {
    if (p.length >= 2 && isLetter(p.charAt(0)) && p.charAt(1) === ':') {
      if (p.length > 2 && isSep(p.charAt(2))) {
        return { root: p.slice(0, 2) + '\\', rest: p.slice(3), absolute: true, drive: p.slice(0, 2) };
      }
      return { root: p.slice(0, 2), rest: p.slice(2), absolute: false, drive: p.slice(0, 2) };
    }
    if (p.length >= 2 && isSep(p.charAt(0)) && isSep(p.charAt(1))) {
      // \\server\share — both components belong to the root, and a UNC root
      // with only a server is not a root at all.
      var rest = p.slice(2);
      var i = 0;
      while (i < rest.length && !isSep(rest.charAt(i))) i++;
      var server = rest.slice(0, i);
      if (server.length > 0 && i < rest.length) {
        var after = rest.slice(i + 1);
        var j = 0;
        while (j < after.length && !isSep(after.charAt(j))) j++;
        var share = after.slice(0, j);
        if (share.length > 0) {
          return {
            root: '\\\\' + server + '\\' + share + '\\',
            rest: after.slice(j + 1), absolute: true, drive: '',
          };
        }
      }
      return { root: '\\', rest: p.slice(1), absolute: true, drive: '' };
    }
    if (p.length >= 1 && isSep(p.charAt(0))) {
      return { root: '\\', rest: p.slice(1), absolute: true, drive: '' };
    }
    return { root: '', rest: p, absolute: false, drive: '' };
  }

  function splitParts(rest) { return rest.split(/[\\/]+/); }

  win32.sep = '\\';
  win32.delimiter = ';';

  win32.isAbsolute = function isAbsolute(p) {
    validatePathString(p, 'path');
    if (p.length === 0) return false;
    return splitRoot(p).absolute;
  };

  win32.normalize = function normalize(p) {
    validatePathString(p, 'path');
    if (p.length === 0) return '.';
    var s = splitRoot(p);
    var trailing = p.length > 1 && isSep(p.charAt(p.length - 1));
    var parts = normalizeParts(splitParts(s.rest), !s.absolute);
    var joined = parts.join('\\');
    if (joined === '' && !s.absolute) joined = s.root === '' ? '.' : '';
    if (joined !== '' && trailing) joined = joined + '\\';
    return s.root + joined;
  };

  win32.join = function join() {
    var segs = [];
    for (var i = 0; i < arguments.length; i++) {
      validatePathString(arguments[i], 'path');
      if (arguments[i].length > 0) segs.push(arguments[i]);
    }
    if (segs.length === 0) return '.';
    var joined = segs.join('\\');
    // A UNC path's leading pair survives the collapse that normalize would
    // otherwise apply to it.
    var uncLead = false;
    if (isSep(segs[0].charAt(0)) && isSep(segs[0].charAt(1))) uncLead = true;
    var out = win32.normalize(joined);
    if (uncLead && !(isSep(out.charAt(0)) && isSep(out.charAt(1)))) out = '\\' + out;
    return out;
  };

  win32.resolve = function resolve() {
    var resolved = '';
    var drive = '';
    var absolute = false;
    for (var i = arguments.length - 1; i >= -1; i--) {
      var seg;
      if (i >= 0) {
        validatePathString(arguments[i], 'path');
        seg = arguments[i];
      } else {
        // The process cwd is the last resort, and it is posix-shaped here.
        seg = drive.length > 0 ? drive + '\\' : process.cwd();
      }
      if (seg.length === 0) continue;
      var s = splitRoot(seg);
      if (s.drive.length > 0) {
        // A path naming a DIFFERENT drive than the one already accumulated is
        // not a parent of it, so it is ignored rather than prepended.
        if (drive.length > 0 && s.drive.toLowerCase() !== drive.toLowerCase()) continue;
        drive = s.drive;
      }
      // The device and the absoluteness are found INDEPENDENTLY. "\\c" is
      // absolute but names no drive, so the scan has to keep going leftwards to
      // find one — resolve("C:\\a", "\\c") is "C:\\c", not "\\c". Once absolute,
      // later segments contribute their drive and nothing else.
      if (!absolute) {
        resolved = resolved.length > 0 ? s.rest + '\\' + resolved : s.rest;
        if (s.absolute) absolute = true;
      }
      if (absolute && drive.length > 0) break;
    }
    var parts = normalizeParts(splitParts(resolved), !absolute);
    var body = parts.join('\\');
    if (absolute) {
      var head = drive.length > 0 ? drive + '\\' : '\\';
      return body.length > 0 ? head + body : head;
    }
    return body.length > 0 ? body : '.';
  };

  win32.dirname = function dirname(p) {
    validatePathString(p, 'path');
    var s = splitRoot(p);
    var parts = splitParts(s.rest);
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    if (parts.length <= 1) return s.root.length > 0 ? s.root : '.';
    parts.pop();
    return s.root + parts.join('\\');
  };

  win32.basename = function basename(p, ext) {
    validatePathString(p, 'path');
    if (ext !== undefined) validatePathString(ext, 'suffix');
    var s = splitRoot(p);
    var parts = splitParts(s.rest);
    while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    var base = parts.length > 0 ? parts[parts.length - 1] : '';
    if (ext !== undefined && ext !== base && base.slice(-ext.length) === ext) {
      base = base.slice(0, base.length - ext.length);
    }
    return base;
  };

  win32.extname = function extname(p) {
    validatePathString(p, 'path');
    var base = win32.basename(p);
    var dot = base.lastIndexOf('.');
    if (dot <= 0) return '';
    return base.slice(dot);
  };

  win32.relative = function relative(from, to) {
    validatePathString(from, 'from');
    validatePathString(to, 'to');
    if (from === to) return '';
    var f = win32.resolve(from);
    var t = win32.resolve(to);
    if (f === t) return '';
    // Drive letters compare case-insensitively, and there is no relative path
    // between two different drives.
    var fr = splitRoot(f), tr = splitRoot(t);
    if (fr.drive.toLowerCase() !== tr.drive.toLowerCase()) return t;
    var fp = splitParts(fr.rest).filter(function (x) { return x.length > 0; });
    var tp = splitParts(tr.rest).filter(function (x) { return x.length > 0; });
    var i = 0;
    while (i < fp.length && i < tp.length && fp[i].toLowerCase() === tp[i].toLowerCase()) i++;
    var up = [];
    for (var k = i; k < fp.length; k++) up.push('..');
    return up.concat(tp.slice(i)).join('\\');
  };

  win32.parse = function parse(p) {
    validatePathString(p, 'path');
    var s = splitRoot(p);
    var base = win32.basename(p);
    var ext = win32.extname(p);
    return {
      root: s.root,
      dir: win32.dirname(p) === '.' && s.root === '' ? '' : win32.dirname(p),
      base: base,
      ext: ext,
      name: ext.length > 0 ? base.slice(0, base.length - ext.length) : base,
    };
  };

  win32.format = function format(o) {
    if (o === null || typeof o !== 'object') {
      throw _pathErr.ERR_INVALID_ARG_TYPE('pathObject', ['Object'], o);
    }
    var base = o.base || ((o.name || '') + (o.ext || ''));
    var dir = o.dir || o.root || '';
    if (dir.length === 0) return base;
    if (dir === o.root) return dir + base;
    return dir + '\\' + base;
  };

  // The extended-length prefix. Only an absolute path can carry one, and a path
  // that already has it is returned unchanged.
  win32.toNamespacedPath = function toNamespacedPath(p) {
    if (typeof p !== 'string' || p.length === 0) return p;
    var resolved = win32.resolve(p);
    if (resolved.length <= 2) return p;
    if (resolved.charAt(0) === '\\' && resolved.charAt(1) === '\\') {
      if (resolved.charAt(2) === '?') return p;
      return '\\\\?\\UNC\\' + resolved.slice(2);
    }
    var s = splitRoot(resolved);
    if (s.drive.length > 0 && s.absolute) return '\\\\?\\' + resolved;
    return p;
  };

  win32.win32 = win32;
  win32.posix = exports;
  exports.win32 = win32;
  exports.posix = exports;
})();
