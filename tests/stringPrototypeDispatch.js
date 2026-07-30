console.log("abc".slice === String.prototype.slice);
console.log(Object.keys(String.prototype).includes("slice"));
console.log(String.prototype.constructor === String);

String.prototype.second = function () {
  return this[1];
};
console.log("abc".second());
delete String.prototype.second;
console.log(typeof "abc".second);

const originalSlice = String.prototype.slice;
for (let i = 0; i < 100; i++) {
  "abc".slice(1);
}
String.prototype.slice = function () {
  return "override";
};
console.log("abc".slice(1));
console.log("abc"["slice"](1));
String.prototype.slice = originalSlice;
console.log("abc".slice(1));
console.log("abc".slice === String.prototype.slice);

function DerivedString() {}
DerivedString.prototype = Object.create(String.prototype);
console.log(typeof DerivedString.prototype.trim);
