// `path/posix` and `path/win32` are the same objects the main module exposes as
// properties, and node's tests assert that identity, so these alias rather than
// re-evaluate: a second copy of path.js would be a different object.
module.exports = require('path').posix;
