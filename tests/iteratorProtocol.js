// The iteration protocol as OBSERVED: which methods run, in what order, and what
// happens when an iterator misbehaves. milojs got 17 of 19 right, including
// calling `return()` on break, on throw and on an early function return, which is
// the part engines most often skip.
//
// The two it missed were the same rule twice: an iterator result must be an
// OBJECT. `next()` answering a primitive, and @@iterator answering a primitive,
// both ended the loop silently instead of raising TypeError -- and the spread and
// yield* paths already enforced it, so for-of was the one consumer that did not.
function log(n, f) { const seen = []; try { f(seen); console.log(n, JSON.stringify(seen)); } catch (e) { console.log(n, "THREW", e.constructor.name, JSON.stringify(seen)); } }
function tracked(values, seen) {
  let i = 0;
  return {
    [Symbol.iterator]() { return this; },
    next() { seen.push("next"); return i < values.length ? { value: values[i++], done: false } : { value: undefined, done: true }; },
    return(v) { seen.push("return"); return { value: v, done: true }; },
  };
}
log("for-of break", (s) => { for (const x of tracked([1, 2, 3], s)) { s.push("body" + x); break; } });
log("for-of throw", (s) => { try { for (const x of tracked([1, 2], s)) { throw new Error("x"); } } catch (e) { s.push("caught"); } });
log("for-of return-in-fn", (s) => { (function () { for (const x of tracked([1, 2], s)) return; })(); });
log("destructure partial", (s) => { const [a] = tracked([1, 2, 3], s); s.push("a=" + a); });
log("spread full", (s) => { const a = [...tracked([1, 2], s)]; s.push("len=" + a.length); });
log("Array.from", (s) => { Array.from(tracked([1, 2], s)); });
log("Map ctor", (s) => { new Map(tracked([["k", 1]], s)); });
log("Promise.all", (s) => { Promise.all(tracked([], s)); });
// built-in iterators must expose the protocol too
log("array iter proto", (s) => { const it = [1, 2][Symbol.iterator](); s.push(typeof it.next, typeof it.return, String(it[Symbol.iterator]() === it)); });
log("string iter", (s) => { const it = "ab"[Symbol.iterator](); s.push(JSON.stringify(it.next()), typeof it.return); });
log("map iter", (s) => { const it = new Map([["k", 1]])[Symbol.iterator](); s.push(JSON.stringify(it.next().value), typeof it.return); });
log("set iter", (s) => { const it = new Set([1])[Symbol.iterator](); s.push(JSON.stringify(it.next()), typeof it.return); });
// broken iterators
log("next not fn", (s) => { for (const x of { [Symbol.iterator]() { return { next: 1 }; } }) s.push(x); });
log("next returns primitive", (s) => { for (const x of { [Symbol.iterator]() { return { next() { return 5; } }; } }) s.push(x); });
log("iterator not obj", (s) => { for (const x of { [Symbol.iterator]() { return 5; } }) s.push(x); });
log("symbol.iterator null", (s) => { for (const x of { [Symbol.iterator]: null }) s.push(x); });
log("throwing return", (s) => { const it = { [Symbol.iterator]() { return this; }, next() { return { value: 1, done: false }; }, return() { throw new TypeError("ret"); } }; for (const x of it) break; });
log("done-getter", (s) => { let n = 0; const it = { [Symbol.iterator]() { return this; }, next() { n++; return { get done() { s.push("done?"); return n > 1; }, get value() { s.push("value?"); return n; } }; } }; for (const x of it) s.push("got" + x); });
