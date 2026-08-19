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
