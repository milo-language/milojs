// ES2023/2024 members that were simply absent, plus the globalThis the RUNTIME
// used to hide behind a hand-written whitelist.
console.log(JSON.stringify(Object.groupBy([1, 2, 3, 4, 5], x => (x % 2 ? "odd" : "even"))));
console.log(JSON.stringify(Object.groupBy([], x => "k")));
const mg = Map.groupBy([1, 2, 3, 4], x => x % 2);
console.log([...mg.entries()].map(e => e[0] + ":" + e[1].join("|")).join(" "), mg.size);
console.log(JSON.stringify([...Map.groupBy(["a", "bb"], s => s.length).keys()]));

console.log("isWellFormed:", "ab".isWellFormed(), "toWellFormed:", "ab".toWellFormed());
console.log("typeof:", typeof "".isWellFormed, typeof "".toWellFormed);

// the methods that live only on the by-name string dispatch must survive: adding
// isWellFormed via String.prototype would have turned that path off and taken
// normalize and localeCompare with it
// Calling them, not reading them: this engine dispatches several string methods
// by name, so reading one as a value answers undefined (tracked separately).
console.log("normalize still works:", "a".normalize("NFC"), "localeCompare:", "a".localeCompare("b"));

console.log("TA.of:", Array.from(Uint8Array.of(1, 2, 3)).join(","));
console.log("TA.from array:", Array.from(Uint8Array.from([4, 5])).join(","));
console.log("TA.from mapfn:", Array.from(Uint8Array.from([1, 2], x => x * 2)).join(","));
console.log("TA.from iterable:", Array.from(Int16Array.from(new Set([7, 8]))).join(","));
console.log("TA.of coerces:", Array.from(Uint8Array.of(300, -1)).join(","));

// globalThis resolves through the global scope rather than a whitelist
const g = globalThis;
console.log(["Symbol", "Reflect", "Proxy", "Uint8Array", "WeakMap", "BigInt", "RegExp",
  "Function", "process", "console", "Buffer", "setTimeout"].map(k => typeof g[k]).join(","));
console.log("global === globalThis:", global === globalThis, "self ref:", globalThis.globalThis === globalThis);

// structuredClone is a deep copy, not a reference
const src = { a: [1, { b: 2 }] };
const copy = structuredClone(src);
copy.a[1].b = 9;
console.log("structuredClone deep:", JSON.stringify(src), JSON.stringify(copy));

// unchanged neighbours
console.log("Map/Set intact:", new Map([[1, "a"]]).get(1), new Set([1, 2]).size);
console.log("typed arrays intact:", new Uint8Array([1, 2]).join(","), Uint8Array.BYTES_PER_ELEMENT);
