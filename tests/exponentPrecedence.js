// `**` binds tighter than the multiplicative operators and is right-associative.
// Parsing it at the same level as `*` made Math.PI * r ** 2 compute (PI * r) ** 2.
const r = 2;
console.log(Math.PI * r ** 2, 2 * 3 ** 2, 3 ** 2 * 2, 4 / 2 ** 2, 10 % 3 ** 2);
console.log(2 ** 3 ** 2, (2 ** 3) ** 2, 2 ** 2 ** 3);
console.log(2 + 3 ** 2, 2 - 3 ** 2, -(2 ** 2), (-2) ** 2);
console.log(2 ** -1, 2 ** 0.5 === Math.SQRT2, 10n ** 3n);
let x = 3; x **= 2; console.log(x);
