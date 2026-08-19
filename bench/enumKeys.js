// Object.keys / for-in / Object.values over a plain object and a large array:
// the surfaces that now share one key walk (ownStringKeys).
const obj = {};
for (let i = 0; i < 200; i++) obj["k" + i] = i;
const arr = new Array(2000);
for (let i = 0; i < arr.length; i++) arr[i] = i;
let acc = 0;
for (let r = 0; r < 200; r++) {
  acc += Object.keys(obj).length;
  acc += Object.values(obj).length;
  for (const k in obj) acc += k.length;
  acc += Object.keys(arr).length;
  for (const k in arr) acc += 1;
}
console.log(acc);
