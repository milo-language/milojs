// The async half: for-await over an async iterator, a sync iterable (wrapped by
// CreateAsyncFromSyncIterator), promise-valued elements, and an async generator.
// One divergence, the same object-result rule as the sync side: @@asyncIterator
// answering a primitive left the loop with nothing to drive, so `for await` did
// nothing and the surrounding try/catch never saw the TypeError.
function done(v) { console.log(v); }
async function main() {
  const seen = [];
  const src = {
    [Symbol.asyncIterator]() { return this; },
    i: 0,
    async next() { seen.push("next"); return this.i < 2 ? { value: this.i++, done: false } : { done: true }; },
    async return(v) { seen.push("return"); return { done: true }; },
  };
  for await (const x of src) seen.push("got" + x);
  done("async full: " + JSON.stringify(seen));

  const seen2 = [];
  const src2 = { [Symbol.asyncIterator]() { return this; }, async next() { seen2.push("next"); return { value: 1, done: false }; }, async return() { seen2.push("return"); return { done: true }; } };
  for await (const x of src2) { seen2.push("body"); break; }
  done("async break: " + JSON.stringify(seen2));

  // sync iterable through for-await gets wrapped
  const seen3 = [];
  for await (const x of [1, 2]) seen3.push(x);
  done("sync via await: " + JSON.stringify(seen3));

  // a promise-valued sync iterable is awaited per element
  const seen4 = [];
  for await (const x of [Promise.resolve("a"), "b"]) seen4.push(x);
  done("promises: " + JSON.stringify(seen4));

  // async generator
  async function* ag() { yield 1; yield 2; }
  const seen5 = [];
  for await (const x of ag()) seen5.push(x);
  done("async gen: " + JSON.stringify(seen5));

  try { for await (const x of { [Symbol.asyncIterator]() { return 5; } }) {} }
  catch (e) { done("bad asyncIterator: " + e.constructor.name); }

  try { for await (const x of { [Symbol.asyncIterator]() { return { async next() { return 7; } }; } }) {} }
  catch (e) { done("primitive result: " + e.constructor.name); }
}
main();
