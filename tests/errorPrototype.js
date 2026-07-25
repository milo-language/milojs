console.log(typeof Error.prototype, typeof TypeError.prototype);
console.log(typeof TypeError.prototype.constructor);
console.log(TypeError.prototype.constructor === TypeError);
console.log(Error.prototype.constructor === Error);
console.log(TypeError.prototype.name, Error.prototype.name);
console.log(Object.getPrototypeOf(TypeError.prototype) === Error.prototype);
try { null.x } catch (e) {
  console.log(Object.getPrototypeOf(e) === TypeError.prototype);
  console.log(e.constructor === TypeError, e.constructor.name);
  console.log(e instanceof TypeError, e instanceof Error);
  console.log(e.name, e.message.length > 0);
  console.log(String(e).indexOf("TypeError") === 0);
}
var e2 = new RangeError("boom");
console.log(e2.name, e2.message, e2 instanceof RangeError, e2 instanceof Error);
console.log(Object.getPrototypeOf(e2) === RangeError.prototype);
console.log(Object.prototype.toString.call(e2));
console.log(e2.toString());
console.log(Object.keys(e2).length);
class MyErr extends Error { constructor(m){ super(m); this.name = "MyErr" } }
var m = new MyErr("custom");
console.log(m.name, m.message, m instanceof Error);
