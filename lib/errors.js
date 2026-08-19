// Node's coded errors, shared by the modules that validate their arguments.
//
// Node throws errors carrying a stable `.code` (ERR_INVALID_ARG_TYPE and
// friends) and its test suite asserts on that code, not on the message. A
// module that validates nothing, or that throws a bare TypeError, fails those
// tests without the assertion ever reaching the behaviour under test.
//
// Registered as `_errors`, following the `_http_common` convention already in
// src/runtime/modules.milo: not a node module name, so it cannot shadow one.
"use strict";

// Exactly node's `Received ...` phrasing, because its tests compare the whole
// message string, not just the code. See test/common/index.js's
// invalidArgTypeHelper, which is what those assertions are built from.
function receivedText(value) {
  if (value === null || value === undefined) return ' Received ' + value;
  if (typeof value === 'function') return ' Received function ' + (value.name || '');
  if (typeof value === 'object') {
    var ctor = value.constructor;
    if (ctor && ctor.name) return ' Received an instance of ' + ctor.name;
    return ' Received ' + String(value);
  }
  var inspected;
  if (typeof value === 'string') inspected = "'" + value + "'";
  else if (typeof value === 'bigint') inspected = value + 'n';
  else inspected = String(value);
  if (inspected.length > 28) inspected = inspected.slice(0, 25) + '...';
  return ' Received type ' + typeof value + ' (' + inspected + ')';
}

function coded(Ctor, code, message) {
  var e = new Ctor(message);
  e.code = code;
  return e;
}

// `expected` is node's phrasing for the accepted types, e.g. "of type string"
// or "one of type string, Buffer, or URL".
// Node's phrasing separates PRIMITIVE types from CLASSES: "of type string or an
// instance of Buffer or URL", never "one of type string, Buffer, URL". Tests
// compare whole messages, so the distinction is not cosmetic.
var PRIMITIVE_TYPES = { string: 1, number: 1, boolean: 1, bigint: 1, symbol: 1, object: 1, function: 1, undefined: 1 };

var KNOWN_PHRASE = /^(of type |an instance of |one of )/;

function expectedText(expected) {
  // A caller that names a bare type — ERR_INVALID_ARG_TYPE('name', 'string', v)
  // — means "of type string", which is what node prints. Passing it through
  // verbatim produced 'must be string', and the difference is not cosmetic:
  // node's tests compare the whole message. Anything that already reads as a
  // phrase is left alone.
  if (typeof expected === 'string') {
    return KNOWN_PHRASE.test(expected) ? expected : expectedText([expected]);
  }
  if (!Array.isArray(expected)) return expected;
  var prims = [], classes = [];
  for (var i = 0; i < expected.length; i++) {
    (PRIMITIVE_TYPES[expected[i]] ? prims : classes).push(expected[i]);
  }
  // Two names join with " or "; three or more take an Oxford comma, which is
  // what node prints and what its tests compare against character for
  // character: "Buffer, TypedArray, or DataView", not "Buffer or TypedArray or
  // DataView".
  var join = function (xs) {
    if (xs.length <= 2) return xs.join(' or ');
    return xs.slice(0, -1).join(', ') + ', or ' + xs[xs.length - 1];
  };
  var parts = [];
  if (prims.length) parts.push('of type ' + join(prims));
  if (classes.length) parts.push('an instance of ' + join(classes));
  return parts.join(' or ');
}

function invalidArgType(name, expected, actual) {
  return coded(TypeError, 'ERR_INVALID_ARG_TYPE',
    'The "' + name + '" argument must be ' + expectedText(expected) + '.' + receivedText(actual));
}

// node distinguishes an ARGUMENT from a PROPERTY of an options object, and the
// wording differs ("property must be" vs "argument must be"). Tests compare the
// whole message, so the two cannot share one phrasing.
function invalidArgTypeProp(name, expected, actual) {
  return coded(TypeError, 'ERR_INVALID_ARG_TYPE',
    'The "' + name + '" property must be ' + expectedText(expected) + '.' + receivedText(actual));
}

function invalidArgValue(name, value, reason) {
  return coded(TypeError, 'ERR_INVALID_ARG_VALUE',
    "The argument '" + name + "' " + (reason || 'is invalid') + '. Received ' +
    (typeof value === 'string' ? "'" + value + "'" : String(value)));
}

function outOfRange(name, range, actual) {
  return coded(RangeError, 'ERR_OUT_OF_RANGE',
    'The value of "' + name + '" is out of range. It must be ' + range +
    '. Received ' + String(actual));
}

function unknownEncoding(enc) {
  return coded(TypeError, 'ERR_UNKNOWN_ENCODING', 'Unknown encoding: ' + enc);
}

// --- validators -------------------------------------------------------------
// Each throws the error node throws, so callers stay one line.

function validateFunction(value, name) {
  if (typeof value !== 'function') throw invalidArgType(name, 'of type function', value);
}

function validateString(value, name) {
  if (typeof value !== 'string') throw invalidArgType(name, 'of type string', value);
}

function validateNumber(value, name) {
  if (typeof value !== 'number') throw invalidArgType(name, 'of type number', value);
}

function validateBoolean(value, name) {
  if (typeof value !== 'boolean') throw invalidArgType(name, 'of type boolean', value);
}

function validateObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidArgType(name, 'of type object', value);
  }
}

// node checks the type first and the range second, so a non-number reports
// ERR_INVALID_ARG_TYPE and a NaN or fractional value reports ERR_OUT_OF_RANGE.
function validateInteger(value, name, min, max) {
  validateNumber(value, name);
  if (Math.floor(value) !== value) throw outOfRange(name, 'an integer', value);
  if (min !== undefined && value < min) throw outOfRange(name, '>= ' + min, value);
  if (max !== undefined && value > max) throw outOfRange(name, '<= ' + max, value);
}

function validateUint32(value, name) {
  validateInteger(value, name, 0, 4294967295);
}

// A path is a string, a Buffer, or a file: URL. Anything else is the single
// most common bad argument in node's fs tests.
function validatePath(value, name) {
  if (typeof value === 'string') return;
  if (value instanceof Uint8Array) return;
  if (value && typeof value === 'object' && typeof value.href === 'string' &&
      typeof value.protocol === 'string') return;
  throw invalidArgType(name || 'path', ['string', 'Buffer', 'URL'], value);
}

// Callers pass either a real callback or nothing; node rejects everything else
// with ERR_INVALID_ARG_TYPE rather than ignoring it.
function validateCallback(cb) {
  if (typeof cb !== 'function') throw invalidArgType('cb', 'of type function', cb);
}

module.exports = {
  codedError: coded,
  ERR_INVALID_ARG_TYPE: invalidArgType,
  ERR_INVALID_ARG_TYPE_PROP: invalidArgTypeProp,
  ERR_INVALID_ARG_VALUE: invalidArgValue,
  ERR_OUT_OF_RANGE: outOfRange,
  ERR_UNKNOWN_ENCODING: unknownEncoding,
  validateFunction: validateFunction,
  validateString: validateString,
  validateNumber: validateNumber,
  validateBoolean: validateBoolean,
  validateObject: validateObject,
  validateInteger: validateInteger,
  validateUint32: validateUint32,
  validatePath: validatePath,
  validateCallback: validateCallback,
};
