// A compiled function body can CALL another one without leaving the VM's
// dispatch loop (src/engine/bytecode.milo, Op.Call). Everything here is a way
// that can go wrong, and every case is checked against node.
//
// A compiled frame keeps free names in stack slots, so the two directions of
// visibility are what most of these test: what a callee sees of its caller's
// writes, and what the caller sees of the callee's.
const msg = (e) => String(e.message).split(" (in ")[0];

// the callee's writes to a shared free name are visible to the caller after it
// returns, and each call sees the previous one's
let g = 0;
function bump() { g = g + 1; return g; }
function twice() { bump(); bump(); return g; }
console.log("write-through:", twice(), g);

// the caller re-reads a free name the callee assigned
let h = 1;
function setH() { h = 42; return 0; }
function readAfter() { setH(); return h; }
console.log("reseed:", readAfter());

// ordinary recursion, and deeper than the native stack used to allow
function fact(n) { if (n < 2) { return 1; } return n * fact(n - 1); }
console.log("fact:", fact(10));
function count(n) { if (n === 0) { return 0; } return 1 + count(n - 1); }
console.log("deep:", count(3000));

// a throw from a compiled callee keeps the writes it made before throwing, and
// does NOT resurrect the caller's pre-call snapshot of the same name
let v = 0;
function readsProp(o) { v = 5; return o.x; }
function midProp(o) { v = 1; return readsProp(o); }
try { midProp(undefined); } catch (e) { console.log("compiled throw:", e instanceof TypeError, v); }

// same, with the throw coming from a callee the VM had to hand back to the tree
// walker
let w = 0;
function boom() { w = 1; return null.x; }
function mid() { w = 10; return boom(); }
function top() { w = 100; return mid(); }
try { top(); } catch (e) { console.log("nested throw:", e instanceof TypeError, w); }

// callees the VM cannot compile: it hands each of these to the evaluator
const abs = Math.abs;
function useNative(x) { return abs(x); }
console.log("native:", useNative(-5));

function base(a, b) { return a + b; }
const bound = base.bind(null, 10);
function useBound(x) { return bound(x); }
console.log("bound:", useBound(5));

const arr = Array;
function makeArr(n) { return arr(n); }
console.log("array without new:", makeArr(3).length);

function* gen() { yield 7; }
const g2 = gen;
function useGen() { return g2(); }
console.log("generator:", useGen().next().value);

const proxied = new Proxy(function (x) { return x * 3; }, {});
function useProxy(x) { return proxied(x); }
console.log("proxy:", useProxy(4));

// a non-callable identifier is a TypeError naming the callee
const notFn = 5;
function callNotFn() { return notFn(1); }
try { callNotFn(); } catch (e) { console.log("not a function:", e instanceof TypeError, msg(e)); }

// `arguments` still exists in a compiled body
function argCount(a) { return arguments.length; }
console.log("arguments:", argCount(1, 2, 3));

// a strict callee assigning an undeclared name is a ReferenceError, which only
// the tree walker can raise, so the VM declines the frame rather than inventing one
function strictSet(x) { "use strict"; nope = x; return nope; }
try { strictSet(1); } catch (e) { console.log("strict:", e instanceof ReferenceError); }

// a sloppy callee with no receiver still binds globalThis
function sloppyThis() { return this === globalThis; }
console.log("sloppy this:", sloppyThis());

// an object held in a compiled frame's slot has to survive every collection the
// calls underneath it trigger. Run under MILOJS_GC_THRESHOLD=1 this recursion
// collects dozens of times with 200 frames of operands live.
function mk(k) { return {v: k}; }
function chain(k) { if (k === 0) { return 0; } let o = mk(k); let r = chain(k - 1); return o.v + r; }
console.log("held across calls:", chain(200));

// the callee's parameters are its own: the caller's same-named slot is untouched
let n = 9;
function shadow(n) { n = n + 1; return n; }
console.log("shadow:", shadow(1), n);
