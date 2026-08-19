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
  // The cwd is the last resort, walked as the i === -1 iteration: resolve("")
  // and resolve() both have to answer the cwd, not ".". Zero-length arguments
  // are skipped, so they never stop the walk from reaching it.
  for (var i = arguments.length - 1; i >= -1; i--) {
    var p = i >= 0 ? arguments[i] : process.cwd();
    if (typeof p !== "string" || p === "") {
      continue;
    }
    resolved = resolved === "" ? p : p + "/" + resolved;
    if (p.charAt(0) === "/") {
      isAbs = true;
      break;
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
  // TRAILING separators are not a component boundary: dirname("/a/b/") is "/a",
  // not "/a/b". Scanning for the last "/" without skipping them answered the
  // input with one character removed. The walk stops at the first separator that
  // follows a non-separator, which is also what keeps "//a//b//" at "//a/".
  var hasRoot = p.charAt(0) === "/";
  var end = -1;
  var matchedSlash = true;
  for (var i = p.length - 1; i >= 1; i--) {
    if (p.charAt(i) === "/") {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      matchedSlash = false;
    }
  }
  if (end === -1) {
    return hasRoot ? "/" : ".";
  }
  if (hasRoot && end === 1) {
    return "//";
  }
  return p.slice(0, end);
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
  // ".." is the one all-dots name with no extension; "..." and "...." both
  // have one, so this is a special case rather than an all-dots rule.
  if (dot <= 0 || base === "..") {
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

// --- glob matching ----------------------------------------------------------
//
// node's path.matchesGlob is a pure pattern match against the string: it never
// touches the filesystem. The shape is the shell's, not a regex's — `*` stops
// at a separator, `**` crosses them, `[!...]` is the negated class (regex spells
// that `[^...]`), and every other regex metacharacter is a literal.
function globToRegExp(glob, seps) {
  // In a class the backslash needs its own escape: '[\\/]' is the two-character
  // class, '[\/]' is just a forward slash and every win32 pattern then fails.
  var sepClass = seps.length > 1 ? '[\\\\/]' : '\\/';
  var out = '^';
  var i = 0;
  while (i < glob.length) {
    var c = glob.charAt(i);
    if (c === '*') {
      // `**` is only "cross separators" as a whole segment; a trailing one also
      // matches the separator before it, so `foo/**` matches `foo/bar/baz`.
      if (glob.charAt(i + 1) === '*') {
        i += 2;
        // `**/` may match nothing at all (`a/**/b` matches `a/b`), but a `**`
        // with nothing after it matches the whole remainder, separators and all.
        if (i < glob.length && (glob.charAt(i) === '/' || glob.charAt(i) === '\\')) {
          i++;
          out += '(?:.*' + sepClass + ')?';
        } else {
          out += '.*';
        }
      } else {
        out += '(?:(?!' + sepClass + ').)*';
        i++;
      }
      continue;
    }
    if (c === '?') { out += '(?!' + sepClass + ').'; i++; continue; }
    if (c === '[') {
      var j = i + 1;
      var neg = false;
      if (glob.charAt(j) === '!' || glob.charAt(j) === '^') { neg = true; j++; }
      var body = '';
      while (j < glob.length && glob.charAt(j) !== ']') {
        var b = glob.charAt(j);
        if (b === '\\' || b === ']' || b === '^') body += '\\';
        body += b;
        j++;
      }
      // An unterminated class is a literal '[' in the shell, and in node.
      if (j >= glob.length) { out += '\\['; i++; continue; }
      out += '[' + (neg ? '^' : '') + body + ']';
      i = j + 1;
      continue;
    }
    if (c === '/' || c === '\\') {
      // On win32 either separator in the pattern matches either in the path.
      out += seps.length > 1 ? sepClass : '/';
      i++;
      continue;
    }
    if ('.+^$(){}|'.indexOf(c) >= 0) out += '\\';
    out += c;
    i++;
  }
  return new RegExp(out + '$');
}

function makeMatchesGlob(seps) {
  return function matchesGlob(p, glob) {
    validatePathString(p, 'path');
    validatePathString(glob, 'pattern');
    return globToRegExp(glob, seps).test(p);
  };
}

exports.matchesGlob = makeMatchesGlob('/');

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
        // Runs of separators collapse inside the root too: "//server//share" is
        // the same root as "//server/share", and treating the empty middle as
        // the share name made the whole thing a plain absolute path.
        var k = i;
        while (k < rest.length && isSep(rest.charAt(k))) k++;
        var after = rest.slice(k);
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
    // A drive-relative path with no body is "C:.", not "C:": the "." is what
    // says the path is relative to that drive's cwd.
    if (joined === '' && !s.absolute) joined = '.';
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
      // A UNC share is a device exactly like a drive letter is: "\\\\server\\share"
      // is what later segments resolve against, and dropping it turned
      // resolve("//server/share", "..", "x") into "\\x".
      var segDevice = s.drive;
      if (segDevice.length === 0 && s.root.length > 2 && isSep(s.root.charAt(0)) && isSep(s.root.charAt(1))) {
        segDevice = s.root.slice(0, s.root.length - 1);
      }
      if (segDevice.length > 0) {
        // A path naming a DIFFERENT drive than the one already accumulated is
        // not a parent of it, so it is ignored rather than prepended.
        if (drive.length > 0 && segDevice.toLowerCase() !== drive.toLowerCase()) continue;
        drive = segDevice;
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

  // node's win32 dirname SLICES the input: it never rewrites separators, so
  // dirname("//a//b//") is "//a//b/" and not the normalized "\\a\b". Rebuilding
  // it from split parts also lost the difference between a bare UNC root (which
  // is its own dirname) and a path under one.
  win32.dirname = function dirname(p) {
    validatePathString(p, 'path');
    var len = p.length;
    if (len === 0) return '.';
    if (len === 1) return isSep(p.charAt(0)) ? p : '.';
    var rootEnd = -1;
    var offset = 0;
    if (isSep(p.charAt(0))) {
      rootEnd = 1;
      offset = 1;
      if (isSep(p.charAt(1))) {
        var j = 2;
        var last = j;
        while (j < len && !isSep(p.charAt(j))) j++;
        if (j < len && j !== last) {
          last = j;
          while (j < len && isSep(p.charAt(j))) j++;
          if (j < len && j !== last) {
            last = j;
            while (j < len && !isSep(p.charAt(j))) j++;
            // "\\server\share" with nothing after it is a root, and a root is
            // its own parent.
            if (j === len) return p;
            if (j !== last) {
              rootEnd = j + 1;
              offset = j + 1;
            }
          }
        }
      }
    } else if (isLetter(p.charAt(0)) && p.charAt(1) === ':') {
      rootEnd = len > 2 && isSep(p.charAt(2)) ? 3 : 2;
      offset = rootEnd;
    }
    var end = -1;
    var matchedSlash = true;
    for (var i = len - 1; i >= offset; i--) {
      if (isSep(p.charAt(i))) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        matchedSlash = false;
      }
    }
    if (end === -1) {
      if (rootEnd === -1) return '.';
      end = rootEnd;
    }
    return p.slice(0, end);
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
    // Same ".." special case as the posix extname above.
    if (dot <= 0 || base === '..') return '';
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

  win32.matchesGlob = makeMatchesGlob('/\\');

  win32.win32 = win32;
  win32.posix = exports;
  exports.win32 = win32;
  exports.posix = exports;
})();
