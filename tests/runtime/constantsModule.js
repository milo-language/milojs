// node:constants and the three tables it merges. Every assertion here has to
// hold on darwin AND linux, because the values themselves do not: EAGAIN is 35
// on one and 11 on the other. So this checks the SHAPE and the agreement
// between the four views of one table, and tools/gen-os-constants.mjs --check
// is what pins the numbers, against real node on each platform.
const constants = require('constants');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// The portable POSIX values, identical everywhere.
console.log(constants.O_RDONLY, constants.O_WRONLY, constants.O_RDWR);
console.log(fs.constants.F_OK, fs.constants.R_OK, fs.constants.W_OK, fs.constants.X_OK);

// One table, four views: the flat module must agree with the nested ones.
console.log(constants.EAGAIN === os.constants.errno.EAGAIN);
console.log(constants.SIGTERM === os.constants.signals.SIGTERM);
console.log(constants.O_CREAT === fs.constants.O_CREAT);
console.log(constants.SSL_OP_ALL === crypto.constants.SSL_OP_ALL);

// Platform-shaped, so assert the RELATION rather than the number: an open flag
// that is not a distinct bit would silently make 'w' and 'a' the same call.
console.log((fs.constants.O_CREAT & fs.constants.O_TRUNC) === 0);
console.log((fs.constants.O_CREAT & fs.constants.O_APPEND) === 0);
console.log(fs.constants.O_CREAT > 0 && fs.constants.O_TRUNC > 0 && fs.constants.O_APPEND > 0);

// The tables are complete enough to be the real thing rather than a stub. The
// counts are node's own on both platforms; a shim with 21 of 79 errno used to
// pass anything that only asked whether the object existed.
console.log(Object.keys(os.constants.errno).length >= 79);
console.log(Object.keys(os.constants.signals).length >= 31);
console.log(Object.keys(fs.constants).length >= 55);
console.log(Object.keys(crypto.constants).length >= 56);
console.log(Object.keys(constants).length >= 230);

// errno numbering is not portable, but its INTERNAL consistency is: node's
// tests index these directly and a missing entry reads as undefined, not as an
// error.
console.log(typeof constants.ENOENT === 'number', typeof constants.EACCES === 'number');
console.log(typeof crypto.constants.defaultCoreCipherList === 'string');
console.log(typeof os.constants.priority.PRIORITY_NORMAL === 'number');
console.log(typeof os.constants.dlopen.RTLD_NOW === 'number');
