// body-parser's shape: the relative require runs from inside a getter, long
// after this module's own body has finished. Resolving it against whoever is
// executing at that moment (express, in the real case) looked for
// node_modules/express/lib/lib/types/json and express would not load.
Object.defineProperty(exports, 'lazy', {
  configurable: true,
  enumerable: true,
  get: function () { return require('./inner/deep'); }
});
exports.viaCallback = function () { return require('./inner/deep').tag; };
exports.eager = require('./inner/deep').tag;
