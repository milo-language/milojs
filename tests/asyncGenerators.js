// async generators and `for await (… of …)`, pinned byte-exact to node.
//
// An `async function*` is a GENERATOR first — calling it returns an async
// generator object, not a promise — whose body still awaits, because that body
// runs on its own green task and that is all parkOnPromise needs. next/throw/
// return wrap each step in a promise.
//
// `for await` prefers Symbol.asyncIterator and awaits the step object; over a
// plain sync iterable it awaits each VALUE instead (the spec's
// CreateAsyncFromSyncIterator), which is what makes `for await (x of [p1, p2])`
// bind resolved values.
//
// Deliberately ONE sequential async IIFE. next() here drives the body to its
// next yield and returns an already-settled promise, where node returns a
// pending one and runs the body later — so two independent async functions
// interleave differently than in node. Values are identical; the interleaving
// is the open item in docs/backlog.md.
async function* ag() { yield 1; yield 2; return 'r' }
async function* awaiting() { for (let i = 0; i < 3; i++) { await null; yield i * 10 } }
async function* thrower() { yield 1; throw new Error('agboom') }
async function* cleanup() { try { yield 1; yield 2 } finally { console.log('ag finally') } }
async function* delegating() { yield* [1, 2]; yield 3 }
function* sync() { yield 's1'; yield 's2' }
class C { async *gen() { yield 'c1'; await null; yield 'c2' } }
const obj = { async *gen() { yield 'o1'; yield 'o2' } };
const custom = {
  [Symbol.asyncIterator]() {
    let n = 0;
    return { next: async () => (n < 2 ? { value: 'c' + n++, done: false } : { value: undefined, done: true }) };
  }
};
const p = v => Promise.resolve(v);

(async () => {
  const g0 = ag();
  console.log(typeof g0, typeof g0.next);
  console.log(await g0.next(), await g0.next(), await g0.next());

  for await (const x of ag()) console.log('ag', x);
  for await (const x of [1, 2, 3]) console.log('arr', x);
  for await (const x of [p('a'), p('b')]) console.log('prom', x);
  for await (const x of awaiting()) console.log('awaiting', x);
  for await (const x of 'hi') console.log('str', x);
  for await (const x of new Set([7, 8])) console.log('set', x);
  for await (const x of sync()) console.log('sync', x);
  for await (const x of custom) console.log('custom', x);
  for await (const [k, v] of new Map([['k', 1]])) console.log('map', k, v);

  for await (const x of new C().gen()) console.log(x);
  for await (const x of obj.gen()) console.log(x);
  try { for await (const x of thrower()) console.log('t', x) } catch (e) { console.log('caught', e.message) }
  for await (const x of cleanup()) { if (x === 1) break }
  console.log('after break');
  for await (const x of delegating()) console.log('deleg', x);

  const g = cleanup();
  console.log(await g.next());
  console.log(await g.return('rv'));
  console.log(await g.next());

  const g2 = thrower();
  await g2.next();
  await g2.next().then(() => console.log('BAD'), e => console.log('rejected:', e.message));

  const g3 = cleanup();
  await g3.next();
  await g3.throw(new Error('into')).then(() => console.log('BAD2'), e => console.log('threw in:', e.message));

  console.log(typeof (async function* () {})()[Symbol.asyncIterator]);
  console.log('end');
})();
