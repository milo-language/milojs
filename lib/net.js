// node:net — only what express/http touch. Real socket objects come from the
// http module; this exists so `require('net')` resolves and isIP works.
exports.isIP = function (s) {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(String(s))) return 4;
  if (String(s).indexOf(':') >= 0) return 6;
  return 0;
};
exports.isIPv4 = function (s) { return exports.isIP(s) === 4; };
exports.isIPv6 = function (s) { return exports.isIP(s) === 6; };
exports.Socket = function Socket() {};
exports.createServer = function () {
  throw new Error('net.createServer is not implemented under milojs; use http');
};

// Node's test harness calls setDefaultAutoSelectFamilyAttemptTimeout at load, so
// its absence blocked every test in the suite. There is no happy-eyeballs path
// in this runtime's connect, so the values are remembered and nothing reads them.
let __autoSelectFamilyTimeout = 250;
let __autoSelectFamily = false;
exports.setDefaultAutoSelectFamilyAttemptTimeout = function (value) {
  __autoSelectFamilyTimeout = Number(value) | 0;
};
exports.getDefaultAutoSelectFamilyAttemptTimeout = function () {
  return __autoSelectFamilyTimeout;
};
exports.setDefaultAutoSelectFamily = function (value) {
  __autoSelectFamily = Boolean(value);
};
exports.getDefaultAutoSelectFamily = function () {
  return __autoSelectFamily;
};
