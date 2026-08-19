// `__proto__: v` in an object literal SETS the prototype; it is the only
// spelling that does. This engine defined an ordinary own property instead, so
// { __proto__: null } was a normal object with a stray enumerable key.
var nullProto = { __proto__: null, foo: 1 };
console.log(Object.keys(nullProto), Object.getPrototypeOf(nullProto), 'toString' in nullProto);
var inherits = { __proto__: { x: 1 } };
console.log(inherits.x, Object.keys(inherits));
var k = '__proto__';
console.log('computed is an own property:', Object.keys({ [k]: null }), Object.getPrototypeOf({ [k]: null }) === Object.prototype);
console.log('quoted still sets it:', Object.getPrototypeOf({ '__proto__': null }));
console.log('a non-object value is ignored:', Object.getPrototypeOf({ __proto__: 5 }) === Object.prototype, Object.keys({ __proto__: 5 }));

// The `__proto__` accessor lives on Object.prototype, so an object that does
// not inherit it gets an ordinary property for both read and write.
var n = Object.create(null);
n.__proto__ = { y: 2 };
console.log('own on a null-proto object:', Object.keys(n), n.y, Object.getPrototypeOf(n));
console.log('read with no accessor:', Object.create(null).__proto__);

// instanceof Object has to follow the same chain rather than answering true for
// everything with a property bag.
console.log([] instanceof Object, ({}) instanceof Object, (function () {}) instanceof Object,
  (() => {}) instanceof Object, (class {}) instanceof Object,
  Object.create(null) instanceof Object, Object.create(Object.create(null)) instanceof Object);
