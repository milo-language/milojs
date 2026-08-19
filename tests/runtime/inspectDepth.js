// util.inspect's second argument is node's OPTIONS object. This module took it
// as the recursion's own seen-list, so every call that passed options at all
// died with "indexOf is not a function".
//
// Kept to renderings three levels deep: node splits anything deeper across
// lines (its `compact: 3` rule) and this engine does not yet, which is a
// separate open divergence.
const util = require('util');
const deep = { a: { b: { c: 1 } } };
for (const d of [0, 1, 2, 3, null, Infinity, -1]) console.log(String(d), util.inspect(deep, { depth: d }));
// present-but-undefined is NOT the default: node compares `recurseTimes > depth`
// and that is false for undefined, so it renders everything.
console.log('explicit undefined', util.inspect(deep, { depth: undefined }));
console.log('legacy showHidden/depth', util.inspect(deep, false, 1));
console.log('array', util.inspect([[[['x']]]], { depth: 1 }));
console.log('no options', util.inspect(deep));
const circ = {}; circ.self = circ;
console.log('circular', util.inspect(circ, { depth: Infinity }));
