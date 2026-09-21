// The Map/Set constructor drives the iterator lazily: an entry whose read
// throws ends the walk (and closes the iterator) even when next() never
// reports done, and a non-iterable argument is a TypeError.
var count = 0, closed = false;
var item = ['foo', 'bar'];
Object.defineProperty(item, 0, { get: function() { throw new TypeError("abrupt"); } });
var iterable = {};
iterable[Symbol.iterator] = function() {
  return {
    next: function() { count++; return { value: item, done: false }; },
    return: function() { closed = true; return {}; }
  };
};
try { new Map(iterable); } catch (e) { console.log("caught:", e.message, "calls:", count, "closed:", closed); }
try { new Set({ [Symbol.iterator]() { return { next() { return { get done() { throw new RangeError("d"); } }; } }; } }); } catch (e) { console.log("set caught:", e.message); }
try { new Map([1]); } catch (e) { console.log(e.constructor.name); }
try { new Map("ab"); } catch (e) { console.log(e.constructor.name); }
try { new Set(5); } catch (e) { console.log(e.constructor.name); }
try { new Set({}); } catch (e) { console.log(e.constructor.name); }
console.log(new Map(null).size, new Map(undefined).size, new Set("café").has("é"));
console.log(new Set(new Uint8Array([5, 6, 5])).size, new Set(new Proxy([7, 8], {})).size);
function* gen() { yield [1, "x"]; yield [2, "y"]; }
var m2 = new Map(gen()); console.log(m2.get(1), m2.get(2), new Map(m2).size, new Set(new Set([1, 2])).size);
console.log(new Map({ [Symbol.iterator]: function*() { yield { get 0() { return "k"; }, get 1() { return "v"; } }; } }).get("k"));
var short = new Map([[1]]); console.log(short.has(1), short.get(1));
