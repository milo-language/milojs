var ctx = { n: 10, tag: "T" };
console.log([1,2,3].map(function(v){ return v + this.n }, ctx).join(","));
console.log([1,2,3].filter(function(v){ return v > this.n - 9 }, ctx).join(","));
var acc = [];
[1,2].forEach(function(v){ acc.push(this.tag + v) }, ctx);
console.log(acc.join(","));
console.log([1,2,3].some(function(v){ return v === this.n - 8 }, ctx));
console.log([1,2,3].every(function(v){ return v < this.n }, ctx));
console.log([1,2,3].find(function(v){ return v === this.n - 7 }, ctx));
console.log([1,2,3].findIndex(function(v){ return v === this.n - 7 }, ctx));
console.log([1,2,3].findLast(function(v){ return v < this.n - 8 }, ctx));
console.log([1,2,3].findLastIndex(function(v){ return v < this.n - 8 }, ctx));
console.log([1,2].flatMap(function(v){ return [v, this.n] }, ctx).join(","));
// reduce must NOT treat arg 1 as thisArg
console.log([1,2,3].reduce(function(a,b){ return a+b }, 100));
console.log([1,2,3].reduceRight(function(a,b){ return a+b }, 100));
// no thisArg -> undefined this (sloppy mode: global object, so check typeof)
[1].forEach(function(){ console.log(this === undefined || typeof this === "object") });
// generic receiver + thisArg together
var alike = {length: 2, 0: 1, 1: 2};
console.log(Array.prototype.map.call(alike, function(v){ return v * this.n }, ctx).join(","));
