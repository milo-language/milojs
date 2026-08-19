// querystring's decoder is UTF-8, its pair cap is 1000 by default, its eq may be
// multi-character, and its result is a null-prototype object so that a query
// naming __proto__ answers an own property.
const qs = require('querystring');
console.log(qs.unescape('%C3%A9'), JSON.stringify(qs.parse('a=%C3%A9')));
console.log(JSON.stringify(qs.parse('a==>1', '&', '==>')));
console.log(JSON.stringify(qs.parse('a=1;;b=2', ';;')));
console.log(JSON.stringify(qs.parse('__proto__=1')));
const big = Array.from({ length: 1200 }, (_, i) => 'k' + i + '=v').join('&');
console.log([undefined, 0, 5, NaN, Infinity, -1].map((mk) =>
  Object.keys(qs.parse(big, null, null, mk === undefined ? undefined : { maxKeys: mk })).length).join(','));
// stringify keeps only the primitives with an obvious spelling
console.log(qs.stringify({ a: null, b: undefined, c: 3, d: false, e: {}, f: 'x y' }));
// escape is defined on the STRING form, unlike stringify's value conversion
console.log(qs.escape(5), qs.escape({}), qs.escape([5, 10]), qs.escape('Ŋōđĕ'));
console.log(qs.unescape('%'), qs.unescape('%zz'), qs.unescape('a+b'), qs.unescape('a+b', true));
