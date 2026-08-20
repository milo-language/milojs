// node re-exports a few web-standard classes from util. They existed here as
// globals but not on the module, so `const { TextEncoder } = require("util")`
// read undefined and the failure surfaced later at the `new` as
// "value is not a constructor", a message naming neither the module nor the
// missing export.
//
// The negative half matters as much: AbortController and AbortSignal ARE globals
// in node but are NOT on util, so exporting them would be a divergence in the
// other direction.
const util = require('util');

for (const name of ['TextEncoder', 'TextDecoder', 'AbortController', 'AbortSignal']) {
  console.log(name, typeof util[name]);
}
console.log('encode length:', new util.TextEncoder().encode('hi').length);
console.log('decode:', new util.TextDecoder().decode(new Uint8Array([104, 105])));
