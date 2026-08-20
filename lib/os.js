// node:os — constants and stubs. Packages read these to decide on colours,
// temp paths and concurrency; nothing here needs real system introspection.
exports.EOL = '\n';
exports.platform = function () { return process.platform; };
exports.type = function () { return process.platform === 'darwin' ? 'Darwin' : 'Linux'; };
exports.arch = function () { return process.arch; };
exports.release = function () { return '0.0.0'; };
exports.hostname = function () { return 'localhost'; };
exports.tmpdir = function () { return '/tmp'; };
exports.homedir = function () { return process.env.HOME || '/'; };
exports.cpus = function () { return [{ model: 'unknown', speed: 0, times: {} }]; };
exports.totalmem = function () { return 0; };
exports.freemem = function () { return 0; };
exports.uptime = function () { return 0; };
exports.endianness = function () { return 'LE'; };
exports.userInfo = function () { return { username: 'milojs', homedir: exports.homedir() }; };
exports.networkInterfaces = function () { return {}; };
exports.machine = function () { return process.arch === 'x64' ? 'x86_64' : process.arch; };
exports.version = function () { return 'milojs'; };
exports.devNull = '/dev/null';
exports.availableParallelism = function () { return 1; };
exports.getPriority = function (pid) {
  if (pid !== undefined && typeof pid !== 'number') {
    throw require('_errors').ERR_INVALID_ARG_TYPE('pid', ['number'], pid);
  }
  return 0;
};
// Validates and then does nothing, which is honest: there is no priority to
// set here, but accepting a string where node rejects one is a different lie.
exports.setPriority = function (pid, priority) {
  var e = require('_errors');
  var p = priority === undefined ? pid : priority;
  if (priority !== undefined && typeof pid !== 'number') {
    throw e.ERR_INVALID_ARG_TYPE('pid', ['number'], pid);
  }
  if (typeof p !== 'number') throw e.ERR_INVALID_ARG_TYPE('priority', ['number'], p);
  if (p < -20 || p > 19) throw e.ERR_OUT_OF_RANGE('priority', '>= -20 && <= 19', p);
};

// dlopen and the signal/errno tables in ONE object. These used to be two
// separate `exports.constants =` assignments, so the second silently dropped
// signals and errno: os.constants.signals.SIGTERM was undefined, and node's
// tests index it directly.
//
// The numbers themselves are GENERATED per platform (tools/gen-os-constants.mjs)
// rather than typed here. The table that used to live in this file was darwin's
// (EAGAIN 35) while the shipped binary runs on linux (EAGAIN 11), and nothing
// could tell: an errno table is 79 integers nobody re-derives by hand.
exports.constants = require('_osconstants').os;
