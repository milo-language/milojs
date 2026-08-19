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
exports.constants = {
  signals: {
    SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGILL: 4, SIGTRAP: 5, SIGABRT: 6,
    SIGBUS: 10, SIGFPE: 8, SIGKILL: 9, SIGUSR1: 30, SIGSEGV: 11, SIGUSR2: 31,
    SIGPIPE: 13, SIGALRM: 14, SIGTERM: 15, SIGCHLD: 20, SIGCONT: 19,
    SIGSTOP: 17, SIGTSTP: 18, SIGWINCH: 28,
  },
  errno: {
    EPERM: 1, ENOENT: 2, ESRCH: 3, EINTR: 4, EIO: 5, EBADF: 9, EAGAIN: 35,
    ENOMEM: 12, EACCES: 13, EEXIST: 17, ENOTDIR: 20, EISDIR: 21, EINVAL: 22,
    EMFILE: 24, EPIPE: 32, ERANGE: 34, ENOTEMPTY: 66, ECONNREFUSED: 61,
    ECONNRESET: 54, ETIMEDOUT: 60, EADDRINUSE: 48,
  },
  priority: {
    PRIORITY_LOW: 19, PRIORITY_BELOW_NORMAL: 10, PRIORITY_NORMAL: 0,
    PRIORITY_ABOVE_NORMAL: -7, PRIORITY_HIGH: -14, PRIORITY_HIGHEST: -20,
  },
  dlopen: { RTLD_LAZY: 1, RTLD_NOW: 2, RTLD_GLOBAL: 8, RTLD_LOCAL: 4, RTLD_DEEPBIND: 8 },
};
