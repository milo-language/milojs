// A collection walks whatever graph the program built, and the depth of that
// graph is user input. The mark phase used to recurse once per edge, so a chain
// this long took the native stack through its guard page: SIGBUS, mid-GC, with
// no error to catch. 300k is well past the ~50k that used to be fatal.
let head = null;
for (let i = 0; i < 300000; i++) head = { next: head, i };
if (typeof gc === 'function') gc();
let n = 0, p = head;
while (p) { n++; p = p.next; }
console.log('chain depth', n, 'head', head.i);

// Nested arrays reach the same marker by a different edge (elements, not
// properties), and nothing else in the suite nests them deeply.
let a = [];
for (let i = 0; i < 200000; i++) a = [a];
if (typeof gc === 'function') gc();
let d = 0, q = a;
while (Array.isArray(q) && q.length) { d++; q = q[0]; }
console.log('array depth', d);
