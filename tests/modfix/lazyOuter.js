// stands in for express: requires the package, then touches the lazy getter
// from ITS module scope, which is what used to hijack the resolution base
const pkg = require('./lazypkg');
exports.readLazy = function () { return pkg.lazy.tag; };
exports.readViaCallback = function () { return pkg.viaCallback(); };
exports.eager = pkg.eager;
