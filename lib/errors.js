// Node's coded errors, shared by the modules that validate their arguments.
//
// Node throws errors carrying a stable `.code` (ERR_INVALID_ARG_TYPE and
// friends) and its test suite asserts on that code, not on the message. A
// module that validates nothing, or that throws a bare TypeError, fails those
// tests without the assertion ever reaching the behaviour under test.
//
// Registered as `_errors`, following the `_http_common` convention already in
// src/modules.milo: not a node module name, so it cannot shadow one.
"use strict";

function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an instance of Array';
  var t = typeof value;
  if (t === 'object') {
    var ctor = value.constructor;
    return 'an instance of ' + (ctor && ctor.name ? ctor.name : 'Object');
  }
  return 'type ' + t;
}

function received(value) {
  if (typeof value === 'string') return " ('" + value + "')";
  if (typeof value === 'number' || typeof value === 'boolean') return ' (' + value + ')';
  if (typeof value === 'bigint') return ' (' + value + 'n)';
  return '';
}

function coded(Ctor, code, message) {
  var e = new Ctor(message);
  e.code = code;
  return e;
}

// `expected` is node's phrasing for the accepted types, e.g. "of type string"
// or "one of type string, Buffer, or URL".
function invalidArgType(name, expected, actual) {
  var exp = Array.isArray(expected)
    ? (expected.length === 1 ? 'of type ' + expected[0]
                             : 'one of type ' + expected.join(', '))
    : expected;
  return coded(TypeError, 'ERR_INVALID_ARG_TYPE',
    'The "' + name + '" argument must be ' + exp + '. Received ' +
    typeName(actual) + received(actual));
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
