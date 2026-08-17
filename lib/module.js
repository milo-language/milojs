// node:module — enough of it for the ecosystem's feature probes.
//
// `builtinModules` is the list this runtime can actually `require`. It is not
// node's list: naming a module we cannot load would turn a clean resolution
// failure into a confusing one at first use, and packages like is-core-module
// require every name on this list to check it.
var builtinModules = [
  "assert", "assert/strict", "async_hooks", "buffer", "child_process", "console",
  "constants", "crypto", "events", "fs", "fs/promises", "http", "https", "module",
  "net", "os", "path", "path/posix", "path/win32", "process", "punycode",
  "querystring", "repl", "stream", "stream/consumers", "stream/promises",
  "string_decoder", "sys", "timers", "timers/promises", "tls", "tty", "url",
  "util", "util/types", "zlib",
  // legacy internal aliases node still exposes
  "_stream_duplex", "_stream_passthrough", "_stream_readable", "_stream_transform",
  "_stream_writable", "_stream_wrap", "_http_agent", "_http_client", "_http_common",
  "_http_incoming", "_http_outgoing", "_http_server", "_tls_common", "_tls_wrap",
];

function createRequire(_filename) {
  // The require of the CALLING module is the closest honest answer available:
  // this runtime has one module registry, not one per path.
  return require;
}

function isBuiltin(name) {
  var n = typeof name === "string" && name.slice(0, 5) === "node:" ? name.slice(5) : name;
  return builtinModules.indexOf(n) >= 0;
}

module.exports = {
  builtinModules: builtinModules,
  createRequire: createRequire,
  isBuiltin: isBuiltin,
  Module: { builtinModules: builtinModules, createRequire: createRequire, isBuiltin: isBuiltin },
};
