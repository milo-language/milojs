const values = [1, 2, 3];

values.length = 0x7fffffff;
console.log(values.length, values[0], values[3], 3 in values);

console.log(
  values.push(4),
  values.length,
  values[0x7fffffff],
  0x7fffffff in values
);
console.log(values.pop(), values.length, 0x7fffffff in values);

values.length = 2;
console.log(
  values.length,
  values[0],
  values[0x7fffffff],
  0x7fffffff in values,
  Object.keys(values).join(",")
);

values.length = 10;
values[8] = 9;
console.log(values.length, values[8], 8 in values, Object.keys(values).join(","));
