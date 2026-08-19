// node exposes this specifier as the very object the parent module already has
// on that property, and its tests compare the two with ===. Aliasing keeps one
// copy; re-evaluating the parent source would make two.
module.exports = require('dns').promises;
