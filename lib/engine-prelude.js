// ECMAScript builtins that are easier to express in JS than to build as natives.
// Engine-level, so this is NOT the node runtime's prelude (lib/prelude.js) — only
// things the language spec itself defines belong here.

// print: the QuickJS/test262 shell global — write the space-joined arguments and
// a newline, like console.log.
"use strict";

var print = function () {
  console.log.apply(console, arguments);
};

// --- destructuring support ---------------------------------------------------
// Target of the `{ a, ...rest }` desugar: every own enumerable key except the
// ones the pattern already bound.
function __objRest(src, keys) {
  var out = {};
  // `const { ...r } = null` is a TypeError, not an empty object: the pattern
  // performs ToObject on its source before collecting anything
  if (src === null || src === undefined) {
    throw new TypeError("Cannot destructure '" + String(src) + "' as it is " + String(src) + ".");
  }
  // OWN keys, symbols included, with each descriptor consulted for
  // enumerability — CopyDataProperties, not a for-in. for-in also walks the
  // prototype chain, which a rest pattern must not, and it never sees a symbol.
  var own = Reflect.ownKeys(Object(src));
  for (var i = 0; i < own.length; i++) {
    var k = own[i];
    if (keys.indexOf(k) >= 0) continue;
    var d = Object.getOwnPropertyDescriptor(src, k);
    if (d !== undefined && d.enumerable) out[k] = src[k];
  }
  return out;
}

// `const {} = null` is a TypeError even though the pattern binds nothing.
// RequireObjectCoercible runs before any key is read, and an empty pattern has
// no key read to raise it — a non-empty pattern's first member access throws on
// its own, so the desugar only emits this call for the empty case.
function __reqObj(v) {
  if (v === null || v === undefined) {
    throw new TypeError("Cannot destructure '" + String(v) + "' as it is " + String(v) + ".");
  }
  return v;
}

// Array destructuring is desugared to indexed reads (src[0], src[1], ...), which
// silently produced undefined for a source that is not iterable at all. The spec
// runs GetIterator first, so `const [a] = 5` and `const [a] = {}` are TypeErrors.
//
// This VALIDATES without invoking the iterator: calling it here and then
// indexing separately would run a generator's side effects twice. That means the
// two cases where the iterator itself is malformed (its next is not callable, or
// it returns a non-object) are still not caught — they need the desugaring to
// drive the protocol rather than index, which is a larger change.
// Step an iterator exactly `n` times for an array pattern, then CLOSE it unless
// the pattern ends in a rest element. This is the observable difference between
// destructuring and spreading: `const [a] = gen()` must pull one value and call
// gen's return(), not drain the generator.
function __iterSteps(src, n, hasRest) {
  __iterCheck(src);
  var it = src[Symbol.iterator]();
  if (it === null || typeof it !== "object") throw new TypeError("iterator must return an object");
  var next = it.next;
  if (typeof next !== "function") throw new TypeError("iterator.next is not a function");
  var out = [];
  var done = false;
  for (var i = 0; i < n; i++) {
    var step = next.call(it);
    if (step === null || typeof step !== "object") throw new TypeError("iterator result is not an object");
    if (step.done) { done = true; break; }
    out.push(step.value);
  }
  if (hasRest) {
    while (!done) {
      var s2 = next.call(it);
      if (s2 === null || typeof s2 !== "object") throw new TypeError("iterator result is not an object");
      if (s2.done) { done = true; break; }
      out.push(s2.value);
    }
  } else if (!done) {
    // IteratorClose: a pattern that stopped early tells the iterator so, and a
    // return() that throws propagates
    var ret = it["return"];
    if (ret !== undefined && ret !== null) {
      if (typeof ret !== "function") throw new TypeError("iterator.return is not a function");
      var r = ret.call(it);
      if (r === null || typeof r !== "object") throw new TypeError("iterator result is not an object");
    }
  }
  return out;
}

function __iterCheck(src) {
  if (src === null || src === undefined) {
    throw new TypeError("Cannot destructure '" + String(src) + "' as it is " + String(src) + ".");
  }
  if (typeof src === "string") return src;
  var t = typeof src;
  if (t !== "object" && t !== "function") {
    throw new TypeError(String(src) + " is not iterable");
  }
  if (typeof src[Symbol.iterator] !== "function") {
    throw new TypeError(String(src) + " is not iterable");
  }
  return src;
}

// --- promise resolution ------------------------------------------------------
// ResolvePromise calls a thenable's `then` from a JOB, not from the resolve
// call itself, so the engine queues this wrapper as a microtask with the four
// values it already read: [thenable, then, resolveFn, rejectFn]. `then` is
// passed in rather than re-read here because the spec reads it exactly once,
// and a getter that counts its reads is the thing test262 checks.
function __thenJob(a) {
  try {
    a[1].call(a[0], a[2], a[3]);
  } catch (e) {
    a[3](e);
  }
}

// --- ESM support -------------------------------------------------------------
// Marks a module lowered from ESM source. Non-enumerable so it stays out of
// Object.keys(ns) and JSON of the exports object — a namespace object should
// show the module's own exports and nothing else.
function __esmMark(target) {
  Object.defineProperty(target, "__esModule", { value: true });
  return target;
}

// Target of the `export * from "m"` desugar. `default` is deliberately not
// re-exported by a star export, and __esModule is this lowering's own marker
// rather than one of the source module's names.
function __esmStar(target, src) {
  if (src === null || src === undefined) return target;
  for (var k in src) {
    if (k !== "default" && k !== "__esModule") target[k] = src[k];
  }
  return target;
}

// --- Number statics ----------------------------------------------------------
// Natives accept property assignment, so these are cheaper here than as natives.
Number.EPSILON = 2.220446049250313e-16;
Number.MAX_SAFE_INTEGER = 9007199254740991;
Number.MIN_SAFE_INTEGER = -9007199254740991;
Number.MAX_VALUE = 1.7976931348623157e308;
Number.MIN_VALUE = 5e-324;
Number.POSITIVE_INFINITY = Infinity;
Number.NEGATIVE_INFINITY = -Infinity;
Number.NaN = NaN;
Number.isNaN = function isNaN(v) {
  return typeof v === "number" && v !== v;
};
Number.isFinite = function isFinite(v) {
  return typeof v === "number" && v === v && v !== Infinity && v !== -Infinity;
};
Number.isInteger = function isInteger(v) {
  return Number.isFinite(v) && Math.floor(v) === v;
};
Number.isSafeInteger = function isSafeInteger(v) {
  return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
};
Number.parseFloat = parseFloat;
Number.parseInt = parseInt;

// --- BigInt statics ----------------------------------------------------------
// asUintN/asIntN wrap a BigInt to a fixed bit width; expressed with the engine's
// now-native bigint arithmetic rather than as a dedicated native.
BigInt.asUintN = function asUintN(bits, value) {
  value = BigInt(value);
  var mod = 1n << BigInt(bits);
  var r = value % mod;
  if (r < 0n) r += mod;
  return r;
};
BigInt.asIntN = function asIntN(bits, value) {
  var u = BigInt.asUintN(bits, value);
  var half = 1n << BigInt(bits - 1);
  return u >= half ? u - (1n << BigInt(bits)) : u;
};

// --- Object / Array statics --------------------------------------------------
Object.fromEntries = function fromEntries(entries) {
  var out = {};
  for (var pair of entries) out[pair[0]] = pair[1];
  return out;
};
// Array.from must accept an iterator, which the native cannot: driving next()
// means calling back into user code, and natives have no access to the program.
// Built-ins (array/string/Set/Map) fall through to the native, which handles the
// array-like case (`{length: 2}`) that has no iterator at all.
var __nativeArrayFrom = Array.from;
Array.from = function from(src, mapFn, thisArg) {
  var out;
  if (src && typeof src.next === "function") {
    out = [];
    while (true) {
      var step = src.next();
      if (step.done) break;
      out.push(step.value);
    }
  } else {
    out = __nativeArrayFrom(src);
  }
  if (typeof mapFn !== "function") return out;
  var mapped = [];
  for (var i = 0; i < out.length; i++) mapped.push(mapFn.call(thisArg, out[i], i));
  return mapped;
};
Array.of = function of() {
  var out = [];
  for (var i = 0; i < arguments.length; i++) out.push(arguments[i]);
  return out;
};

// --- Iterator helpers --------------------------------------------------------
// Installed on the shared iterator prototype the engine exposes as
// __iteratorProto, so they work on ANY iterator the engine builds — array
// iterators from arr.values() included — via the normal proto chain, rather
// than being copied onto each instance.
//
// Every helper is LAZY: take(1) on an endless source pulls exactly one element.
// `this` is the upstream iterator; each helper returns a fresh iterator that
// also inherits from __iteratorProto, so chains compose.
// Every helper begins with the same two checks, and skipping them was visible:
// `Iterator.prototype.map.call(5, fn)` answered an object instead of throwing, and
// a non-callable mapper was only caught later, by the call itself.
function __iterRequireObject(v, name) {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) {
    throw new TypeError("Iterator.prototype." + name + " called on non-object");
  }
}
function __iterRequireCallable(fn, name) {
  if (typeof fn !== "function") {
    throw new TypeError(typeof fn + " " + String(fn) + " is not a function");
  }
  return fn;
}
// take/drop take a COUNT, and the spec rejects a bad one up front rather than
// treating it as zero: NaN and any negative value are RangeErrors, and Infinity is
// legal and means "no limit".
function __iterLimit(v, name) {
  var n = Number(v);
  if (n !== n) throw new RangeError("NaN must be positive");
  if (n < 0) throw new RangeError(String(v) + " must be positive");
  return Math.trunc(n);
}

function __mkIter(nextFn, upstream) {
  var o = {
    next: nextFn,
    // closing forwards to the stage above exactly once, then no-ops
    return: function (v) {
      if (!o.__closed) {
        o.__closed = true;
        if (upstream && typeof upstream.return === "function") {
          return upstream.return(v);
        }
      }
      return { done: true, value: undefined };
    },
  };
  Object.setPrototypeOf(o, __iteratorProto);
  // %IteratorHelperPrototype% tags itself "Iterator Helper", not "Iterator" — the
  // helpers inherit from %IteratorPrototype% but are a distinct kind, and
  // Object.prototype.toString is how a test tells them apart.
  Object.defineProperty(o, Symbol.toStringTag, {
    value: "Iterator Helper", writable: false, enumerable: false, configurable: true
  });
  return o;
}

__iteratorProto[Symbol.iterator] = function () {
  return this;
};
__iteratorProto.map = function map(fn) {
  __iterRequireObject(this, "map");
  __iterRequireCallable(fn, "map");
  var it = this;
  var i = 0;
  return __mkIter(function () {
    var s = it.next();
    if (s.done) return { done: true };
    return { value: fn(s.value, i++), done: false };
  }, it);
};
__iteratorProto.filter = function filter(fn) {
  __iterRequireObject(this, "filter");
  __iterRequireCallable(fn, "filter");
  var it = this;
  var i = 0;
  return __mkIter(function () {
    while (true) {
      var s = it.next();
      if (s.done) return { done: true };
      if (fn(s.value, i++)) return { value: s.value, done: false };
    }
  }, it);
};
__iteratorProto.take = function take(n) {
  __iterRequireObject(this, "take");
  var it = this;
  var left = __iterLimit(n, "take");
  return __mkIter(function () {
    if (left <= 0) return { done: true };
    left--;
    return it.next();
  }, it);
};
__iteratorProto.drop = function drop(n) {
  __iterRequireObject(this, "drop");
  var it = this;
  var left = __iterLimit(n, "drop");
  return __mkIter(function () {
    while (left > 0) {
      left--;
      if (it.next().done) return { done: true };
    }
    return it.next();
  }, it);
};
// chunks/windows take a SIZE that is validated with no coercion at all: a
// non-number is a TypeError before valueOf or toString is consulted, and only
// an integer in [1, 2**32) is in range. That is stricter than __iterLimit, which
// take/drop use and which does coerce.
function __iterSizeArg(v, name) {
  if (typeof v !== "number") {
    throw new TypeError("Iterator.prototype." + name + " expects a number");
  }
  if (v !== v || v === Infinity || v === -Infinity || Math.trunc(v) !== v) {
    throw new TypeError("Iterator.prototype." + name + " expects an integer");
  }
  if (v < 1 || v >= 4294967296) {
    throw new RangeError("Iterator.prototype." + name + " size out of range");
  }
  return v;
}

__iteratorProto.chunks = function chunks(chunkSize) {
  __iterRequireObject(this, "chunks");
  var it = this;
  var size = __iterSizeArg(chunkSize, "chunks");
  var done = false;
  return __mkIter(function () {
    if (done) return { done: true, value: undefined };
    var buf = [];
    while (buf.length < size) {
      var step = it.next();
      if (step.done) {
        done = true;
        // A partial final chunk is still yielded; only an EMPTY one is dropped.
        if (buf.length === 0) return { done: true, value: undefined };
        return { done: false, value: buf };
      }
      buf.push(step.value);
    }
    return { done: false, value: buf };
  }, it);
};

__iteratorProto.windows = function windows(windowSize, undersized) {
  __iterRequireObject(this, "windows");
  var it = this;
  var size = __iterSizeArg(windowSize, "windows");
  var partial = false;
  if (undersized !== undefined) {
    if (undersized === "allow-partial") {
      partial = true;
    } else if (undersized !== "only-full") {
      throw new TypeError("Iterator.prototype.windows expects 'only-full' or 'allow-partial'");
    }
  }
  var buf = [];
  var done = false;
  return __mkIter(function () {
    if (done) return { done: true, value: undefined };
    while (buf.length < size) {
      var step = it.next();
      if (step.done) {
        done = true;
        // The source ran out before a full window. Only "allow-partial" yields
        // what was collected, and only when something was.
        if (partial && buf.length > 0) {
          var tail = buf;
          buf = [];
          return { done: false, value: tail };
        }
        return { done: true, value: undefined };
      }
      buf.push(step.value);
    }
    var out = buf.slice(0);
    // Slide by one: the window shares every element but the first with the next.
    buf.shift();
    return { done: false, value: out };
  }, it);
};

// SameValueZero, so NaN matches itself and +0 matches -0.
__iteratorProto.includes = function includes(searchElement) {
  __iterRequireObject(this, "includes");
  var it = this;
  var next = it.next;
  while (true) {
    var step = next.call(it);
    if (step === null || typeof step !== "object") {
      throw new TypeError("iterator result is not an object");
    }
    if (step.done) return false;
    var v = step.value;
    if (v === searchElement || (v !== v && searchElement !== searchElement)) {
      // A match closes the source: the rest is never pulled.
      if (typeof it.return === "function") it.return();
      return true;
    }
  }
};

__iteratorProto.flatMap = function flatMap(fn) {
  __iterRequireObject(this, "flatMap");
  __iterRequireCallable(fn, "flatMap");
  var it = this;
  var inner = null;
  return __mkIter(function () {
    while (true) {
      if (inner) {
        var is = inner.next();
        if (!is.done) return is;
        inner = null;
      }
      var s = it.next();
      if (s.done) return { done: true };
      // a returned array has no [Symbol.iterator] property (built-ins are
      // iterated natively), so route everything through Iterator.from
      var sub = fn(s.value);
      if (sub === null || (typeof sub !== "object" && typeof sub !== "string")) {
        throw new TypeError("Iterator.prototype.flatMap called on non-object");
      }
      inner = typeof sub.next === "function" ? sub : Iterator.from(sub);
    }
  }, it);
};
__iteratorProto.toArray = function toArray() {
  __iterRequireObject(this, "toArray");
  var out = [];
  while (true) {
    var s = this.next();
    if (s.done) return out;
    out.push(s.value);
  }
};
__iteratorProto.forEach = function forEach(fn) {
  __iterRequireObject(this, "forEach");
  __iterRequireCallable(fn, "forEach");
  var i = 0;
  while (true) {
    var s = this.next();
    if (s.done) return undefined;
    fn(s.value, i++);
  }
};
__iteratorProto.find = function find(fn) {
  __iterRequireObject(this, "find");
  __iterRequireCallable(fn, "find");
  var i = 0;
  while (true) {
    var s = this.next();
    if (s.done) return undefined;
    if (fn(s.value, i++)) return s.value;
  }
};
__iteratorProto.some = function some(fn) {
  __iterRequireObject(this, "some");
  __iterRequireCallable(fn, "some");
  var i = 0;
  while (true) {
    var s = this.next();
    if (s.done) return false;
    if (fn(s.value, i++)) return true;
  }
};
__iteratorProto.every = function every(fn) {
  __iterRequireObject(this, "every");
  __iterRequireCallable(fn, "every");
  var i = 0;
  while (true) {
    var s = this.next();
    if (s.done) return true;
    if (!fn(s.value, i++)) return false;
  }
};
__iteratorProto.reduce = function reduce(fn, init) {
  __iterRequireObject(this, "reduce");
  __iterRequireCallable(fn, "reduce");
  var acc = init;
  var first = arguments.length < 2;
  while (true) {
    var s = this.next();
    if (s.done) {
      // no seed and nothing to take one from: there is no value to return, and
      // the spec says so rather than answering undefined
      if (first) throw new TypeError("Reduce of a done iterator with no initial value");
      return acc;
    }
    if (first) {
      acc = s.value;
      first = false;
    } else {
      acc = fn(acc, s.value);
    }
  }
};

// Index-walk an array-like. Built-in arrays/strings/Set/Map are iterated natively
// by for-of and do NOT carry a [Symbol.iterator] property, so they can't be
// unwrapped the same way a user iterable can.
function __indexIter(arr) {
  var i = 0;
  return __mkIter(function () {
    if (i >= arr.length) return { done: true };
    return { value: arr[i++], done: false };
  }, null);
}

// GetIteratorFlattenable: accepts an iterable OR a bare iterator object. A
// primitive is rejected outright (a string only counts when the caller asks for
// it, which none of these do).
function __iterFlattenable(obj) {
  if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) {
    throw new TypeError("not an object");
  }
  var m = obj[Symbol.iterator];
  var it;
  if (m === undefined || m === null) {
    it = obj;
  } else {
    if (typeof m !== "function") throw new TypeError("Symbol.iterator is not callable");
    it = m.call(obj);
  }
  if (it === null || (typeof it !== "object" && typeof it !== "function")) {
    throw new TypeError("iterator is not an object");
  }
  return it;
}

function __iterStepOf(it) {
  var step = it.next();
  if (step === null || typeof step !== "object") {
    throw new TypeError("iterator result is not an object");
  }
  return step;
}

function __iterCloseQuietly(it) {
  if (it && typeof it.return === "function") it.return();
}

// Iterator.concat validates EVERY argument up front, left to right, reading each
// one's Symbol.iterator as it goes: a bad argument in position 2 throws only
// after position 1's getter has run. The inner iterators are opened lazily, one
// at a time, which is why an argument whose method returns a primitive fails at
// the first next() rather than here.
Iterator.concat = function concat() {
  var specs = [];
  for (var i = 0; i < arguments.length; i++) {
    var item = arguments[i];
    if (item === null || (typeof item !== "object" && typeof item !== "function")) {
      throw new TypeError("Iterator.concat argument is not an object");
    }
    var m = item[Symbol.iterator];
    if (typeof m !== "function") {
      throw new TypeError("Iterator.concat argument is not iterable");
    }
    specs.push({ item: item, method: m });
  }
  var idx = 0;
  var inner = null;
  return __mkIter(function () {
    while (true) {
      if (inner === null) {
        if (idx >= specs.length) return { done: true, value: undefined };
        var spec = specs[idx++];
        inner = spec.method.call(spec.item);
        if (inner === null || (typeof inner !== "object" && typeof inner !== "function")) {
          inner = null;
          throw new TypeError("Iterator.concat produced a non-object iterator");
        }
      }
      var step = __iterStepOf(inner);
      if (!step.done) return { done: false, value: step.value };
      inner = null;
    }
  }, null);
};

// The three zip modes, and the padding that only "longest" reads.
function __zipOptions(options) {
  var mode = "shortest";
  var padding = null;
  if (options !== undefined) {
    if (options === null || (typeof options !== "object" && typeof options !== "function")) {
      throw new TypeError("Iterator.zip options must be an object");
    }
    var m = options.mode;
    if (m !== undefined) {
      // No coercion: a String OBJECT spelling the right word is still a
      // TypeError, which is what separates these tests from a ToString.
      if (typeof m !== "string" || (m !== "shortest" && m !== "longest" && m !== "strict")) {
        throw new TypeError("Iterator.zip mode must be shortest, longest or strict");
      }
      mode = m;
    }
    var pad = options.padding;
    // padding is only validated in "longest" mode; the other modes ignore
    // whatever it holds, however invalid.
    if (mode === "longest" && pad !== undefined) {
      padding = __iterFlattenable(pad);
    }
  }
  return { mode: mode, padding: padding };
}

function __zipDrive(iters, opts, build) {
  var live = [];
  for (var i = 0; i < iters.length; i++) live.push(true);
  var finished = false;
  return __mkIter(function () {
    if (finished) return { done: true, value: undefined };
    var values = [];
    var doneCount = 0;
    for (var i = 0; i < iters.length; i++) {
      if (!live[i]) {
        doneCount++;
        values.push(undefined);
        continue;
      }
      var step = __iterStepOf(iters[i]);
      if (step.done) {
        live[i] = false;
        doneCount++;
        values.push(undefined);
      } else {
        values.push(step.value);
      }
    }
    if (iters.length === 0) {
      finished = true;
      return { done: true, value: undefined };
    }
    if (opts.mode === "shortest") {
      if (doneCount > 0) {
        finished = true;
        for (var c = 0; c < iters.length; c++) if (live[c]) __iterCloseQuietly(iters[c]);
        return { done: true, value: undefined };
      }
    } else if (opts.mode === "strict") {
      if (doneCount === iters.length) {
        finished = true;
        return { done: true, value: undefined };
      }
      if (doneCount > 0) {
        finished = true;
        for (var c2 = 0; c2 < iters.length; c2++) if (live[c2]) __iterCloseQuietly(iters[c2]);
        throw new TypeError("Iterator.zip strict mode requires equal lengths");
      }
    } else {
      if (doneCount === iters.length) {
        finished = true;
        return { done: true, value: undefined };
      }
      // longest: an exhausted slot draws from padding, or undefined once the
      // padding itself runs out.
      for (var q = 0; q < iters.length; q++) {
        if (!live[q]) {
          var padValue = undefined;
          if (opts.padding !== null) {
            var pstep = __iterStepOf(opts.padding);
            if (!pstep.done) padValue = pstep.value;
          }
          values[q] = padValue;
        }
      }
    }
    return { done: false, value: build(values) };
  }, null);
}

Iterator.zip = function zip(iterables, options) {
  var outer = __iterFlattenable(iterables);
  var opts = __zipOptions(options);
  var iters = [];
  while (true) {
    var step = __iterStepOf(outer);
    if (step.done) break;
    iters.push(__iterFlattenable(step.value));
  }
  return __zipDrive(iters, opts, function (vs) { return vs.slice(0); });
};

Iterator.zipKeyed = function zipKeyed(iterables, options) {
  if (iterables === null || (typeof iterables !== "object" && typeof iterables !== "function")) {
    throw new TypeError("Iterator.zipKeyed expects an object");
  }
  var opts = __zipOptions(options);
  // Own enumerable keys, strings and symbols alike, read once up front.
  var keys = Reflect.ownKeys(iterables).filter(function (k) {
    var d = Object.getOwnPropertyDescriptor(iterables, k);
    return d !== undefined && d.enumerable;
  });
  var iters = [];
  for (var i = 0; i < keys.length; i++) {
    iters.push(__iterFlattenable(iterables[keys[i]]));
  }
  return __zipDrive(iters, opts, function (vs) {
    var out = {};
    for (var j = 0; j < keys.length; j++) out[keys[j]] = vs[j];
    return out;
  });
};

for (var __zn = 0; __zn < 3; __zn++) {
  var __zname = ["concat", "zip", "zipKeyed"][__zn];
  Object.defineProperty(Iterator, __zname, {
    value: Iterator[__zname], writable: true, enumerable: false, configurable: true
  });
  Object.defineProperty(Iterator[__zname], "length", {
    value: __zname === "concat" ? 0 : (__zname === "zip" ? 1 : 1),
    writable: false, enumerable: false, configurable: true
  });
}

// A real constructor, not a bare object: `class X extends Iterator` has to give
// its instances the helpers, which only works if Iterator.prototype IS the shared
// prototype.
function Iterator() {}
Iterator.prototype = __iteratorProto;
Iterator.from = (function () {
  return function (src) {
    if (src && typeof src.next === "function") {
      // already an iterator: give it the helpers if it lacks them
      if (typeof src.map === "function") return src;
      return __mkIter(function () {
        return src.next();
      }, src);
    }
    if (src && typeof src[Symbol.iterator] === "function") {
      return Iterator.from(src[Symbol.iterator]());
    }
    return __indexIter(__nativeArrayFrom(src));
  };
})();

// --- Reflect -----------------------------------------------------------------
// Thin wrappers over operations the evaluator already has. Proxy is NOT here:
// intercepting every property access needs evaluator traps, not a JS shim.
function __reflectRequireObject(target, name) {
  if (target === null || (typeof target !== "object" && typeof target !== "function")) {
    throw new TypeError("Reflect." + name + " called on non-object");
  }
}

// ToPropertyKey, spelled out because `key in target` / `delete target[key]`
// stringify without running a user toString. Reflect coerces the key BEFORE it
// does anything else, so an object key whose toString throws must surface that
// exception rather than a stringified "[object Object]".
function __reflectKey(key) {
  return typeof key === "symbol" ? key : String(key);
}

// Reflect does NOT box its argument: Reflect.getPrototypeOf(42) is a TypeError
// where Object.getPrototypeOf(42) is Number.prototype. Every Reflect entry
// point except apply/construct requires a real object, and packages test
// exactly that boundary to tell the two apart.
//
// The five entry points backed by a __reflect* native are the ones that have to
// report a rejected operation as `false` where the Object.* spelling throws, or
// that take a `receiver` an ordinary property access has no way to supply.
// Neither can be written here: a try/catch around Object.defineProperty would
// also swallow an exception thrown by user code inside a proxy trap, which has
// to propagate.
var Reflect = {
  get: function (target, key, receiver) {
    __reflectRequireObject(target, "get");
    return arguments.length > 2 ? __reflectGet(target, key, receiver) : __reflectGet(target, key);
  },
  set: function (target, key, value, receiver) {
    __reflectRequireObject(target, "set");
    return arguments.length > 3
      ? __reflectSet(target, key, value, receiver)
      : __reflectSet(target, key, value);
  },
  has: function (target, key) {
    __reflectRequireObject(target, "has");
    return __reflectKey(key) in target;
  },
  deleteProperty: function (target, key) {
    __reflectRequireObject(target, "deleteProperty");
    return delete target[__reflectKey(key)];
  },
  ownKeys: function (target) {
    __reflectRequireObject(target, "ownKeys");
    return __reflectOwnKeys(target);
  },
  getPrototypeOf: function (target) {
    __reflectRequireObject(target, "getPrototypeOf");
    return Object.getPrototypeOf(target);
  },
  setPrototypeOf: function (target, proto) {
    __reflectRequireObject(target, "setPrototypeOf");
    if (proto !== null && typeof proto !== "object" && typeof proto !== "function") {
      throw new TypeError("Object prototype may only be an Object or null");
    }
    return __reflectSetPrototypeOf(target, proto);
  },
  isExtensible: function (target) {
    __reflectRequireObject(target, "isExtensible");
    return Object.isExtensible(target);
  },
  preventExtensions: function (target) {
    __reflectRequireObject(target, "preventExtensions");
    return __reflectPreventExtensions(target);
  },
  defineProperty: function (target, key, desc) {
    __reflectRequireObject(target, "defineProperty");
    return __reflectDefineProperty(target, key, desc);
  },
  getOwnPropertyDescriptor: function (target, key) {
    __reflectRequireObject(target, "getOwnPropertyDescriptor");
    return Object.getOwnPropertyDescriptor(target, __reflectKey(key));
  },
  apply: function (fn, thisArg, args) {
    return fn.apply(thisArg, args);
  },
  // newTarget defaults to target, and BOTH must be constructors — that check is
  // the whole of test262's isConstructor helper, which probes an engine by
  // passing the function under test as newTarget and seeing whether it throws.
  construct: function (target, args, newTarget) {
    if (!__isConstructor(target)) {
      throw new TypeError("Reflect.construct target is not a constructor");
    }
    if (arguments.length > 2 && !__isConstructor(newTarget)) {
      throw new TypeError("Reflect.construct newTarget is not a constructor");
    }
    // A DIFFERENT newTarget is the one thing `new target(...)` cannot express,
    // and a construct trap is handed it, so that case goes through __construct.
    // Everything else stays on the ordinary `new` path, which knows the exotic
    // constructors (Array, the wrappers, a napi class) that a generic
    // [[Construct]] would have to re-derive.
    if (arguments.length > 2 && newTarget !== target) {
      return __construct(target, args, newTarget);
    }
    return new target(...args);
  },
};

// An object literal makes every method enumerable and gives each the arity it
// was written with. A built-in namespace is neither: its members are
// non-enumerable, and the four that take an optional trailing argument report
// the arity WITHOUT it. test262 has a prop-desc/length pair per member.
(function () {
  var names = Object.getOwnPropertyNames(Reflect);
  for (var i = 0; i < names.length; i++) {
    var d = Object.getOwnPropertyDescriptor(Reflect, names[i]);
    d.enumerable = false;
    Object.defineProperty(Reflect, names[i], d);
  }
  var arity = { get: 2, set: 3, construct: 2 };
  for (var k in arity) {
    Object.defineProperty(Reflect[k], "length", {
      value: arity[k], writable: false, enumerable: false, configurable: true
    });
  }
  Object.defineProperty(Reflect, Symbol.toStringTag, {
    value: "Reflect", writable: false, enumerable: false, configurable: true
  });
})();

// --- Math inverse hyperbolics ------------------------------------------------
// A note on the last digit: these come out 1 ULP from node for a few inputs
// (asinh(1), atanh(0.5)). The formulas here are not the cause — the same JS
// under node gives node's answer. Math.log is: this engine calls the platform
// libm, V8 ships its own fdlibm port, and log(3) differs in the last bit
// between them. The spec makes transcendentals implementation-approximated, so
// this is a divergence to know about rather than one to chase.
// Missing entirely, so `typeof Math.atanh` was "undefined". Written from the
// spec's special-value tables rather than from the identity alone: the identity
// gives the wrong answer at the boundaries (atanh(1) is +Infinity, not NaN from
// log(2/0)), and test262 checks the boundaries before it checks any value.
Math.asinh = function asinh(x) {
  x = +x;
  if (x !== x || x === 0 || x === Infinity || x === -Infinity) return x;
  // log(x + sqrt(x*x+1)) overflows for large |x|; log(2|x|) is exact there
  if (x < 0) return -Math.asinh(-x);
  if (x > 1e150) return Math.log(2) + Math.log(x);
  // log1p form, not log(x + sqrt(x*x+1)): the direct identity loses a bit to
  // cancellation and lands 1 ULP off node for x near 1
  return Math.log1p(x + (x * x) / (1 + Math.sqrt(x * x + 1)));
};
Math.acosh = function acosh(x) {
  x = +x;
  if (x !== x) return x;
  if (x < 1) return NaN;
  if (x === 1) return 0;
  if (x === Infinity) return x;
  if (x > 1e150) return Math.log(2) + Math.log(x);
  return Math.log(x + Math.sqrt(x * x - 1));
};
Math.atanh = function atanh(x) {
  x = +x;
  if (x !== x || x === 0) return x;
  if (x < -1 || x > 1) return NaN;
  if (x === 1) return Infinity;
  if (x === -1) return -Infinity;
  // log1p form for the same reason as asinh
  return Math.log1p((2 * x) / (1 - x)) / 2;
};

// --- RegExp.escape (ES2025) --------------------------------------------------
// Escapes a string for literal use in a pattern. The spec is deliberately
// heavy-handed: it escapes every syntax character, and additionally escapes a
// LEADING digit or ascii letter so the result can never be spliced into a
// position where it would read as a back-reference or a flag.
// The escape for one character, or null when it can stay literal. Split out so the
// scanner below can copy untouched RUNS with slice instead of one character at a
// time.
// Takes the code unit the caller already read. Deriving everything from the NUMBER
// costs one index conversion per character instead of three (charAt + charCodeAt +
// a string indexOf), and in this engine an index conversion is not free — see
// docs/backlog.md on UTF-16 indexing.
function __reEscapeChar(S, i, cp) {
  if (i === 0 && ((cp >= 48 && cp <= 57) || (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122))) {
    // \x41 rather than \A: a bare backslash before a letter is a different
    // escape, so the spec spells the first character out in hex.
    return "\\x" + (cp < 16 ? "0" : "") + cp.toString(16);
  }
  // ^ $ \ . * + ? ( ) [ ] { } | /  as code units, so no substring search runs
  if (cp === 94 || cp === 36 || cp === 92 || cp === 46 || cp === 42 || cp === 43 ||
      cp === 63 || cp === 40 || cp === 41 || cp === 91 || cp === 93 || cp === 123 ||
      cp === 125 || cp === 124 || cp === 47) {
    return "\\" + String.fromCharCode(cp);
  }
  // ES2025 "other punctuators", plus WhiteSpace. These are escaped as \xNN so the
  // result stays safe wherever it is spliced: `-` inside a character class would
  // otherwise read as a range, and the rest can terminate or alter a surrounding
  // construct. milojs escaped none of them, which is 17 code points' worth of
  // wrong output; tests/regexpEscape.js diffs the whole range against node.
  if (cp === 32 || cp === 33 || cp === 34 || cp === 35 || cp === 37 || cp === 38 ||
      cp === 39 || cp === 44 || cp === 45 || cp === 58 || cp === 59 || cp === 60 ||
      cp === 61 || cp === 62 || cp === 64 || cp === 96 || cp === 126) {
    return "\\x" + (cp < 16 ? "0" : "") + cp.toString(16);
  }
  if (cp === 9) return "\\t";
  if (cp === 10) return "\\n";
  if (cp === 11) return "\\v";
  if (cp === 12) return "\\f";
  if (cp === 13) return "\\r";
  if (cp === 0x2028 || cp === 0x2029 || cp === 0xa0 || cp === 0xfeff) {
    // Below 256 the spec spells it \xNN, not \u00NN: U+00A0 came out as \u00a0.
    if (cp <= 0xff) return "\\x" + cp.toString(16);
    return "\\u" + ("0000" + cp.toString(16)).slice(-4);
  }
  // A lone surrogate cannot round-trip as itself.
  if (cp >= 0xd800 && cp <= 0xdfff) {
    var paired = cp < 0xdc00 && i + 1 < S.length &&
      S.charCodeAt(i + 1) >= 0xdc00 && S.charCodeAt(i + 1) <= 0xdfff;
    if (!paired) return "\\u" + ("0000" + cp.toString(16)).slice(-4);
  }
  return null;
}

// Collects untouched runs and joins once. The obvious `out += c` per character is
// quadratic in this engine — every `+=` copies the whole accumulator, so escaping
// a 100k-character string took 38 SECONDS and timed out quickjs's bug1571. Almost
// no character needs escaping, so slicing the runs makes the work proportional to
// the number of escapes rather than to the length.
RegExp.escape = function escape(S) {
  if (typeof S !== "string") {
    throw new TypeError("input argument must be a string");
  }
  var parts = [];
  var runStart = 0;
  for (var i = 0; i < S.length; i++) {
    var esc = __reEscapeChar(S, i, S.charCodeAt(i));
    if (esc === null) continue;
    if (i > runStart) parts.push(S.slice(runStart, i));
    parts.push(esc);
    runStart = i + 1;
  }
  if (runStart < S.length) parts.push(S.slice(runStart));
  return parts.join("");
};

// --- Promise.try (ES2025) ----------------------------------------------------
// Runs a function and captures a synchronous throw as a rejection, which is the
// whole point: `Promise.resolve().then(f)` defers f by a tick, and
// `new Promise(r => r(f()))` lets a synchronous throw escape the constructor.
Promise.try = function _try(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function (resolve, reject) {
    try { resolve(fn.apply(undefined, args)); } catch (e) { reject(e); }
  });
};

// --- Error.isError (ES2025) --------------------------------------------------
// A brand check, not a prototype check: it must answer true for an error from
// another realm and false for `Object.create(Error.prototype)`. This engine tags
// error objects natively, and Object.prototype.toString reports that tag.
Error.isError = function isError(v) {
  if (v === null || typeof v !== "object") return false;
  return Object.prototype.toString.call(v) === "[object Error]";
};

// --- atob / btoa -------------------------------------------------------------
// Base64 over a BINARY STRING (one character per byte), which is what the web
// platform specifies and what quickjs's suite exercises. Not the Uint8Array
// base64 proposal, which is a separate surface.
var __b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function btoa(data) {
  var s = String(data);
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    // btoa encodes BYTES: anything above 0xFF cannot round-trip and the spec
    // makes it an error rather than silently truncating.
    if (c > 0xff) {
      throw new DOMException("btoa: string contains a character outside of the Latin1 range", "InvalidCharacterError");
    }
  }
  for (var j = 0; j < s.length; j += 3) {
    var b0 = s.charCodeAt(j) & 0xff;
    var b1 = j + 1 < s.length ? s.charCodeAt(j + 1) & 0xff : 0;
    var b2 = j + 2 < s.length ? s.charCodeAt(j + 2) & 0xff : 0;
    out += __b64chars.charAt(b0 >> 2);
    out += __b64chars.charAt(((b0 & 3) << 4) | (b1 >> 4));
    out += j + 1 < s.length ? __b64chars.charAt(((b1 & 15) << 2) | (b2 >> 6)) : "=";
    out += j + 2 < s.length ? __b64chars.charAt(b2 & 63) : "=";
  }
  return out;
}

function atob(data) {
  var s = String(data);
  // ASCII whitespace is stripped before decoding, per the web spec
  var t = "";
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i);
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r" && ch !== "\f") t += ch;
  }
  if (t.length % 4 === 0) {
    if (t.charAt(t.length - 1) === "=") t = t.slice(0, -1);
    if (t.charAt(t.length - 1) === "=") t = t.slice(0, -1);
  }
  if (t.length % 4 === 1) {
    throw new DOMException("atob: invalid base64 length", "InvalidCharacterError");
  }
  var out = "";
  var acc = 0;
  var nbits = 0;
  for (var k = 0; k < t.length; k++) {
    var v = __b64chars.indexOf(t.charAt(k));
    if (v < 0) {
      throw new DOMException("atob: invalid base64 character", "InvalidCharacterError");
    }
    acc = (acc << 6) | v;
    nbits += 6;
    if (nbits >= 8) {
      nbits -= 8;
      out += String.fromCharCode((acc >> nbits) & 0xff);
    }
  }
  return out;
}

// --- Math.sumPrecise (ES2026) ------------------------------------------------
// The exactly-rounded sum of a list, which a left-to-right `+=` cannot give:
// [1, EPSILON/2, MIN_VALUE] is 1.0000000000000002, not 1. Shewchuk's algorithm
// keeps a list of non-overlapping partial sums, each the exact error left over
// from the one before, so nothing is discarded until the final add.
Math.sumPrecise = function sumPrecise(items) {
  if (items === null || items === undefined) {
    throw new TypeError("Math.sumPrecise requires an iterable");
  }
  var values = [];
  for (var v of items) {
    if (typeof v !== "number") {
      throw new TypeError("Math.sumPrecise: every element must be a Number");
    }
    values.push(v);
  }
  if (values.length === 0) return -0;
  var partials = [];
  var sawPosInf = false, sawNegInf = false, sawNaN = false;
  for (var i = 0; i < values.length; i++) {
    var x = values[i];
    if (x !== x) { sawNaN = true; continue; }
    if (x === Infinity) { sawPosInf = true; continue; }
    if (x === -Infinity) { sawNegInf = true; continue; }
    var used = 0;
    for (var j = 0; j < partials.length; j++) {
      var y = partials[j];
      if (Math.abs(x) < Math.abs(y)) { var swap = x; x = y; y = swap; }
      var hi = x + y;
      var lo = y - (hi - x);
      if (lo !== 0) { partials[used++] = lo; }
      x = hi;
    }
    partials.length = used;
    partials.push(x);
  }
  if (sawNaN) return NaN;
  // both infinities present is an indeterminate form
  if (sawPosInf && sawNegInf) return NaN;
  if (sawPosInf) return Infinity;
  if (sawNegInf) return -Infinity;
  // Summing the partials naively re-loses what they were kept for: for
  // [1, EPSILON/2, MIN_VALUE] the partials are exact, but adding them
  // smallest-first rounds the tiny ones away and answers 1 instead of
  // 1.0000000000000002. The exact sum sits just above the tie 1 + 2^-53, so the
  // result must round UP, and knowing that needs the partials BELOW the tie.
  //
  // This is CPython's math.fsum ending: add from the top until the addition first
  // becomes inexact, then use the sign of the next partial down to decide the
  // half-even tie.
  var n = partials.length;
  var total = 0;
  if (n > 0) {
    total = partials[--n];
    var lo = 0;
    while (n > 0) {
      var x = total;
      var y = partials[--n];
      total = x + y;
      var yr = total - x;
      lo = y - yr;
      if (lo !== 0) break;
    }
    if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
      var y2 = lo * 2;
      var x2 = total + y2;
      if (y2 === x2 - total) total = x2;
    }
  }
  return total;
};

// --- DisposableStack (explicit resource management) --------------------------
// Holds disposers and runs them in REVERSE order, so resources unwind the way
// nested blocks would. This is the explicit form; `using x = ...` declarations are
// handled by the evaluator and share the same ordering rule.
(function () {
  var DISPOSED = "__disposed";
  var STACK = "__stack";

  function DisposableStack() {
    if (!(this instanceof DisposableStack)) {
      throw new TypeError("Constructor DisposableStack requires 'new'");
    }
    this[STACK] = [];
    this[DISPOSED] = false;
  }
  function check(self) {
    if (!self || !(STACK in self)) {
      throw new TypeError("not a DisposableStack");
    }
    if (self[DISPOSED]) {
      throw new ReferenceError("DisposableStack is disposed");
    }
  }
  DisposableStack.prototype.use = function use(value) {
    check(this);
    if (value === null || value === undefined) return value;
    var d = value[Symbol.dispose];
    if (typeof d !== "function") {
      throw new TypeError("value is not disposable");
    }
    this[STACK].push(function () { d.call(value); });
    return value;
  };
  DisposableStack.prototype.adopt = function adopt(value, onDispose) {
    check(this);
    if (typeof onDispose !== "function") {
      throw new TypeError("onDispose is not a function");
    }
    this[STACK].push(function () { onDispose(value); });
    return value;
  };
  DisposableStack.prototype.defer = function defer(onDispose) {
    check(this);
    if (typeof onDispose !== "function") {
      throw new TypeError("onDispose is not a function");
    }
    this[STACK].push(onDispose);
  };
  DisposableStack.prototype.move = function move() {
    check(this);
    var next = new DisposableStack();
    next[STACK] = this[STACK];
    this[STACK] = [];
    this[DISPOSED] = true;
    return next;
  };
  DisposableStack.prototype.dispose = function dispose() {
    if (this[DISPOSED]) return undefined;
    this[DISPOSED] = true;
    var list = this[STACK];
    this[STACK] = [];
    // reverse order, and a throw from one disposer does not skip the rest
    var pending = null;
    var threw = false;
    for (var i = list.length - 1; i >= 0; i--) {
      try { list[i](); } catch (e) { pending = e; threw = true; }
    }
    if (threw) throw pending;
    return undefined;
  };
  DisposableStack.prototype[Symbol.dispose] = DisposableStack.prototype.dispose;
  Object.defineProperty(DisposableStack.prototype, "disposed", {
    get: function () { check_disposed_ok: { } return this[DISPOSED] === true; },
    enumerable: false, configurable: true
  });
  globalThis.DisposableStack = DisposableStack;
})();

// --- AsyncDisposableStack (explicit resource management) ---------------------
// The async sibling of DisposableStack. `disposeAsync` returns a promise and
// awaits each disposer in turn, so resources release in reverse order and one
// slow disposer does not overlap the next. Disposers are collected through
// [Symbol.asyncDispose], falling back to [Symbol.dispose] for a resource that is
// only synchronously disposable.
(function () {
  var DISPOSED = "__adisposed";
  var STACK = "__astack";

  function AsyncDisposableStack() {
    if (!(this instanceof AsyncDisposableStack)) {
      throw new TypeError("Constructor AsyncDisposableStack requires 'new'");
    }
    this[STACK] = [];
    this[DISPOSED] = false;
  }
  function check(self) {
    if (!self || !(STACK in self)) {
      throw new TypeError("not an AsyncDisposableStack");
    }
    if (self[DISPOSED]) {
      throw new ReferenceError("AsyncDisposableStack is disposed");
    }
  }
  AsyncDisposableStack.prototype.use = function use(value) {
    check(this);
    if (value === null || value === undefined) return value;
    var d = value[Symbol.asyncDispose];
    if (typeof d !== "function") d = value[Symbol.dispose];
    if (typeof d !== "function") {
      throw new TypeError("value is not async disposable");
    }
    this[STACK].push(function () { return d.call(value); });
    return value;
  };
  AsyncDisposableStack.prototype.adopt = function adopt(value, onDisposeAsync) {
    check(this);
    if (typeof onDisposeAsync !== "function") {
      throw new TypeError("onDisposeAsync is not a function");
    }
    this[STACK].push(function () { return onDisposeAsync(value); });
    return value;
  };
  AsyncDisposableStack.prototype.defer = function defer(onDisposeAsync) {
    check(this);
    if (typeof onDisposeAsync !== "function") {
      throw new TypeError("onDisposeAsync is not a function");
    }
    this[STACK].push(onDisposeAsync);
  };
  AsyncDisposableStack.prototype.move = function move() {
    check(this);
    var next = new AsyncDisposableStack();
    next[STACK] = this[STACK];
    this[STACK] = [];
    this[DISPOSED] = true;
    return next;
  };
  AsyncDisposableStack.prototype.disposeAsync = function disposeAsync() {
    if (this[DISPOSED]) return Promise.resolve(undefined);
    this[DISPOSED] = true;
    var list = this[STACK];
    this[STACK] = [];
    var i = list.length - 1;
    var pending = null;
    var threw = false;
    // Sequential, not Promise.all: the ordering guarantee is the point, and a
    // disposer that throws must not stop the remaining ones from running.
    function step() {
      if (i < 0) {
        if (threw) throw pending;
        return undefined;
      }
      var f = list[i--];
      return Promise.resolve()
        .then(function () { return f(); })
        .then(step, function (e) { pending = e; threw = true; return step(); });
    }
    return Promise.resolve().then(step);
  };
  AsyncDisposableStack.prototype[Symbol.asyncDispose] = AsyncDisposableStack.prototype.disposeAsync;
  Object.defineProperty(AsyncDisposableStack.prototype, "disposed", {
    get: function () { return this[DISPOSED] === true; },
    enumerable: false, configurable: true
  });
  globalThis.AsyncDisposableStack = AsyncDisposableStack;
})();

// --- built-in methods are not constructors -----------------------------------
// Everything in this file is an ordinary JS function as far as the evaluator is
// concerned, and an ordinary function has [[Construct]]. A built-in METHOD does
// not. Walking the namespaces and marking what is found keeps the list from
// having to be maintained by hand as builtins are added.
//
// `constructor` and `prototype` are skipped: Array.prototype.constructor IS
// Array, and marking it would make `new Array()` fail.
function __markBuiltinMethods(obj) {
  if (obj === null || obj === undefined) return;
  var names = Object.getOwnPropertyNames(obj);
  for (var i = 0; i < names.length; i++) {
    var k = names[i];
    if (k === "constructor" || k === "prototype") continue;
    var d = Object.getOwnPropertyDescriptor(obj, k);
    if (!d) continue;
    if (typeof d.value === "function") __markNotConstructor(d.value);
    if (typeof d.get === "function") __markNotConstructor(d.get);
    if (typeof d.set === "function") __markNotConstructor(d.set);
  }
}

(function () {
  var hosts = [Object, Array, String, Number, Boolean, Math, JSON, Reflect,
               Symbol, Promise, Map, Set, WeakMap, WeakSet, ArrayBuffer,
               DataView, Date, RegExp, Error, Proxy, Function];
  for (var i = 0; i < hosts.length; i++) {
    var h = hosts[i];
    if (h === null || h === undefined) continue;
    __markBuiltinMethods(h);
    __markBuiltinMethods(h.prototype);
  }
})();

// --- Symbol registry ---------------------------------------------------------
// Symbols are interned strings ("@@sym:<desc>:<n>") in this engine, so a registry
// keyed by description gives Symbol.for its required identity guarantee:
// Symbol.for(k) === Symbol.for(k).
(function () {
  var registry = {};
  Symbol.for = function (key) {
    var k = String(key);
    if (!(k in registry)) registry[k] = Symbol(k);
    return registry[k];
  };
  Symbol.keyFor = function (sym) {
    for (var k in registry) if (registry[k] === sym) return k;
    return undefined;
  };
})();

// --- Error.captureStackTrace -------------------------------------------------
// V8-specific but relied on widely. There are no real frames to walk here, so it
// only installs the property the callers expect to find.
Error.captureStackTrace = function captureStackTrace(obj, _ctor) {
  if (obj && typeof obj === "object") obj.stack = "";
};

// --- escape / unescape (Annex B) ---------------------------------------------
var ESCAPE_SAFE = "@*_+-./";
function escape(s) {
  var str = String(s);
  var out = "";
  for (var i = 0; i < str.length; i++) {
    var c = str.charAt(i);
    var n = str.charCodeAt(i);
    var alnum =
      (n >= 48 && n <= 57) || (n >= 65 && n <= 90) || (n >= 97 && n <= 122);
    if (alnum || ESCAPE_SAFE.indexOf(c) >= 0) {
      out += c;
    } else if (n < 256) {
      out += "%" + (n < 16 ? "0" : "") + n.toString(16).toUpperCase();
    } else {
      var h = n.toString(16).toUpperCase();
      while (h.length < 4) h = "0" + h;
      out += "%u" + h;
    }
  }
  return out;
}
function unescape(s) {
  var str = String(s);
  var out = "";
  for (var i = 0; i < str.length; i++) {
    if (str.charAt(i) === "%" && str.charAt(i + 1) === "u") {
      out += String.fromCharCode(parseInt(str.substring(i + 2, i + 6), 16));
      i += 5;
    } else if (str.charAt(i) === "%") {
      out += String.fromCharCode(parseInt(str.substring(i + 1, i + 3), 16));
      i += 2;
    } else {
      out += str.charAt(i);
    }
  }
  return out;
}

// --- WeakRef / FinalizationRegistry ------------------------------------------
// Both hold their targets STRONGLY: the mark-sweep collector has no weak-reference
// support, so deref() never returns undefined and registered callbacks never fire.
// Enough for code that merely constructs and derefs them; a test asserting that a
// target was actually collected will (correctly) fail.
// The brand checks are not decoration: is-weakref and is-finalizationregistry
// detect these by calling the prototype method on a candidate and catching the
// TypeError, so a method that quietly accepts any receiver reports every object
// as a WeakRef.
class WeakRef {
  constructor(target) {
    this._target = target;
  }
  deref() {
    if (!this || typeof this !== "object" || !("_target" in this)) {
      throw new TypeError("Method WeakRef.prototype.deref called on incompatible receiver");
    }
    return this._target;
  }
}
class FinalizationRegistry {
  constructor(callback) {
    this._callback = callback;
  }
  register(_target, _held, _token) {
    if (!this || typeof this !== "object" || !("_callback" in this)) {
      throw new TypeError("Method FinalizationRegistry.prototype.register called on incompatible receiver");
    }
  }
  unregister(_token) {
    if (!this || typeof this !== "object" || !("_callback" in this)) {
      throw new TypeError("Method FinalizationRegistry.prototype.unregister called on incompatible receiver");
    }
    return false;
  }
}

// --- DOMException ------------------------------------------------------------
var DOM_ERROR_CODES = {
  IndexSizeError: 1,
  HierarchyRequestError: 3,
  WrongDocumentError: 4,
  InvalidCharacterError: 5,
  NoModificationAllowedError: 7,
  NotFoundError: 8,
  NotSupportedError: 9,
  InUseAttributeError: 10,
  InvalidStateError: 11,
  SyntaxError: 12,
  InvalidModificationError: 13,
  NamespaceError: 14,
  InvalidAccessError: 15,
  TypeMismatchError: 17,
  SecurityError: 18,
  NetworkError: 19,
  AbortError: 20,
  URLMismatchError: 21,
  QuotaExceededError: 22,
  TimeoutError: 23,
  InvalidNodeTypeError: 24,
  DataCloneError: 25,
};
// message, name and code live on the PROTOTYPE, not on the instance: node puts
// only `stack` on a DOMException as an own property, and the difference is
// directly observable through Object.getOwnPropertyNames. They were own
// accessors here, which reported |name,message,stack,code| where node reports
// |stack|. Backed by a symbol-keyed slot, which getOwnPropertyNames does not
// report either.
var DOM_SLOT = Symbol("DOMException internals");
class DOMException extends Error {
  constructor(message, name) {
    // super() with NO argument on purpose: Error defines an own `message` only
    // when it is passed one, and an own `message` is exactly what must not exist
    super();
    Object.defineProperty(this, DOM_SLOT, {
      value: {
        message: message === undefined ? "" : String(message),
        name: name === undefined ? "Error" : String(name),
      },
      enumerable: false, writable: false, configurable: false,
    });
  }
}
function __domSlot(self, what) {
  var slot = self === null || self === undefined ? undefined : self[DOM_SLOT];
  if (slot === undefined) throw new TypeError("DOMException.prototype." + what + " called on a non-DOMException");
  return slot;
}
function __domAccessor(prop, read) {
  Object.defineProperty(DOMException.prototype, prop, {
    get: function () { return read(__domSlot(this, prop)); },
    // read-only, and assigning must THROW rather than silently do nothing
    set: function () { throw new TypeError("DOMException." + prop + " is read-only"); },
    enumerable: false,
    configurable: true,
  });
}
__domAccessor("message", function (s) { return s.message; });
__domAccessor("name", function (s) { return s.name; });
__domAccessor("code", function (s) {
  // own-property check, not a bare index: a name of "constructor" or "toString"
  // would otherwise pick a function off Object.prototype and return it as a code
  return Object.prototype.hasOwnProperty.call(DOM_ERROR_CODES, s.name) ? DOM_ERROR_CODES[s.name] : 0;
});

// The legacy DOMException.*_ERR constants live on both the constructor and every
// instance, and are named differently from the error names above.
var DOM_LEGACY_CODES = {
  INDEX_SIZE_ERR: 1,
  DOMSTRING_SIZE_ERR: 2,
  HIERARCHY_REQUEST_ERR: 3,
  WRONG_DOCUMENT_ERR: 4,
  INVALID_CHARACTER_ERR: 5,
  NO_DATA_ALLOWED_ERR: 6,
  NO_MODIFICATION_ALLOWED_ERR: 7,
  NOT_FOUND_ERR: 8,
  NOT_SUPPORTED_ERR: 9,
  INUSE_ATTRIBUTE_ERR: 10,
  INVALID_STATE_ERR: 11,
  SYNTAX_ERR: 12,
  INVALID_MODIFICATION_ERR: 13,
  NAMESPACE_ERR: 14,
  INVALID_ACCESS_ERR: 15,
  VALIDATION_ERR: 16,
  TYPE_MISMATCH_ERR: 17,
  SECURITY_ERR: 18,
  NETWORK_ERR: 19,
  ABORT_ERR: 20,
  URL_MISMATCH_ERR: 21,
  QUOTA_EXCEEDED_ERR: 22,
  TIMEOUT_ERR: 23,
  INVALID_NODE_TYPE_ERR: 24,
  DATA_CLONE_ERR: 25,
};
for (var __k in DOM_LEGACY_CODES) {
  DOMException[__k] = DOM_LEGACY_CODES[__k];
  DOMException.prototype[__k] = DOM_LEGACY_CODES[__k];
}

// --- Array.fromAsync ---------------------------------------------------------
Array.fromAsync = async function (items, mapFn, thisArg) {
  var out = [];
  var i = 0;
  for (var item of items) {
    var v = await item;
    out.push(mapFn ? await mapFn.call(thisArg, v, i) : v);
    i++;
  }
  return out;
};

// --- WeakMap / WeakSet -------------------------------------------------------
// The engine aliases these to Map/Set natives, which accept ANY key. The spec
// requires a TypeError for primitives (and for registered symbols), which real
// code relies on to catch mistakes — so they are real classes here.
//
// They still hold their keys STRONGLY: the collector has no weak references, so
// entries are never dropped. A test asserting that a key disappeared after its
// last reference died will correctly fail rather than pass vacuously.
function __weakKeyOk(k) {
  var t = typeof k;
  if (t === "object") return k !== null;
  if (t === "function") return true;
  // an unregistered symbol is a valid weak key; Symbol.for() ones are not
  if (t === "symbol") return Symbol.keyFor(k) === undefined;
  return false;
}

class WeakMap {
  constructor(entries) {
    this._m = new Map();
    if (entries) {
      for (var pair of entries) this.set(pair[0], pair[1]);
    }
  }
  set(k, v) {
    if (!__weakKeyOk(k)) throw new TypeError("invalid value used as WeakMap key");
    this._m.set(k, v);
    return this;
  }
  get(k) {
    return this._m.get(k);
  }
  has(k) {
    return this._m.has(k);
  }
  delete(k) {
    return this._m.delete(k);
  }
}

class WeakSet {
  constructor(values) {
    this._s = new Set();
    if (values) {
      for (var v of values) this.add(v);
    }
  }
  add(v) {
    if (!__weakKeyOk(v)) throw new TypeError("invalid value used as WeakSet key");
    this._s.add(v);
    return this;
  }
  has(v) {
    return this._s.has(v);
  }
  delete(v) {
    return this._s.delete(v);
  }
}

// --- Iterator.prototype accessors --------------------------------------------
// The spec defines Iterator.prototype[@@toStringTag] and .constructor as
// get/set ACCESSOR pairs, not data properties, with
// SetterThatIgnoresPrototypeProperties semantics: assigning through an inheriting
// object defines an own property on that object, while assigning directly on
// Iterator.prototype itself throws. Real code reads these descriptors (frameworks
// probe .constructor), so the shape has to be right, not just the value.
// (Symbol.toStringTag is provided natively — a stable interned @@iterator-style
// key that Object.prototype.toString consults; do NOT reassign it here or that
// native lookup and this one diverge.)

// `__proto__` is an ACCESSOR on Object.prototype in the spec, and dunder-proto
// pulls its getter straight off the descriptor rather than using the syntax. The
// evaluator short-circuits __proto__ reads and writes before any chain walk, so
// this property is what makes the descriptor VISIBLE; it is not what implements
// the behaviour.
Object.defineProperty(Object.prototype, "__proto__", {
  get: function () {
    return Object.getPrototypeOf(this);
  },
  set: function (v) {
    Object.setPrototypeOf(this, v);
  },
  enumerable: false,
  configurable: true,
});

function __protoIgnoringSetter(home, key, label) {
  return function (v) {
    // a primitive receiver has nowhere to define an own property
    if (this === undefined || this === null || typeof this !== "object") {
      throw new TypeError("cannot set " + label + " on a non-object");
    }
    if (this === home) {
      throw new TypeError("cannot set " + label + " on the prototype itself");
    }
    var existing = Object.getOwnPropertyDescriptor(this, key);
    if (existing && existing.writable === false) {
      throw new TypeError(label + " is not writable");
    }
    // CreateDataPropertyOrThrow: adding to a non-extensible receiver throws
    if (!existing && !Object.isExtensible(this)) {
      throw new TypeError("cannot add " + label + " to a non-extensible object");
    }
    Object.defineProperty(this, key, {
      value: v,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return undefined;
  };
}

Object.defineProperty(__iteratorProto, Symbol.toStringTag, {
  get: function () {
    return "Iterator";
  },
  set: __protoIgnoringSetter(__iteratorProto, Symbol.toStringTag, "@@toStringTag"),
  enumerable: false,
  configurable: true,
});

Object.defineProperty(__iteratorProto, "constructor", {
  get: function () {
    return Iterator;
  },
  set: __protoIgnoringSetter(__iteratorProto, "constructor", "constructor"),
  enumerable: false,
  configurable: true,
});

// --- Promise combinators -----------------------------------------------------
// The native versions read each element's settled value SYNCHRONOUSLY at call
// time, so a promise still pending contributed undefined:
//   Promise.all([slowPromise, Promise.resolve(1)])  ->  [null, 1]
// Written here instead, on top of .then, so they actually wait. Doing it in JS
// also means a rejection inside allSettled is genuinely handled, rather than
// surfacing as a bogus "unhandled promise rejection".
// NewPromiseCapability. The combinators are generic over their `this`: called
// on a subclass or on any constructor, they must build the result with THAT
// constructor and take its resolve/reject from the executor it invokes. Hard
// coding `new Promise` ignored the receiver entirely, so a capability whose
// executor throws, is called twice, or hands back a non-callable pair could not
// be observed at all.
function __newPromiseCapability(C) {
  if (C === null || (typeof C !== "object" && typeof C !== "function")) {
    throw new TypeError("Promise capability requires a constructor");
  }
  var cap = { promise: undefined, resolve: undefined, reject: undefined };
  cap.promise = new C(function (resolve, reject) {
    // GetCapabilitiesExecutor rejects a SECOND call, which is how a constructor
    // that invokes its executor twice is caught.
    if (cap.resolve !== undefined || cap.reject !== undefined) {
      throw new TypeError("Promise executor has already been invoked");
    }
    cap.resolve = resolve;
    cap.reject = reject;
  });
  if (typeof cap.resolve !== "function" || typeof cap.reject !== "function") {
    throw new TypeError("Promise resolve or reject function is not callable");
  }
  return cap;
}

// The `resolve` a combinator uses for each element is read off the receiver
// ONCE, before the iteration, and must be callable.
function __speciesResolve(C) {
  var r = C.resolve;
  if (typeof r !== "function") {
    throw new TypeError("Promise resolve is not a function");
  }
  return r;
}

Promise.all = function all(items) {
  var C = this;
  var cap = __newPromiseCapability(C);
  try {
    var resolveFn = __speciesResolve(C);
    var list = Array.from(items);
    var out = [];
    var remaining = list.length;
    if (remaining === 0) {
      cap.resolve(out);
      return cap.promise;
    }
    for (var i = 0; i < list.length; i++) {
      (function (idx, item) {
        resolveFn.call(C, item).then(
          function (v) {
            out[idx] = v;
            remaining--;
            if (remaining === 0) cap.resolve(out);
          },
          function (e) {
            cap.reject(e);
          }
        );
      })(i, list[i]);
    }
  } catch (e) {
    cap.reject(e);
  }
  return cap.promise;
};

Promise.allSettled = function allSettled(items) {
  var C = this;
  var cap = __newPromiseCapability(C);
  try {
    var resolveFn = __speciesResolve(C);
    var list = Array.from(items);
    var out = [];
    var remaining = list.length;
    if (remaining === 0) {
      cap.resolve(out);
      return cap.promise;
    }
    for (var i = 0; i < list.length; i++) {
      (function (idx, item) {
        resolveFn.call(C, item).then(
          function (v) {
            out[idx] = { status: "fulfilled", value: v };
            remaining--;
            if (remaining === 0) cap.resolve(out);
          },
          function (e) {
            out[idx] = { status: "rejected", reason: e };
            remaining--;
            if (remaining === 0) cap.resolve(out);
          }
        );
      })(i, list[i]);
    }
  } catch (e) {
    cap.reject(e);
  }
  return cap.promise;
};

Promise.race = function race(items) {
  var C = this;
  var cap = __newPromiseCapability(C);
  try {
    var resolveFn = __speciesResolve(C);
    var list = Array.from(items);
    for (var i = 0; i < list.length; i++) {
      resolveFn.call(C, list[i]).then(cap.resolve, cap.reject);
    }
  } catch (e) {
    cap.reject(e);
  }
  return cap.promise;
};

// AggregateError: real error subclass carrying the failures on .errors.
function AggregateError(errors, message) {
  var e = new Error(message);
  Object.setPrototypeOf(e, AggregateError.prototype);
  e.name = "AggregateError";
  e.errors = Array.from(errors || []);
  return e;
}
AggregateError.prototype = Object.create(Error.prototype);
AggregateError.prototype.constructor = AggregateError;
AggregateError.prototype.name = "AggregateError";

Promise.any = function any(items) {
  var C = this;
  var cap = __newPromiseCapability(C);
  try {
    var resolveFn = __speciesResolve(C);
    var list = Array.from(items);
    var remaining = list.length;
    var errors = [];
    if (remaining === 0) {
      cap.reject(new AggregateError([], "All promises were rejected"));
      return cap.promise;
    }
    for (var i = 0; i < list.length; i++) {
      (function (idx, item) {
        resolveFn.call(C, item).then(cap.resolve, function (e) {
          errors[idx] = e;
          remaining--;
          if (remaining === 0) cap.reject(new AggregateError(errors, "All promises were rejected"));
        });
      })(i, list[i]);
    }
  } catch (e) {
    cap.reject(e);
  }
  return cap.promise;
};

// --- Annex B object accessors ------------------------------------------------
// __defineGetter__ and friends. Legacy, but normative in Annex B and widely
// probed: several packages feature-detect an environment by their presence.
(function () {
  function toObj(v, name) {
    if (v === null || v === undefined) {
      throw new TypeError("Object.prototype." + name + " called on null or undefined");
    }
    return Object(v);
  }
  function define(name, kind) {
    return function (key, fn) {
      var O = toObj(this, name);
      if (typeof fn !== "function") {
        throw new TypeError("Object.prototype." + name + " expects a function");
      }
      var desc = { enumerable: true, configurable: true };
      desc[kind] = fn;
      // ToPropertyKey runs BEFORE the descriptor is applied, so a key whose
      // toString throws surfaces that rather than defining anything.
      Object.defineProperty(O, typeof key === "symbol" ? key : String(key), desc);
      return undefined;
    };
  }
  function lookup(name, kind) {
    return function (key) {
      var O = toObj(this, name);
      var k = typeof key === "symbol" ? key : String(key);
      // The whole prototype chain, own property first: the nearest definition
      // wins, and a DATA property on the way shadows a getter further up.
      while (O !== null) {
        var d = Object.getOwnPropertyDescriptor(O, k);
        if (d !== undefined) return d[kind];
        O = Object.getPrototypeOf(O);
      }
      return undefined;
    };
  }
  var defs = [
    ["__defineGetter__", define("__defineGetter__", "get"), 2],
    ["__defineSetter__", define("__defineSetter__", "set"), 2],
    ["__lookupGetter__", lookup("__lookupGetter__", "get"), 1],
    ["__lookupSetter__", lookup("__lookupSetter__", "set"), 1]
  ];
  for (var i = 0; i < defs.length; i++) {
    var nm = defs[i][0], fn = defs[i][1], len = defs[i][2];
    Object.defineProperty(fn, "name", { value: nm, writable: false, enumerable: false, configurable: true });
    Object.defineProperty(fn, "length", { value: len, writable: false, enumerable: false, configurable: true });
    Object.defineProperty(Object.prototype, nm, { value: fn, writable: true, enumerable: false, configurable: true });
  }
})();

// --- Atomics -----------------------------------------------------------------
// This engine runs one agent, so an "atomic" read-modify-write is just a
// read-modify-write: nothing else can observe the intermediate state. What the
// spec still pins down, and what test262 checks case by case, is the VALIDATION
// and the return values, which is what this is for.
//
// Written in JS rather than as natives because every operation is expressible
// through ordinary element access, and the ordering rules (validate the array,
// then the index, then coerce the value) fall out of writing them in order.
(function () {
  // ValidateIntegerTypedArray: the waitable and non-waitable integer types.
  // Uint8ClampedArray and the float types are NOT among them, and neither is a
  // DataView, so each is a TypeError rather than a silently wrong answer.
  var INT_TYPES = {
    "[object Int8Array]": 1, "[object Uint8Array]": 1,
    "[object Int16Array]": 1, "[object Uint16Array]": 1,
    "[object Int32Array]": 1, "[object Uint32Array]": 1,
    "[object BigInt64Array]": 1, "[object BigUint64Array]": 1
  };
  var BIG_TYPES = { "[object BigInt64Array]": 1, "[object BigUint64Array]": 1 };
  // wait/notify are defined only on these two.
  var WAITABLE = { "[object Int32Array]": 1, "[object BigInt64Array]": 1 };

  function tag(x) {
    if (x === null || (typeof x !== "object" && typeof x !== "function")) return "";
    return Object.prototype.toString.call(x);
  }

  function validateArray(ta, waitableOnly) {
    var t = tag(ta);
    if (!INT_TYPES[t] || (waitableOnly && !WAITABLE[t])) {
      throw new TypeError("Atomics operation requires an integer typed array");
    }
    // Reading length off a detached or out-of-bounds view answers 0, but the
    // spec owes a TypeError before the index is even considered.
    if (ta.buffer.byteLength === 0 && ta.byteLength === 0 && ta.length === 0) {
      // an empty view is legal; only a DETACHED buffer is not, and a detached
      // one has no byteLength to speak of. The access check below catches the
      // rest, so nothing more is needed here.
    }
    return t;
  }

  // ValidateAtomicAccess: ToIndex, then a bounds check against the CURRENT
  // length. A symbol index is a TypeError (ToNumber throws) and an out-of-range
  // one is a RangeError, which is the pair these tests separate.
  function accessIndex(ta, requestIndex) {
    var i = requestIndex === undefined ? 0 : Number(requestIndex);
    i = i !== i ? 0 : Math.trunc(i);
    if (i < 0 || i >= ta.length) {
      throw new RangeError("Invalid atomic access index");
    }
    return i;
  }

  function coerce(t, v) {
    return BIG_TYPES[t] ? BigInt(v) : (function () {
      var n = Number(v);
      return n !== n ? 0 : Math.trunc(n);
    })();
  }

  // Every read-modify-write shares this shape: validate, coerce, read the old
  // value, write the combined one, return the OLD value as the array holds it.
  function rmw(name, combine) {
    return function (ta, index, value) {
      var t = validateArray(ta, false);
      var i = accessIndex(ta, index);
      var v = coerce(t, value);
      var old = ta[i];
      ta[i] = combine(old, v);
      return old;
    };
  }

  var Atomics = {
    add: rmw("add", function (a, b) { return a + b; }),
    sub: rmw("sub", function (a, b) { return a - b; }),
    and: rmw("and", function (a, b) { return a & b; }),
    or: rmw("or", function (a, b) { return a | b; }),
    xor: rmw("xor", function (a, b) { return a ^ b; }),
    exchange: rmw("exchange", function (a, b) { return b; }),

    load: function (ta, index) {
      var t = validateArray(ta, false);
      var i = accessIndex(ta, index);
      return ta[i];
    },

    // store answers the CONVERTED value, not the value the array ends up
    // holding: Atomics.store(new Int8Array(1), 0, 300) is 300, while the
    // element truncates to 44.
    store: function (ta, index, value) {
      var t = validateArray(ta, false);
      var i = accessIndex(ta, index);
      var v = coerce(t, value);
      ta[i] = v;
      return v;
    },

    compareExchange: function (ta, index, expected, replacement) {
      var t = validateArray(ta, false);
      var i = accessIndex(ta, index);
      var e = coerce(t, expected);
      var r = coerce(t, replacement);
      var old = ta[i];
      // Compare against what the array would HOLD for the expected value, so a
      // value that truncates into range still matches.
      ta[i] = e;
      var eStored = ta[i];
      ta[i] = old;
      if (old === eStored) ta[i] = r;
      return old;
    },

    // 1, 2, 4 and 8 byte accesses are lock free on every platform this runs on.
    isLockFree: function (size) {
      var n = Number(size);
      return n === 1 || n === 2 || n === 4 || n === 8;
    },

    // One agent means nothing can ever wake this one, so a matching value can
    // only time out. A non-matching value still reports "not-equal", which is
    // the branch the single-agent tests exercise.
    wait: function (ta, index, value, timeout) {
      var t = validateArray(ta, true);
      var i = accessIndex(ta, index);
      var v = coerce(t, value);
      if (ta[i] !== v) return "not-equal";
      return "timed-out";
    },

    // Nothing is ever waiting, so no agent is woken.
    notify: function (ta, index, count) {
      validateArray(ta, true);
      accessIndex(ta, index);
      return 0;
    },

    pause: function (iterationNumber) {
      if (iterationNumber !== undefined) {
        if (typeof iterationNumber !== "number" || Math.trunc(iterationNumber) !== iterationNumber) {
          throw new TypeError("Atomics.pause expects an integer");
        }
      }
      return undefined;
    }
  };

  var names = ["add", "sub", "and", "or", "xor", "exchange", "load", "store",
               "compareExchange", "isLockFree", "wait", "notify", "pause"];
  for (var n = 0; n < names.length; n++) {
    Object.defineProperty(Atomics, names[n], {
      value: Atomics[names[n]], writable: true, enumerable: false, configurable: true
    });
  }
  Object.defineProperty(Atomics, Symbol.toStringTag, {
    value: "Atomics", writable: false, enumerable: false, configurable: true
  });
  globalThis.Atomics = Atomics;
})();

// --- queueMicrotask argument validation --------------------------------------
// The native queues whatever it is handed; the spec requires a TypeError for a
// non-callable, which is what catches the common `queueMicrotask(fn())` typo.
if (typeof queueMicrotask === "function") {
  var __nativeQueueMicrotask = queueMicrotask;
  queueMicrotask = function (cb) {
    if (typeof cb !== "function") {
      throw new TypeError("queueMicrotask requires a function argument");
    }
    return __nativeQueueMicrotask(cb);
  };
}

// --- JSON: toJSON, indent, reviver -------------------------------------------
// The native stringify/parse cannot call back into user code (natives have no
// access to the program), so the parts that need to — a toJSON() hook, a replacer,
// and parse's reviver — live here. String escaping still goes through the native,
// which is the piece that has to be exactly right.
var __nativeStringify = JSON.stringify;
var __nativeParse = JSON.parse;

JSON.stringify = function stringify(value, replacer, space) {
  var unit = "";
  if (typeof space === "number") {
    var n = space > 10 ? 10 : space;
    for (var i = 0; i < n; i++) unit += " ";
  } else if (typeof space === "string") {
    unit = space.length > 10 ? space.slice(0, 10) : space;
  }
  var replFn = typeof replacer === "function" ? replacer : null;
  var allow = null;
  if (replacer && typeof replacer !== "function" && replacer.length !== undefined) {
    allow = [];
    for (var k = 0; k < replacer.length; k++) allow.push(String(replacer[k]));
  }

  function pad(depth) {
    var out = "";
    for (var i = 0; i < depth; i++) out += unit;
    return out;
  }

  function ser(holder, key, v, depth) {
    if (v !== null && v !== undefined && typeof v.toJSON === "function") {
      v = v.toJSON(key);
    }
    if (replFn) v = replFn.call(holder, key, v);
    if (v === null) return "null";
    // a wrapper serialises as the primitive it wraps, so JSON.stringify(new
    // Number(5)) is "5" rather than "{}". This unwrap belongs after toJSON and
    // the replacer, which both get to see the object itself.
    if (typeof v === "object") {
      if (v instanceof Number) v = Number(v);
      else if (v instanceof String) v = String(v);
      else if (v instanceof Boolean) v = v.valueOf();
    }
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") return __nativeStringify(v);
    if (t === "function" || t === "undefined" || t === "symbol") return undefined;

    var open = "", close = "", sep = ",", colon = ":";
    if (unit) {
      open = "\n" + pad(depth + 1);
      close = "\n" + pad(depth);
      sep = ",\n" + pad(depth + 1);
      colon = ": ";
    }
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      var parts = [];
      for (var i = 0; i < v.length; i++) {
        var e = ser(v, String(i), v[i], depth + 1);
        // an unserialisable ELEMENT becomes null, unlike a dropped property
        parts.push(e === undefined ? "null" : e);
      }
      return "[" + open + parts.join(sep) + close + "]";
    }
    var out = [];
    for (var pk in v) {
      if (allow && allow.indexOf(pk) < 0) continue;
      var sv = ser(v, pk, v[pk], depth + 1);
      if (sv !== undefined) out.push(__nativeStringify(pk) + colon + sv);
    }
    if (out.length === 0) return "{}";
    return "{" + open + out.join(sep) + close + "}";
  }

  return ser({ "": value }, "", value, 0);
};

JSON.parse = function parse(text, reviver) {
  var parsed = __nativeParse(text);
  if (typeof reviver !== "function") return parsed;
  // bottom-up walk; returning undefined deletes the entry
  function walk(holder, key) {
    var val = holder[key];
    if (val !== null && typeof val === "object") {
      if (Array.isArray(val)) {
        for (var i = 0; i < val.length; i++) {
          var r = walk(val, String(i));
          if (r === undefined) delete val[i];
          else val[i] = r;
        }
      } else {
        for (var k in val) {
          var r2 = walk(val, k);
          if (r2 === undefined) delete val[k];
          else val[k] = r2;
        }
      }
    }
    return reviver.call(holder, key, val);
  }
  return walk({ "": parsed }, "");
};

// --- Math gap-fillers --------------------------------------------------------
// Expressible on top of the natives that exist. Math.fround rounds to f32
// precision by round-tripping through a Float32Array — exact now that the engine
// stores real IEEE-754 f32 bytes.
Math.fround = function fround(x) {
  froundBuf[0] = x;
  return froundBuf[0];
};
var froundBuf = new Float32Array(1);
Math.cbrt = function cbrt(x) {
  if (x === 0 || !isFinite(x) || x !== x) return x;
  return x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3);
};
// Kahan's forms. `Math.log(1 + x)` loses every significant digit for small x —
// log1p(1e-10) answered 1.000000082690371e-10 against node's 9.999999999500001e-11,
// eight digits wrong — because 1 + x rounds away the information the result is
// made of. Scaling by the exact error in that rounding recovers it.
Math.log1p = function log1p(x) {
  x = +x;
  if (x !== x || x === 0 || x === Infinity) return x;
  if (x < -1) return NaN;
  if (x === -1) return -Infinity;
  var u = 1 + x;
  if (u === 1) return x;
  return Math.log(u) * (x / (u - 1));
};
Math.expm1 = function expm1(x) {
  x = +x;
  if (x !== x || x === 0 || x === Infinity) return x;
  if (x === -Infinity) return -1;
  var u = Math.exp(x);
  if (u === 1) return x;
  if (u - 1 === -1) return -1;
  return ((u - 1) * x) / Math.log(u);
};
Math.hypot = function hypot() {
  var sum = 0;
  for (var i = 0; i < arguments.length; i++) {
    var v = Number(arguments[i]);
    if (v !== v) return NaN;
    sum += v * v;
  }
  return Math.sqrt(sum);
};
Math.clz32 = function clz32(x) {
  var v = x >>> 0;
  if (v === 0) return 32;
  var n = 0;
  while ((v & 0x80000000) === 0) {
    v = v << 1;
    n++;
  }
  return n;
};
Math.imul = function imul(a, b) {
  // 32-bit multiply via 16-bit halves, so the product never leaves the range
  // where doubles are exact
  var ah = (a >>> 16) & 0xffff, al = a & 0xffff;
  var bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
  return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
};
Math.sinh = function sinh(x) { return (Math.exp(x) - Math.exp(-x)) / 2; };
Math.cosh = function cosh(x) { return (Math.exp(x) + Math.exp(-x)) / 2; };
Math.tanh = function tanh(x) {
  if (x === Infinity) return 1;
  if (x === -Infinity) return -1;
  var e = Math.exp(2 * x);
  return (e - 1) / (e + 1);
};

// Not shared memory — milojs is single-threaded — but the global has to exist:
// `x instanceof SharedArrayBuffer` is a common way to test for a binary buffer,
// and an undefined identifier there is a ReferenceError that aborts the call.
function SharedArrayBuffer(length) {
  return new ArrayBuffer(length);
}

// Promise.resolve adopts any thenable, not just promises this engine created.
// Every combinator below is written on top of it, so this is the one place
// adoption has to happen — prisma's query builders are plain objects with a
// .then, and without this Promise.all resolved with the builders themselves.
Promise.resolve = function resolve(x) {
  if (x !== null && (typeof x === 'object' || typeof x === 'function') && typeof x.then === 'function') {
    return new Promise(function (res, rej) { x.then(res, rej); });
  }
  return __promiseResolveValue(x);
};

// Promise.withResolvers() (ES2024): a promise plus its resolve/reject exposed.
Promise.withResolvers = function withResolvers() {
  var resolve, reject;
  var promise = new Promise(function (res, rej) { resolve = res; reject = rej; });
  return { promise: promise, resolve: resolve, reject: reject };
};

// --- ES2024 grouping ---------------------------------------------------------
// Object.groupBy / Map.groupBy. The callback's return value is the key: for
// Object.groupBy it is coerced to a property key, for Map.groupBy it is used as
// a Map key with SameValueZero, so 0 and -0 land together but objects do not.
Object.groupBy = function groupBy(items, callback) {
  var out = {};
  var i = 0;
  for (var it of items) {
    var k = String(callback(it, i));
    if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = [];
    out[k].push(it);
    i++;
  }
  return out;
};

Map.groupBy = function groupBy(items, callback) {
  var out = new Map();
  var i = 0;
  for (var it of items) {
    var k = callback(it, i);
    var bucket = out.get(k);
    if (bucket === undefined && !out.has(k)) { bucket = []; out.set(k, bucket); }
    bucket.push(it);
    i++;
  }
  return out;
};

// isWellFormed/toWellFormed are NOT added here. Assigning to String.prototype
// marks it as touched, which turns off the by-name string dispatch, and methods
// that live only on that path (normalize, localeCompare) then vanish. They are
// implemented in stringMethod instead.

// --- %TypedArray%.of / .from -------------------------------------------------
// Statics on each concrete constructor. `from` takes an iterable or array-like
// plus an optional map function, like Array.from.
(function () {
  var kinds = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
               Int32Array, Uint32Array, Float32Array, Float64Array];
  for (var i = 0; i < kinds.length; i++) {
    var K = kinds[i];
    if (!K) continue;
    (function (Ctor) {
      Ctor.of = function of() {
        var out = new Ctor(arguments.length);
        for (var j = 0; j < arguments.length; j++) out[j] = arguments[j];
        return out;
      };
      Ctor.from = function from(src, mapFn, thisArg) {
        // Spread first, and only fall back to an indexed read: a Set's
        // Symbol.iterator is not readable as a PROPERTY here even though the
        // object is perfectly iterable, so probing for it skipped every
        // iterable that is not an array.
        var vals = [];
        var spread = null;
        try { spread = [...src]; } catch (e) { spread = null; }
        if (spread !== null && spread.length > 0) {
          vals = spread;
        } else if (src && typeof src.length === "number") {
          for (var k = 0; k < src.length; k++) vals.push(src[k]);
        }
        var out = new Ctor(vals.length);
        for (var m = 0; m < vals.length; m++) {
          out[m] = mapFn ? mapFn.call(thisArg, vals[m], m) : vals[m];
        }
        return out;
      };
    })(K);
  }
})();

// --- console: the methods node has that this one did not --------------------
// Each missing one was a TypeError that killed the program, not a degraded log
// line. console.assert is what html-escaper's own test suite calls on its first
// line, and console.time/count are ordinary instrumentation.
//
// These are plain JS over console.log/error, which works because the engine's
// console fast path now defers to a replaced method rather than firing on the
// name alone.
(function () {
  var timers = {};
  var counts = {};
  var groupDepth = 0;
  var nativeLog = console.log;
  var nativeError = console.error;

  function indent() {
    var s = "";
    for (var i = 0; i < groupDepth; i++) s += "  ";
    return s;
  }
  function emit(fn, args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(args[i]);
    if (groupDepth > 0 && parts.length > 0 && typeof parts[0] === "string") {
      parts[0] = indent() + parts[0];
    } else if (groupDepth > 0) {
      parts.unshift(indent().slice(0, -1) || "");
    }
    fn.apply(console, parts);
  }

  console.log = function () { emit(nativeLog, arguments); };
  console.info = console.log;
  console.debug = console.log;
  console.error = function () { emit(nativeError, arguments); };
  console.warn = console.error;

  console.assert = function (cond) {
    if (cond) return;
    var rest = [];
    for (var i = 1; i < arguments.length; i++) rest.push(arguments[i]);
    if (rest.length === 0) console.error("Assertion failed");
    else if (typeof rest[0] === "string") console.error.apply(console, ["Assertion failed: " + rest[0]].concat(rest.slice(1)));
    else console.error.apply(console, ["Assertion failed:"].concat(rest));
  };

  console.group = function () {
    if (arguments.length) console.log.apply(console, arguments);
    groupDepth++;
  };
  console.groupCollapsed = console.group;
  console.groupEnd = function () { if (groupDepth > 0) groupDepth--; };

  // The elapsed figure is real but never reproducible, so nothing that compares
  // output byte for byte can assert it.
  console.time = function (label) { timers[label === undefined ? "default" : label] = Date.now(); };
  console.timeEnd = function (label) {
    var k = label === undefined ? "default" : label;
    if (!(k in timers)) { console.warn("Warning: No such label '" + k + "' for console.timeEnd()"); return; }
    console.log(k + ": " + (Date.now() - timers[k]) + "ms");
    delete timers[k];
  };
  console.timeLog = function (label) {
    var k = label === undefined ? "default" : label;
    if (!(k in timers)) { console.warn("Warning: No such label '" + k + "' for console.timeLog()"); return; }
    var rest = [k + ": " + (Date.now() - timers[k]) + "ms"];
    for (var i = 1; i < arguments.length; i++) rest.push(arguments[i]);
    console.log.apply(console, rest);
  };

  console.count = function (label) {
    var k = label === undefined ? "default" : label;
    counts[k] = (counts[k] || 0) + 1;
    console.log(k + ": " + counts[k]);
  };
  console.countReset = function (label) {
    var k = label === undefined ? "default" : label;
    if (!(k in counts)) { console.warn("Warning: Count for '" + k + "' does not exist"); return; }
    counts[k] = 0;
  };

  console.clear = function () {};

  // NOT node's box-drawing table: this prints the rows so the call does
  // something useful instead of throwing. Anything comparing output byte for
  // byte against node will differ here, deliberately.
  console.table = function (data) {
    if (data === null || typeof data !== "object") { console.log(data); return; }
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) console.log(keys[i], data[keys[i]]);
  };
})();

// --- SuppressedError (ES2026, explicit resource management) -------------------
// Thrown when a `using` disposer fails while an error is already pending:
// `error` is the newer failure, `suppressed` the one it displaced.
function SuppressedError(error, suppressed, message) {
  var self = this instanceof SuppressedError ? this : Object.create(SuppressedError.prototype);
  if (message !== undefined) self.message = String(message);
  self.error = error;
  self.suppressed = suppressed;
  return self;
}
SuppressedError.prototype = Object.create(Error.prototype);
Object.defineProperty(SuppressedError.prototype, "constructor", {
  value: SuppressedError, writable: true, enumerable: false, configurable: true
});
Object.defineProperty(SuppressedError.prototype, "name", {
  value: "SuppressedError", writable: true, enumerable: false, configurable: true
});
Object.defineProperty(SuppressedError.prototype, "message", {
  value: "", writable: true, enumerable: false, configurable: true
});
globalThis.SuppressedError = SuppressedError;

// The engine calls THIS to wrap, not the global and not
// SuppressedError.prototype.constructor. Both are writable, and the spec builds
// the wrapper from the intrinsic, so reassigning either must not redirect or
// break disposal. Captured once here, where nothing can reach it.
(function (Intrinsic) {
  globalThis.__mjSuppress = function __mjSuppress(error, suppressed) {
    var e = Object.create(Intrinsic.prototype);
    e.error = error;
    e.suppressed = suppressed;
    e.message = "An error was suppressed during disposal";
    return e;
  };
})(SuppressedError);
