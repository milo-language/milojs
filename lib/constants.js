// node:constants — the legacy flat merge of os.constants, fs.constants and
// crypto.constants. Deprecated in node and still required by packages that
// predate the split (graceful-fs reads it, and so does anything old enough to
// have been written against node 0.x).
//
// The table itself is generated per platform: see lib/os-constants.js and
// tools/gen-os-constants.mjs. This file is only the shape.
module.exports = require('_osconstants').flat;
