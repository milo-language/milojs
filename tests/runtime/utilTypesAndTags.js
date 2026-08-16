// util.types had four predicates whose whole body was `return false`, which made
// them LIE about features this engine has. Fixing them needed the type tags
// first: an async function, a generator function and a generator object all
// reported [object Function] or [object Object].
const t = require("util").types;
const T = v => Object.prototype.toString.call(v);

console.log("async fn tag:", T(async function () {}));
console.log("gen fn tag:", T(function* () {}));
console.log("async gen fn tag:", T(async function* () {}));
console.log("gen obj tag:", T((function* () {})()));
console.log("plain fn tag:", T(function () {}));
console.log("arrow tag:", T(() => {}));

console.log("isAsyncFunction:", t.isAsyncFunction(async function () {}), t.isAsyncFunction(function () {}));
console.log("isGeneratorFunction:", t.isGeneratorFunction(function* () {}), t.isGeneratorFunction(function () {}));
console.log("isGeneratorObject:", t.isGeneratorObject((function* () {})()), t.isGeneratorObject({}));
console.log("async generator counts as both:",
  t.isAsyncFunction(async function* () {}), t.isGeneratorFunction(async function* () {}));

// the predicates that were already right stay right
console.log("unchanged:", [t.isDate(new Date()), t.isRegExp(/x/), t.isMap(new Map()),
  t.isSet(new Set()), t.isPromise(Promise.resolve()), t.isTypedArray(new Uint8Array(1))].join(","));
console.log("negatives:", [t.isDate({}), t.isRegExp({}), t.isMap({}), t.isPromise({})].join(","));
