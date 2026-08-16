// node:util — the commonly-used surface, in the ES5 subset milojs supports.
"use strict";

function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  var proto = {};
  for (var k in superCtor.prototype) {
    proto[k] = superCtor.prototype[k];
  }
  proto.constructor = ctor;
  ctor.prototype = proto;
}

function isArray(x) {
  return x !== null && typeof x === "object" && typeof x.length === "number" && typeof x.push === "undefined" ? false : Array.isArray ? Array.isArray(x) : false;
}

// Delegates to the engine's own renderer (the one console.log uses), so
// util.inspect and console.log can never drift apart. The JS fallback below is
// kept for an embedder that boots without the native — it is bun-shaped and
// does NOT reproduce node's line-breaking or array column grouping.
function inspect(v, seen) {
  if (seen === undefined && typeof __inspect === "function") {
    return __inspect(v);
  }
  if (v === null) {
    return "null";
  }
  if (v === undefined) {
    return "undefined";
  }
  var t = typeof v;
  if (t === "string") {
    return "'" + v + "'";
  }
  if (t === "bigint") {
    return "" + v + "n";
  }
  if (t === "number" || t === "boolean") {
    return "" + v;
  }
  if (t === "symbol") {
    return v.toString();
  }
  if (t === "function") {
    return v.name ? "[Function: " + v.name + "]" : "[Function (anonymous)]";
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (v instanceof Error) {
    return v.stack || v.name + ": " + v.message;
  }
  seen = seen || [];
  if (seen.indexOf(v) >= 0) {
    return "[Circular]";
  }
  seen.push(v);
  var out;
  if (Array.isArray(v)) {
    if (v.length === 0) {
      out = "[]";
    } else {
      var parts = [];
      for (var i = 0; i < v.length; i++) {
        parts.push(inspect(v[i], seen));
      }
      out = "[ " + parts.join(", ") + " ]";
    }
  } else {
    var keys = Object.keys(v);
    if (keys.length === 0) {
      out = "{}";
    } else {
      var kp = [];
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        // bare identifier keys unquoted, everything else single-quoted
        var ident = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
        var kd = ident ? key : "'" + key + "'";
        kp.push(kd + ": " + inspect(v[key], seen));
      }
      out = "{ " + kp.join(", ") + " }";
    }
  }
  seen.pop();
  return out;
}

// util.format with %s %d %i %j %% — the subset real code uses.
function format(fmt) {
  var rest = [];
  for (var i = 1; i < arguments.length; i++) {
    rest.push(arguments[i]);
  }
  if (typeof fmt !== "string") {
    var parts = [inspect(fmt)];
    for (var k = 0; k < rest.length; k++) {
      parts.push(inspect(rest[k]));
    }
    return parts.join(" ");
  }
  var out = "";
  var ri = 0;
  var idx = 0;
  while (idx < fmt.length) {
    var c = fmt.charAt(idx);
    if (c === "%" && idx + 1 < fmt.length) {
      var n = fmt.charAt(idx + 1);
      if (n === "%") {
        out = out + "%";
        idx = idx + 2;
        continue;
      }
      if (n === "s" || n === "d" || n === "i" || n === "j") {
        if (ri < rest.length) {
          var a = rest[ri];
          ri = ri + 1;
          if (n === "s") {
            out = out + (typeof a === "string" ? a : inspect(a));
          } else if (n === "j") {
            out = out + JSON.stringify(a);
          } else {
            out = out + Math.trunc(Number(a));
          }
        } else {
          out = out + "%" + n;
        }
        idx = idx + 2;
        continue;
      }
    }
    out = out + c;
    idx = idx + 1;
  }
  for (var r = ri; r < rest.length; r++) {
    out = out + " " + inspect(rest[r]);
  }
  return out;
}

function deprecate(fn, msg) {
  return fn;
}

// Node's callback->Promise adapter. Honors util.promisify.custom, which is how
// child_process.exec advertises its {stdout,stderr} shape instead of the plain
// single-value callback contract.
function promisify(original) {
  if (typeof original !== 'function') {
    throw new TypeError('The "original" argument must be of type function');
  }
  var custom = original[promisify.custom];
  if (custom) {
    if (typeof custom !== 'function') {
      throw new TypeError('The "promisify.custom" property must be of type function');
    }
    return custom;
  }
  function fn() {
    var args = Array.prototype.slice.call(arguments);
    var self = this;
    return new Promise(function (resolve, reject) {
      args.push(function (err, value) {
        if (err) { reject(err); } else { resolve(value); }
      });
      original.apply(self, args);
    });
  }
  return fn;
}
promisify.custom = '__util_promisify_custom__';

exports.promisify = promisify;
exports.inherits = inherits;
exports.inspect = inspect;
exports.format = format;
exports.deprecate = deprecate;
exports.isArray = isArray;

// util.types — type predicates some deps use for defensive checks. Backed by
// instanceof (which recognizes the built-in exotics) where reliable; the
// undetectable ones (Proxy, async-function) report false rather than lie.
function _tag(v) { return Object.prototype.toString.call(v).slice(8, -1); }

exports.types = {
  isDate: function (v) { return v instanceof Date; },
  isRegExp: function (v) { return v instanceof RegExp; },
  isMap: function (v) { return v instanceof Map; },
  isSet: function (v) { return v instanceof Set; },
  isPromise: function (v) { return v instanceof Promise; },
  isNativeError: function (v) { return v instanceof Error; },
  isArrayBuffer: function (v) { return v instanceof ArrayBuffer; },
  isAnyArrayBuffer: function (v) { return v instanceof ArrayBuffer; },
  isTypedArray: function (v) {
    // the runtime polyfills typed arrays as plain arrays tagged _isTypedArray;
    // the engine has real ones that answer instanceof
    if (v && v._isTypedArray) return true;
    return v instanceof Uint8Array || v instanceof Int8Array || v instanceof Uint8ClampedArray ||
      v instanceof Uint16Array || v instanceof Int16Array || v instanceof Uint32Array ||
      v instanceof Int32Array || v instanceof Float32Array || v instanceof Float64Array;
  },
  // These four returned a constant `false`, which made them LIE about features
  // this engine has: an async function, a generator function and a boxed Number
  // are all real here, and a caller dispatching on util.types took the wrong
  // branch silently. They read the type tag now, which reports
  // [object AsyncFunction] / [object GeneratorFunction] / [object Generator].
  isAsyncFunction: function (v) { return _tag(v) === "AsyncFunction" || _tag(v) === "AsyncGeneratorFunction"; },
  isGeneratorFunction: function (v) { return _tag(v) === "GeneratorFunction" || _tag(v) === "AsyncGeneratorFunction"; },
  isGeneratorObject: function (v) { return _tag(v) === "Generator" || _tag(v) === "AsyncGenerator"; },
  // Written as a real check even though it can only answer false today: this
  // engine has no wrapper objects at all (`new Number(1)` returns the PRIMITIVE
  // 1, so typeof is "number" and instanceof Number is false), so there is
  // nothing boxed to find. The check is here rather than a `return false`
  // because the day wrappers exist it becomes correct on its own, and because
  // the reason is a property of the engine that a reader can verify, not an
  // assertion they have to trust. The missing wrappers are in the backlog.
  isBoxedPrimitive: function (v) {
    if (v === null || typeof v !== "object") return false;
    var t = _tag(v);
    return t === "Number" || t === "String" || t === "Boolean" || t === "Symbol" || t === "BigInt";
  },
  // Still a constant, and still `false`, but for a reason that is a property of
  // the engine rather than a guess: a Proxy here is indistinguishable from its
  // target through any JS-visible channel (the type tag reflects the target, as
  // it does in node), so there is nothing to read. node answers true using an
  // internal slot this engine does not expose. Tracked in the backlog.
  isProxy: function () { return false; },
};
