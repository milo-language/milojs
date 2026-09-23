// Realms: a second set of intrinsics and a second global scope, made by the
// engine intrinsic __realmCreate (answers the new realm's global object) and
// driven by __realmEval (a global script in the realm owning that object).
// test262's $262.createRealm/evalScript are built on exactly these two.
//
// node has neither intrinsic, but node's vm module makes real realms, so under
// node the two are shimmed onto vm.createContext/vm.runInContext below and node
// stays the oracle for every line. (milojs's own node:vm is not a realm yet, and
// is not what this tests.) Each expectation is also the spec's, noted beside it.
if (typeof __realmCreate === "undefined") {
    var vm = require("vm");
    var contexts = new Map();
    globalThis.__realmCreate = function () {
        var ctx = vm.createContext({});
        var g = vm.runInContext("globalThis", ctx);
        contexts.set(g, ctx);
        return g;
    };
    globalThis.__realmEval = function (g, src) {
        return vm.runInContext(src, contexts.get(g));
    };
}

var B = __realmCreate();
var run = function (src) { return __realmEval(B, src); };

// Each realm has its own intrinsics (CreateRealm / CreateIntrinsics).
console.log("own Array:", B.Array !== Array, B.Object !== Object, B.Map !== Map);
console.log("own global:", B !== globalThis, run("globalThis") === B);

// An array of B inherits B's Array.prototype, so it is not an instance of A's
// Array (OrdinaryHasInstance walks the chain), yet IsArray sees the exotic
// object whatever its realm.
var bArr = run("[1, 2, 3]");
console.log("B array instanceof Array:", bArr instanceof Array, bArr instanceof B.Array);
console.log("Array.isArray(B array):", Array.isArray(bArr));
console.log("B array proto:", Object.getPrototypeOf(bArr) === B.Array.prototype);

// A plain object literal of B inherits B's Object.prototype.
var bObj = run("({ a: 1 })");
console.log("B object:", bObj instanceof Object, bObj instanceof B.Object, Object.getPrototypeOf(bObj) === B.Object.prototype);
console.log("B Map:", new B.Map() instanceof Map, new B.Map() instanceof B.Map);

// A function created in B runs in B when A calls it (PrepareForOrdinaryCall
// sets the callee's realm): its literals are B's, and so are its globals.
var make = run("var where = 'B'; function make() { return [where, {}, []]; } make");
var where = "A";
var made = make();
console.log("B function from A:", made[0], made instanceof B.Array, Object.getPrototypeOf(made[1]) === B.Object.prototype, made[2] instanceof B.Array);

// A sloppy assignment to an undeclared name inside a B function creates a
// global of B, the realm of the function, not of its caller.
run("function leak() { leaked = 'B global'; }");
B.leak();
console.log("undeclared assignment:", B.leaked, typeof leaked);

// An error B's own code raises is made from B's intrinsics.
try {
    run("null.x");
} catch (e) {
    console.log("TypeError from B:", e instanceof TypeError, e instanceof B.TypeError, e.constructor === B.TypeError);
}
try {
    run("(");
} catch (e) {
    console.log("SyntaxError from B:", e instanceof SyntaxError, e instanceof B.SyntaxError);
}

// The symbol registry and the well-known symbols are shared by every realm
// (GlobalSymbolRegistry is agent-wide; well-known symbols are "shared by all
// realms", spec 6.1.5.1).
console.log("Symbol.for shared:", run("Symbol.for('x')") === Symbol.for("x"));
console.log("Symbol.iterator shared:", B.Symbol.iterator === Symbol.iterator);

// A builtin runs in its own realm too. B's map called on an A array: the
// receiver's constructor is A's %Array%, which ArraySpeciesCreate treats as
// undefined because it is another realm's, so the result is an array of the
// running realm, B.
var mapped = B.Array.prototype.map.call([1, 2], function (v) { return v * 10; });
console.log("B map on A array:", mapped instanceof B.Array, mapped instanceof Array, mapped.join());
var mappedA = Array.prototype.map.call(bArr, function (v) { return v; });
console.log("A map on B array:", mappedA instanceof Array, mappedA instanceof B.Array);
console.log("B.Array():", B.Array(2) instanceof B.Array, new B.Array(2) instanceof B.Array);

// GetPrototypeFromConstructor: a newTarget whose prototype is not an object
// yields the default prototype from newTarget's realm.
var C = new B.Function();
C.prototype = null;
console.log("proto from newTarget realm:", Object.getPrototypeOf(Reflect.construct(Map, [], C)) === B.Map.prototype);

// Writing to B's Array.prototype from A must be seen by B's own calls: the
// fast path B keeps for a pristine Array.prototype has to be retired.
B.Array.prototype.push = function () { return "patched"; };
console.log("patched B push:", run("[].push(1)"), [].push(1));

// A B generator yields values its body builds in B.
var gen = run("(function* () { yield []; yield {}; })")();
var g1 = gen.next().value;
var g2 = gen.next().value;
console.log("B generator:", g1 instanceof B.Array, Object.getPrototypeOf(g2) === B.Object.prototype);

// A B async function resumes in B after its await, whatever ran meanwhile.
var af = run("(async function () { await null; return []; })");
af().then(function (v) {
    console.log("B async after await:", v instanceof B.Array, v instanceof Array);
});
