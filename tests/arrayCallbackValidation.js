// Every callback-taking Array.prototype method accepted a non-callable, or no
// argument at all, and quietly returned a default: `[1].map()` gave [],
// `[1].reduce(null)` gave 1, `[1].some()` gave false. The spec throws before
// touching the array. A caller who passed the wrong thing — a typo, an undefined
// import, a method reference that did not resolve — got a plausible answer
// instead of an error, which is the worst way for this to fail.
//
// Also here: reduce over an empty array with no seed has nothing to return and
// must throw; the check counts PRESENT elements, so a hole-only array counts as
// empty.
const t = (l, f) => { try { console.log(l, "->", String(f())); } catch (e) { console.log(l, "THREW", e.constructor.name); } };
for (const m of ["forEach","map","filter","some","every","find","findIndex","flatMap","reduce","reduceRight"]) {
  t(m + " non-callable", () => [1][m](null));
  t(m + " no arg", () => [1][m]());
}
t("reduce empty no init", () => [].reduce((a,b)=>a+b));
t("reduceRight empty no init", () => [].reduceRight((a,b)=>a+b));
t("reduce empty with init", () => [].reduce((a,b)=>a+b, 5));
t("reduce skips holes", () => { const a=[1,,3]; return a.reduce((s,v)=>s+v, 0); });
t("reduce index order", () => { const seen=[]; [1,2,3].reduce((s,v,i)=>{seen.push(i);return s;},0); return seen.join(","); });
t("reduceRight order", () => { const seen=[]; [1,2,3].reduceRight((s,v,i)=>{seen.push(i);return s;},0); return seen.join(","); });
t("reduce no init uses first", () => [5,1,1].reduce((a,b)=>a+b));
t("reduceRight no init uses last", () => [1,1,5].reduceRight((a,b)=>a+b));
t("forEach thisArg", () => { const out=[]; [1].forEach(function(){ out.push(this.x); }, {x:7}); return out[0]; });
t("map thisArg", () => [1].map(function(){ return this.x; }, {x:8})[0]);
t("filter holes skipped", () => JSON.stringify([1,,3].filter(()=>true)));
t("some holes skipped", () => { let n=0; [1,,3].some(()=>{n++;return false;}); return n; });
t("concat spreadable", () => JSON.stringify([1].concat([2,[3]])));
t("concat non-array", () => JSON.stringify([1].concat(2,"a")));
t("copyWithin", () => JSON.stringify([1,2,3,4,5].copyWithin(0,3)));
t("copyWithin negative", () => JSON.stringify([1,2,3,4,5].copyWithin(-2,0)));
t("reduce holes-only no init", () => [,,].reduce((a,b)=>a+b));
t("sort non-callable comparator", () => [2,1].sort(null));
t("sort undefined comparator ok", () => JSON.stringify([2,1].sort(undefined)));
t("sort no comparator ok", () => JSON.stringify([2,1].sort()));
t("callable bound method ok", () => JSON.stringify([1,2].map(String)));
t("arrow ok", () => JSON.stringify([1,2].map(x => x * 2)));
// ORDERING: the receiver's length is read before the callback is validated, so a
// length getter that throws wins over the callback TypeError.
function lenThrows() { const o = { 0: 11 }; Object.defineProperty(o, "length", { get() { throw new RangeError("lenfirst"); }, configurable: true }); return o; }
t("length getter beats callback check (map)", () => Array.prototype.map.call(lenThrows(), undefined));
t("length getter beats callback check (reduceRight)", () => Array.prototype.reduceRight.call(lenThrows(), function () {}));
t("generic with good length still checks cb", () => Array.prototype.map.call({ length: 1, 0: 1 }, undefined));
