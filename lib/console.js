// node:console — the module form of the global. node exposes the same object here
// plus a Console class; this runtime's console is native, so the class is a thin
// wrapper that ignores the stream arguments it cannot honour.
function Console(_stdout, _stderr) {
  if (!(this instanceof Console)) return new Console(_stdout, _stderr);
  var self = this;
  ["log", "error", "warn", "info", "debug", "trace", "dir"].forEach(function (m) {
    self[m] = function () { return console[m].apply(console, arguments); };
  });
}
module.exports = console;
module.exports.Console = Console;
