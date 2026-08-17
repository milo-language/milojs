// node:timers — the global timer functions, re-exported as a module.
var promises = {
  setTimeout: function (ms, value) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms); });
  },
  setImmediate: function (value) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, 0); });
  },
};
module.exports = {
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  setInterval: setInterval, clearInterval: clearInterval,
  setImmediate: typeof setImmediate === "function" ? setImmediate : function (fn) { return setTimeout(fn, 0); },
  clearImmediate: typeof clearImmediate === "function" ? clearImmediate : clearTimeout,
  promises: promises,
};
