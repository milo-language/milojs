const cfg = require('./modfix/data.json');
console.log(cfg.name, cfg.nums[1], cfg.nested.deep, cfg.esc);
console.log(JSON.stringify(cfg.nums));

const leaf = require('./modfix/leaf');
console.log(leaf.leaf, leaf.twice(21));

// require caching: same object identity on a second require
const leaf2 = require('./modfix/leaf');
console.log(leaf === leaf2);

const A = require('./modfix/cycleA');
console.log(A.name, A.fromB);
const B = require('./modfix/cycleB');
console.log(B.name, B.sawA, B.sawFromB);

// A relative require inside a closure resolves against the module the closure
// was DEFINED in, not the one running when it fires. modDirStack is dynamic and
// is popped when a module body ends, so a lazy require saw its caller instead.
const outer = require('./modfix/lazyOuter');
console.log(outer.eager, outer.readLazy(), outer.readViaCallback());
const lazypkg = require('./modfix/lazypkg');
console.log(lazypkg.lazy.tag, lazypkg.lazy === lazypkg.lazy);

// Relative specifiers that climb above their base, and the directory forms.
const climb = require('./modfix/updir/nested/climb');
console.log(climb.up, climb.sideways);
console.log(climb.dirDotDot, climb.dirDotDotSlash);
console.log(climb.dirDot, climb.dirDotSlash);
