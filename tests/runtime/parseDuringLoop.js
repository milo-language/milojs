// A `for (const x of ...)` loop whose body parses new source — require() of a
// module not yet loaded — used to lose its own binding. The loop variable's name
// was read from the AST by REFERENCE and held across the body; by the ~54th
// module the name had become the empty string, so the variable stopped
// resolving: "ReferenceError: x is not defined" in the middle of a loop that had
// been working. The same corruption further along is what made node's
// test-global.js die on SIGSEGV rather than fail an assertion.
//
// The trigger needs both halves: a large live heap AND enough modules parsed
// inside the loop. Synthetic modules alone do not reproduce it.
if (typeof process.removeAllListeners === 'function') process.removeAllListeners('warning');

let junk = [];
for (let i = 0; i < 400000; i++) junk.push({ i, s: 'x' + i });
junk = null;

const { builtinModules } = require('module');
let broken = 0;
let iterated = 0;
for (const name of builtinModules) {
  if (!name.includes('/')) {
    try { require(name); } catch {}
  }
  if (typeof name !== 'string' || name.length === 0) broken++;
  iterated++;
}
console.log('broken bindings:', broken);
console.log('iterated all:', iterated === builtinModules.length);
