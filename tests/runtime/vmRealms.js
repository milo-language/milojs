// node:vm contexts are realms: a contextified sandbox holds the context's global
// variables, and everything else global is the context's own set of built-ins.
const vm = require('vm');

// The sandbox is the context's globals: reads, writes, declarations, typeof,
// `in`, and delete all reach it.
const sandbox = { a: 1, shadow: 'mine' };
const ctx = vm.createContext(sandbox);
console.log('read:', vm.runInContext('a + 1', ctx));
vm.runInContext('a = 10; b = 20; var v = 30; function f() { return v; } let lex = 40;', ctx);
console.log('written:', sandbox.a, sandbox.b, sandbox.v, typeof sandbox.f, 'lex' in sandbox);
console.log('keys:', Object.keys(sandbox).join(','));
console.log('lexical stays inside:', vm.runInContext('lex', ctx), sandbox.lex);
console.log('function sees sandbox:', vm.runInContext('f()', ctx));
sandbox.v = 31;
console.log('host write seen:', vm.runInContext('v', ctx));
console.log('typeof:', vm.runInContext('typeof a', ctx), vm.runInContext('typeof nope', ctx), vm.runInContext('typeof f', ctx));
console.log('in this:', vm.runInContext("'a' in this", ctx), vm.runInContext("'nope' in this", ctx));
console.log('delete:', vm.runInContext('delete b', ctx), 'b' in sandbox, vm.runInContext('delete v', ctx), sandbox.v);
console.log('shadowed name:', vm.runInContext('shadow', ctx));
vm.runInContext('Array = "replaced"', ctx);
console.log('builtin assignment lands on sandbox:', sandbox.Array);
delete sandbox.Array;

// An accessor on the sandbox runs, for bare names and for `this.x` alike.
let hits = 0;
Object.defineProperty(sandbox, 'counted', { get() { hits++; return 'got'; }, set(x) { hits += x; }, configurable: true });
console.log('getter:', vm.runInContext('counted + this.counted', ctx), hits);
vm.runInContext('counted = 100', ctx);
console.log('setter:', hits);

// Strict code: an undeclared name is a ReferenceError, a read-only one a TypeError.
try {
  vm.runInContext('"use strict"; undeclared = 1', ctx);
} catch (e) {
  console.log('strict undeclared:', e.name, e.message, 'undeclared' in sandbox);
}
Object.defineProperty(sandbox, 'ro', { value: 5 });
vm.runInContext('ro = 6', ctx);
console.log('sloppy read-only:', sandbox.ro);
try {
  vm.runInContext('"use strict"; ro = 6', ctx);
} catch (e) {
  console.log('strict read-only:', e.name);
}

// Built-ins not shadowed by the sandbox are the context's own.
const other = vm.runInNewContext('({ Array, Object, arr: [], obj: {}, fn: function () {} })');
console.log('own Array:', other.Array !== Array, other.Object !== Object);
console.log('instanceof across:', other.arr instanceof Array, other.arr instanceof other.Array, Array.isArray(other.arr));
console.log('object proto:', Object.getPrototypeOf(other.obj) === other.Object.prototype, other.obj instanceof Object);
console.log('same context, same Array:', vm.runInContext('Array', ctx) === vm.runInContext('Array', ctx));
console.log('fresh Array per context:', vm.runInNewContext('Array') !== vm.runInNewContext('Array'));
console.log('sandbox built-in passes through:', vm.runInNewContext('Array === outerArray', { outerArray: Array, Array }));

// An error a context throws is made from that context's constructors.
try {
  vm.runInNewContext('null.x');
} catch (e) {
  console.log('TypeError from context:', e instanceof TypeError, e.name, e.message);
}
try {
  vm.runInNewContext('missing');
} catch (e) {
  console.log('ReferenceError from context:', e instanceof ReferenceError, e.name, Object.prototype.toString.call(e));
}
try {
  vm.runInNewContext('(');
} catch (e) {
  console.log('SyntaxError from context:', e instanceof SyntaxError, e.name);
}
const hostError = vm.runInNewContext('var caught; try { boom(); } catch (e) { caught = e; } caught', { boom() { throw new RangeError('host'); } });
console.log('host error crossing in:', hostError instanceof RangeError, hostError.message);

// `this` at the top of a context is its global object, which is not the
// sandbox but forwards to it.
const g = vm.runInContext('this', ctx);
console.log('this:', g === sandbox, g === vm.runInContext('globalThis', ctx), typeof g.Object, g.a);
g.fromOutside = 'yes';
console.log('write through global:', sandbox.fromOutside, vm.runInContext('fromOutside', ctx));
sandbox.self = sandbox;
console.log('sandbox as itself:', vm.runInContext('self === this', ctx));

// A function made in a context keeps its realm when called outside it.
const maker = vm.runInNewContext('var tag = "inner"; (function () { return [tag, [], {}]; })');
const made = maker();
console.log('function keeps realm:', made[0], made instanceof Array, made[1] instanceof Array, Array.isArray(made[1]));
const sloppyThis = vm.runInContext('(function () { return this; })', ctx);
console.log('sloppy this:', sloppyThis() === g);

// Nested contexts: a context can make its own.
const nested = vm.runInNewContext(
  'const inner = vm.runInNewContext("[]"); [inner instanceof Array, Array.isArray(inner), Array === outerArray]',
  { vm, outerArray: Array });
console.log('nested:', nested.join(','));

// isContext.
console.log('isContext:', vm.isContext(sandbox), vm.isContext({}), vm.isContext(g));
try {
  vm.isContext(1);
} catch (e) {
  console.log('isContext(1):', e.code);
}
console.log('createContext again:', vm.createContext(sandbox) === sandbox);

// One Script, run in two contexts, sees each context's globals.
const script = new vm.Script('count = (typeof count === "number" ? count : 0) + step; count');
const c1 = vm.createContext({ step: 1 });
const c2 = vm.createContext({ step: 100 });
console.log('script reuse:', script.runInContext(c1), script.runInContext(c2), script.runInContext(c1), c1.count, c2.count);
console.log('script in new context:', new vm.Script('typeof step').runInNewContext());
console.log('runInThisContext:', vm.runInThisContext('typeof require'), vm.runInThisContext('Array === this.Array'));

// compileFunction: parameters, a parsing context, and context extensions.
const add = vm.compileFunction('return a + b + (typeof fromCtx)', ['a', 'b'], { parsingContext: vm.createContext({ fromCtx: 1 }) });
console.log('compileFunction:', add(1, 2), String(vm.compileFunction('return x', ['x'])));
console.log('contextExtensions:', vm.compileFunction('return ext', [], { contextExtensions: [{ ext: 'extended' }] })());
