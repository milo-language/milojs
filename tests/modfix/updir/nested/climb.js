// `..` with nothing to pop was DROPPED by normalizePath, so a relative path that
// climbs above its base lost the climb entirely: from here, `../one.js` became
// `one.js` and resolved against the wrong directory. And `.`/`./` normalised to
// the empty string, which resolves against nothing.
exports.up = require('../one.js');
exports.dirDotDot = require('..');
exports.dirDotDotSlash = require('../');
exports.dirDot = require('.');
exports.dirDotSlash = require('./');
exports.sideways = require('../nested/index.js');
