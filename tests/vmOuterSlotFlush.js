// A compiled body holds outer names in slots and flushes them to the scope
// chain only at explicit points. A getter (or any user function a slow op can
// re-enter) reads the CHAIN, so a store since the last flush was invisible to
// it, and a write it made was invisible to the chunk afterwards. Both
// directions, caught by the vm-differential matrix's outer-mutation cases.
// @expect: 2:2
// @expect: true:5
var x = 1;
var o = { get g() { return x; } };
function f(obj) { x = 2; return obj.g + ":" + x; }
console.log(f(o));
var p = { valueOf: function() { return x * 10; } };
function h(q) { x = 5; return (q < 100) + ":" + x; }
console.log(h(p));
