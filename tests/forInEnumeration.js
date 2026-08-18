// for-in walks the prototype chain, and two rules govern what it may emit.
// A name already emitted is not repeated, and a NON-enumerable own property
// still hides an enumerable one of the same name further up, even though it is
// never emitted itself. milojs tracked neither, so an own property shadowing an
// inherited one yielded it twice and a non-enumerable shadow let the inherited
// property through.
function show(o) { var t=[]; for (var k in o) t.push(k); return t.toString(); }
var a = {x:2, y:2, "1":3}, b = {"4":3};
Object.setPrototypeOf(a, b);
console.log("chain-order:", show(a));
var c = {y:2,"1":3}; Object.defineProperty(c,"x",{value:1});
Object.setPrototypeOf(c, {x:3});
console.log("nonenum-shadow:", show(c));
var d = Object.create({p:1}); d.p = 2;
console.log("own-shadows-proto:", show(d));
var e = Object.create({q:1, r:2}); e.r = 9; e.s = 3;
console.log("mixed:", show(e));
var arr = [10,20]; arr.extra = 1;
console.log("array:", show(arr));
console.log("nullproto:", show(Object.create(null)));
var f = {}; Object.defineProperty(f,"h",{value:1,enumerable:false});
console.log("all-nonenum:", show(f), Object.keys(f).length);
var g = Object.create({z:1}); Object.defineProperty(g,"z",{value:2,enumerable:false});
console.log("deep-shadow:", show(g));
