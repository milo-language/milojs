// Arrays link a real Array.prototype instead of the name-whitelist dispatch that
// used to fake one. What that buys, and what must keep working.

// 1. extending Array.prototype from JS is reachable at all. Under the whitelist
//    this was dead code: member lookup on an array never consulted the prototype.
Array.prototype.second = function () { return this[1]; };
console.log([10, 20, 30].second());
delete Array.prototype.second;
console.log(typeof [].second);

// 2. an override wins on CALLS, not just reads. Dispatching by name made the
//    override visible to `[].join` but ignored by `[1,2].join()`.
var origJoin = Array.prototype.join;
Array.prototype.join = function () { return "OVERRIDDEN"; };
console.log([1, 2, 3].join("-"));
Array.prototype.join = origJoin;
console.log([1, 2, 3].join("-"));

// 3. the fast path is invalidated by a write to Array.prototype and never comes
//    back, so an override installed AFTER a warm loop still wins
var s = 0;
for (var i = 0; i < 50; i++) { s += [1, 2, 3].indexOf(2); }
console.log(s);
var origIndexOf = Array.prototype.indexOf;
Array.prototype.indexOf = function () { return 99; };
console.log([1, 2, 3].indexOf(2));
Array.prototype.indexOf = origIndexOf;
console.log([1, 2, 3].indexOf(2));

// 4. method identity: reading a method twice gives the same function, and it is
//    the one on the prototype
console.log([].map === [].map, [].map === Array.prototype.map);

// 5. an own property shadows the prototype
var own = [1, 2];
own.map = function () { return "OWN"; };
console.log(own.map(), [3, 4].map(function (x) { return x; }).join(","));

// 6. prototype methods are non-enumerable, so enumeration sees indices only
var ks = []; for (var k in [1, 2]) ks.push(k);
console.log(ks.join(","), Object.keys([1, 2]).join(","));
console.log([].hasOwnProperty("map"), Array.prototype.hasOwnProperty("map"));

// 7. Array.prototype.toString is join(","), a DIFFERENT function from
//    Object.prototype.toString, which still reports the type tag
console.log([1, 2].toString(), Object.prototype.toString.call([1, 2]));
console.log(String([1, 2]), "" + [1, 2]);

// 8. an unbound method value takes the receiver from its first bind. arr.sort is
//    no longer pre-bound to arr, so .bind(arr) has to be what supplies `this`.
var arr = [3, 1, 2];
console.log(JSON.stringify(arr.sort.bind(arr)()));
console.log(Array.prototype.slice.call([1, 2, 3], 1).join(","));

// 9. Object.create(Array.prototype) inherits the methods
function MyList() {}
MyList.prototype = Object.create(Array.prototype);
console.log(typeof MyList.prototype.map, typeof MyList.prototype.reduce);

// 10. the ordinary paths are unchanged
console.log([1, 2, 3].map(function (x) { return x * 2; }).join(","));
console.log([1, [2, [3]]].flat(2).join(","));
console.log([...[1, 2, 3]].join(","));
console.log(JSON.stringify([1, 2, { a: 1 }]));
