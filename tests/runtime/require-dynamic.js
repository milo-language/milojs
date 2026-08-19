// require() with a COMPUTED specifier. The preload walk only follows
// require("literal"), so these used to report MODULE_NOT_FOUND for modules that
// are plainly present — which is exactly what every package that feature-detects
// core modules does (is-core-module, the es-shim tree).
const names = ['os', 'zlib', 'vm', 'assert/strict', 'util/types'];
for (const n of names) {
  let ok = false;
  try { ok = typeof require(n) !== 'undefined'; } catch (e) { ok = e.code; }
  console.log(n, ok);
}

// The submodule specifiers are the same object the parent exposes on that
// property, not a second copy of the module.
const pairs = [['assert/strict', 'assert', 'strict'], ['util/types', 'util', 'types'],
               ['timers/promises', 'timers', 'promises'], ['path/posix', 'path', 'posix'],
               ['fs/promises', 'fs', 'promises']];
for (const [spec, base, prop] of pairs) console.log(spec, require(spec) === require(base)[prop]);

const mod = require('module');
console.log('isBuiltin', ['dns', 'vm', 'worker_threads', 'nope-xyz'].map((n) => mod.isBuiltin(n)).join(','));

try { require('no-such-package-xyz'); } catch (e) { console.log('missing ->', e.code); }
