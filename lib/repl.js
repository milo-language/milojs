// node:repl — this runtime has its own REPL (src/runtime/repl.milo) rather than a
// JS-level one, so the module exists for the property the ecosystem reads:
// `_builtinLibs`, which is how several packages enumerate core modules.
var mod = require("module");

// node's _builtinLibs excludes the underscore-prefixed legacy aliases and the
// subpath forms; it is the list a REPL would offer as bare globals.
var _builtinLibs = mod.builtinModules.filter(function (n) {
  return n.indexOf("/") < 0 && n.charAt(0) !== "_";
});

module.exports = { _builtinLibs: _builtinLibs, builtinModules: mod.builtinModules };
