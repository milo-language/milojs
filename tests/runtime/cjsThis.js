// A CommonJS module's top-level `this` is its exports object, an arrow at top
// level sees the same, and a top-level var is module-scoped, not a global.
console.log(typeof this, this === module.exports, (() => this)() === module.exports, this === globalThis);
var mine = 1;
console.log(Object.getOwnPropertyDescriptor(globalThis, "mine"), typeof mine);
this.viaThis = 3; console.log(exports.viaThis, module.exports.viaThis);
