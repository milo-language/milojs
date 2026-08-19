// node:assert — the CommonJS subset real code uses. assert(value[, message]) is
// callable directly and also carries the method surface.

// A real class, not a factory returning a plain Error: `assert.throws(fn,
// assert.AssertionError)` and `err instanceof assert.AssertionError` are both
// common in node's own tests, and neither works on a factory's return value.
class AssertionError extends Error {
  constructor(options) {
    var opts = typeof options === 'string' ? { message: options } : (options || {});
    super(opts.message || 'Assertion failed');
    this.name = 'AssertionError';
    this.code = 'ERR_ASSERTION';
    this.actual = opts.actual;
    this.expected = opts.expected;
    this.operator = opts.operator;
    this.generatedMessage = !opts.message;
  }
}

function failWith(message, actual, expected, operator) {
  throw new AssertionError({ message: message, actual: actual, expected: expected, operator: operator });
}

function fail(message) {
  if (message instanceof Error) throw message;
  throw new AssertionError({
    message: typeof message === 'string' ? message : 'Failed',
    operator: 'fail',
  });
}

function ok(value, message) {
  if (!value) {
    if (message instanceof Error) throw message;
    failWith(message || 'The expression evaluated to a falsy value', value, true, '==');
  }
}

// structural equality for deepEqual/deepStrictEqual. `strict` uses === on leaves
// and, as in node, also requires the two values to share a prototype: a Buffer
// and a plain array with the same contents are NOT deepStrictEqual.
function deepEq(a, b, strict, seen) {
  if (strict ? a === b : a == b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    // NaN is equal to itself under assert's deep comparison
    return a !== a && b !== b;
  }
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // Cycles: a pair already being compared is assumed equal, which is what lets
  // two identically-shaped self-referential objects compare without recursing
  // forever.
  seen = seen || [];
  for (var s = 0; s < seen.length; s++) {
    if (seen[s][0] === a && seen[s][1] === b) return true;
  }
  seen.push([a, b]);

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp &&
           a.source === b.source && a.flags === b.flags;
  }
  if (a instanceof Error || b instanceof Error) {
    if (!(a instanceof Error) || !(b instanceof Error)) return false;
    if (a.name !== b.name || a.message !== b.message) return false;
  }
  var aTA = a instanceof Uint8Array, bTA = b instanceof Uint8Array;
  if (aTA || bTA) {
    if (!aTA || !bTA || a.length !== b.length) return false;
    for (var t = 0; t < a.length; t++) if (a[t] !== b[t]) return false;
    return true;
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    var mk = a.keys();
    for (var mr = mk.next(); !mr.done; mr = mk.next()) {
      if (!b.has(mr.value)) return false;
      if (!deepEq(a.get(mr.value), b.get(mr.value), strict, seen)) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    var sk = a.keys();
    for (var sr = sk.next(); !sr.done; sr = sk.next()) if (!b.has(sr.value)) return false;
    return true;
  }

  var aArr = Array.isArray(a);
  var bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  var ka = Object.keys(a);
  var kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) {
    var k = ka[i];
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEq(a[k], b[k], strict, seen)) return false;
  }
  return true;
}

// partialDeepStrictEqual: every key present in `expected` must match, and keys
// only `actual` carries are ignored.
function partialEq(actual, expected, seen) {
  if (actual === expected) return true;
  if (typeof expected !== 'object' || expected === null) return deepEq(actual, expected, true);
  if (typeof actual !== 'object' || actual === null) return false;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) return false;
    for (var i = 0; i < expected.length; i++) if (!partialEq(actual[i], expected[i], seen)) return false;
    return true;
  }
  var keys = Object.keys(expected);
  for (var k = 0; k < keys.length; k++) {
    if (!Object.prototype.hasOwnProperty.call(actual, keys[k])) return false;
    if (!partialEq(actual[keys[k]], expected[keys[k]], seen)) return false;
  }
  return true;
}

function assert(value, message) {
  ok(value, message);
}

assert.AssertionError = AssertionError;
assert.ok = ok;
assert.fail = fail;

assert.equal = function (actual, expected, message) {
  if (!(actual == expected)) {
    if (message instanceof Error) throw message;
    failWith(message || actual + ' == ' + expected, actual, expected, '==');
  }
};
assert.notEqual = function (actual, expected, message) {
  if (actual == expected) {
    if (message instanceof Error) throw message;
    failWith(message || actual + ' != ' + expected, actual, expected, '!=');
  }
};
assert.strictEqual = function (actual, expected, message) {
  if (!(actual === expected)) {
    if (message instanceof Error) throw message;
    failWith(message || actual + ' === ' + expected, actual, expected, 'strictEqual');
  }
};
assert.notStrictEqual = function (actual, expected, message) {
  if (actual === expected) {
    if (message instanceof Error) throw message;
    failWith(message || actual + ' !== ' + expected, actual, expected, 'notStrictEqual');
  }
};
assert.deepEqual = function (actual, expected, message) {
  if (!deepEq(actual, expected, false)) {
    if (message instanceof Error) throw message;
    failWith(message || 'deepEqual failed', actual, expected, 'deepEqual');
  }
};
assert.notDeepEqual = function (actual, expected, message) {
  if (deepEq(actual, expected, false)) {
    if (message instanceof Error) throw message;
    failWith(message || 'notDeepEqual failed', actual, expected, 'notDeepEqual');
  }
};
assert.deepStrictEqual = function (actual, expected, message) {
  if (!deepEq(actual, expected, true)) {
    if (message instanceof Error) throw message;
    failWith(message || 'deepStrictEqual failed', actual, expected, 'deepStrictEqual');
  }
};
assert.notDeepStrictEqual = function (actual, expected, message) {
  if (deepEq(actual, expected, true)) {
    if (message instanceof Error) throw message;
    failWith(message || 'notDeepStrictEqual failed', actual, expected, 'notDeepStrictEqual');
  }
};
assert.partialDeepStrictEqual = function (actual, expected, message) {
  if (!partialEq(actual, expected)) {
    if (message instanceof Error) throw message;
    failWith(message || 'partialDeepStrictEqual failed', actual, expected, 'partialDeepStrictEqual');
  }
};

// --- exception matching -----------------------------------------------------
// `expected` is a constructor, a RegExp against the message, a validation
// function, or an object whose every own key must match the thrown error. The
// object form used to be ignored outright, so a test asserting a specific
// `code` passed against ANY error — including the wrong one.

function isConstructor(fn) {
  return typeof fn === 'function' && fn.prototype !== undefined && fn.prototype !== null;
}

// Returns null when the error matches, or a reason string when it does not.
function matchError(err, expected) {
  if (expected === undefined || expected === null) return null;
  if (expected instanceof RegExp) {
    // Node tests the regex against String(err) — "TypeError: boom" — not
    // against the message alone. Matching only the message means the common
    // `assert.throws(fn, /TypeError/)` idiom can never pass, because the type
    // name lives in the prefix this used to drop.
    var subject = err instanceof Error ? String(err) : String(err && err.message);
    return expected.test(subject) ? null
      : 'The input did not match the regular expression ' + expected;
  }
  if (typeof expected === 'function') {
    if (isConstructor(expected)) {
      if (err instanceof expected) return null;
      // A plain function that happens to have a prototype is still usable as a
      // validator, so an instanceof miss falls through to calling it rather
      // than failing outright.
      var out;
      try { out = expected(err); } catch (inner) { throw inner; }
      if (out === true) return null;
      if (out === false || out === undefined) {
        return 'The error is expected to be an instance of "' + (expected.name || 'anonymous') + '"';
      }
      return null;
    }
    return expected(err) === true ? null : 'The validation function is expected to return "true"';
  }
  if (typeof expected === 'object') {
    var keys = Object.keys(expected);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var want = expected[k];
      var got = err === null || err === undefined ? undefined : err[k];
      if (want instanceof RegExp) {
        if (!want.test(String(got))) return 'Expected ' + k + ' to match ' + want + ', got ' + got;
        continue;
      }
      if (!deepEq(got, want, true)) {
        return 'Expected ' + k + ' to be ' + want + ', got ' + got;
      }
    }
    return null;
  }
  return null;
}

assert.throws = function (fn, expected, message) {
  if (typeof fn !== 'function') {
    var te = new TypeError('The "fn" argument must be of type function');
    te.code = 'ERR_INVALID_ARG_TYPE';
    throw te;
  }
  if (typeof expected === 'string' && message === undefined) { message = expected; expected = undefined; }
  var threw = false;
  var err = null;
  try {
    fn();
  } catch (e) {
    threw = true;
    err = e;
  }
  if (!threw) {
    failWith(message || 'Missing expected exception', undefined, expected, 'throws');
  }
  var why = matchError(err, expected);
  if (why !== null) {
    failWith(message || why, err, expected, 'throws');
  }
};

assert.doesNotThrow = function (fn, expected, message) {
  if (typeof expected === 'string' && message === undefined) { message = expected; expected = undefined; }
  try {
    fn();
  } catch (e) {
    // node rethrows an error the filter does not cover, rather than reporting
    // it as an assertion failure: an unrelated exception is a bug in the test,
    // not the thing being asserted about.
    if (expected !== undefined && matchError(e, expected) !== null) throw e;
    failWith((message ? message + ': ' : '') + 'Got unwanted exception: ' + (e && e.message),
             e, expected, 'doesNotThrow');
  }
};

assert.rejects = function (promiseOrFn, expected, message) {
  if (typeof expected === 'string' && message === undefined) { message = expected; expected = undefined; }
  var p;
  try {
    p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  } catch (sync) {
    // A function that throws synchronously has not "rejected"; node reports it
    // as such rather than treating the throw as a rejection.
    return Promise.reject(new AssertionError({
      message: message || 'Missing expected rejection', actual: sync, operator: 'rejects',
    }));
  }
  return Promise.resolve(p).then(
    function () {
      throw new AssertionError({
        message: message || 'Missing expected rejection', expected: expected, operator: 'rejects',
      });
    },
    function (err) {
      var why = matchError(err, expected);
      if (why !== null) {
        throw new AssertionError({ message: message || why, actual: err, expected: expected, operator: 'rejects' });
      }
    }
  );
};

assert.doesNotReject = function (promiseOrFn, expected, message) {
  if (typeof expected === 'string' && message === undefined) { message = expected; expected = undefined; }
  var p;
  try {
    p = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
  } catch (sync) {
    return Promise.reject(sync);
  }
  return Promise.resolve(p).then(undefined, function (err) {
    if (expected !== undefined && matchError(err, expected) !== null) throw err;
    throw new AssertionError({
      message: (message ? message + ': ' : '') + 'Got unwanted rejection: ' + (err && err.message),
      actual: err, operator: 'doesNotReject',
    });
  });
};

assert.match = function (string, regexp, message) {
  if (!(regexp instanceof RegExp)) {
    var e = new TypeError('The "regexp" argument must be an instance of RegExp');
    e.code = 'ERR_INVALID_ARG_TYPE';
    throw e;
  }
  if (typeof string !== 'string') {
    if (message instanceof Error) throw message;
    failWith(message || 'The "string" argument must be of type string', string, regexp, 'match');
  }
  if (!regexp.test(string)) {
    if (message instanceof Error) throw message;
    failWith(message || 'The input did not match the regular expression ' + regexp +
             '. Input:\n\n' + JSON.stringify(string) + '\n', string, regexp, 'match');
  }
};

assert.doesNotMatch = function (string, regexp, message) {
  if (!(regexp instanceof RegExp)) {
    var e2 = new TypeError('The "regexp" argument must be an instance of RegExp');
    e2.code = 'ERR_INVALID_ARG_TYPE';
    throw e2;
  }
  if (typeof string === 'string' && regexp.test(string)) {
    if (message instanceof Error) throw message;
    failWith(message || 'The input was expected to not match the regular expression ' + regexp,
             string, regexp, 'doesNotMatch');
  }
};

assert.ifError = function (value) {
  if (value !== null && value !== undefined) {
    throw new AssertionError({
      message: 'ifError got unwanted exception: ' +
        (value instanceof Error ? value.message : String(value)),
      actual: value, expected: null, operator: 'ifError',
    });
  }
};

// assert.strict is a DISTINCT function (=== assert is false) whose loose
// variants (equal/deepEqual) behave like the strict ones.
function strictAssert(value, message) {
  ok(value, message);
}
var strictNames = ['AssertionError', 'ok', 'fail', 'strictEqual', 'notStrictEqual',
                   'deepStrictEqual', 'notDeepStrictEqual', 'partialDeepStrictEqual',
                   'throws', 'doesNotThrow', 'rejects', 'doesNotReject',
                   'match', 'doesNotMatch', 'ifError'];
for (var si = 0; si < strictNames.length; si++) {
  strictAssert[strictNames[si]] = assert[strictNames[si]];
}
strictAssert.equal = assert.strictEqual;
strictAssert.notEqual = assert.notStrictEqual;
strictAssert.deepEqual = assert.deepStrictEqual;
strictAssert.notDeepEqual = assert.notDeepStrictEqual;
strictAssert.strict = strictAssert;
assert.strict = strictAssert;

module.exports = assert;
