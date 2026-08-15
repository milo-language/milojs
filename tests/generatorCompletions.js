// gen.throw(e) / gen.return(v) and the IteratorClose that for-of, destructuring
// and yield* owe an abandoned iterator. Pinned byte-exact to node.
//
// The hard part is that gen.return(v) must run every enclosing `finally` while
// staying invisible to `catch` — it is not a catchable exception. It rides the
// interpreter's throw machinery with a separate genReturning flag that
// execTryBody checks, and genFinish converts back into a normal completion.
//
// Each group is braced so its const bindings stay block-scoped and cannot
// collide across groups.

{
  function* guarded() {
    try { yield 'a'; yield 'b'; }
    catch (err) { yield 'caught ' + err; }
    finally { console.log('cleanup'); }
  }
  const g1 = guarded();
  console.log(g1.next().value);
  console.log(g1.throw('boom').value);
  console.log(g1.next());
  
  const g2 = guarded();
  console.log(g2.next().value);
  console.log(g2.return('early'));
  console.log(g2.next());
  
  // throw with no catch in the body propagates to the caller
  function* bare() { yield 1; yield 2; }
  const g3 = bare();
  g3.next();
  try { g3.throw(new Error('up')); } catch (e) { console.log('propagated:', e.message); }
  console.log(g3.next());
  
  // throw/return before the body starts
  const g4 = bare();
  try { g4.throw(new Error('early')); } catch (e) { console.log('unstarted throw:', e.message); }
  console.log(g4.next());
  const g5 = bare();
  console.log(g5.return('r'), g5.next());
  
  // return on a completed generator
  const g6 = bare();
  console.log([...g6]);
  console.log(g6.return('after'), g6.next());
  
  // finally that itself returns overrides
  function* finRet() { try { yield 1; } finally { return 'fin'; } }
  const g7 = finRet();
  console.log(g7.next().value);
  console.log(g7.return('x'));
  
  // return unwinds nested finallys, outermost last
  function* nested() {
    try { try { yield 1; } finally { console.log('inner fin'); } }
    finally { console.log('outer fin'); }
  }
  const g8 = nested();
  g8.next();
  console.log(g8.return('done'));
  
  // for-of break calls return()
  function* watched() { try { yield 1; yield 2; yield 3; } finally { console.log('loop cleanup'); } }
  for (const v of watched()) { if (v === 2) break; console.log('saw', v); }
}

{
  // throw resumed into a loop, then continued
  function* loop() { for (let i=0;i<5;i++) { try { yield i } catch(e) { console.log('c',e) } } }
  const a = loop();
  console.log(a.next().value, a.throw('X').value, a.next().value);
  
  // return() from inside a nested yield* delegation
  function* inner(){ try { yield 'i1'; yield 'i2' } finally { console.log('inner cleanup') } }
  function* outer(){ try { yield* inner(); yield 'o' } finally { console.log('outer cleanup') } }
  const b = outer();
  console.log(b.next().value);
  console.log(b.return('stop'));
  
  // throw() into a delegating generator
  const c = outer();
  c.next();
  try { c.throw(new Error('deep')) } catch(e) { console.log('escaped:', e.message) }
  
  // return value threading through next()
  function* echo(){ const x = yield 1; const y = yield x*2; return x+y }
  const d = echo();
  console.log(d.next().value, d.next(10).value, d.next(5));
  
  // generator used as iterator with destructuring + early exit
  function* three(){ try { yield 1; yield 2; yield 3 } finally { console.log('destructure cleanup') } }
  const [p,q] = three();
  console.log(p,q);
  
  // for-of with return statement inside a function
  function f(){ for (const v of three()) { if (v===2) return 'ret'+v } }
  console.log(f());
  
  // for-of that throws out of the body
  try { for (const v of three()) { if (v===2) throw new Error('body') } } catch(e){ console.log('caught', e.message) }
  
  // labeled break out of nested for-of
  outerLoop: for (const v of three()) { for (const w of three()) { break outerLoop } }
  console.log('after labeled');
  
  // return() twice, and next() after return()
  const e2 = three();
  e2.next();
  console.log(e2.return('a'), e2.return('b'), e2.next());
  
  // spread over a generator runs to completion (no early close)
  function* four(){ try { yield 1; yield 2 } finally { console.log('spread cleanup') } }
  console.log([...four()]);
}

{
  // hand-rolled iterator with return(), abandoned by for-of
  const manual = { [Symbol.iterator](){ let n=0; return { next:()=>({value:n++,done:n>5}), return(){ console.log('manual close'); return {done:true} } } } };
  for (const v of manual) { if (v===1) break }
  console.log('after manual');
  // hand-rolled iterator WITHOUT return()
  const bare = { [Symbol.iterator](){ let n=0; return { next:()=>({value:n++,done:n>5}) } } };
  for (const v of bare) { if (v===1) break }
  console.log('after bare');
  // yield* over a hand-rolled iterator, outer returned
  function* deleg(){ try { yield* manual } finally { console.log('deleg fin') } }
  const d = deleg(); d.next();
  console.log(d.return('z'));
  // generator methods on classes/objects
  class C { *gen(){ try { yield 1; yield 2 } finally { console.log('class fin') } } }
  const c = new C().gen(); c.next(); console.log(c.return('cr'));
  const o = { *gen(){ try { yield 1 } finally { console.log('obj fin') } } };
  const og = o.gen(); og.next(); console.log(og.return('or'));
  // throw into a generator whose catch rethrows
  function* rethrow(){ try { yield 1 } catch(e){ throw new Error('re:'+e.message) } }
  const r = rethrow(); r.next();
  try { r.throw(new Error('orig')) } catch(e){ console.log(e.message) }
  // next() after a throw that completed the generator
  console.log(r.next());
  // return inside try with catch but no finally
  function* tc(){ try { yield 1 } catch(e){ console.log('should not run') } }
  const t = tc(); t.next(); console.log(t.return('tv'), t.next());
  // Array.from / Map over a generator (full consumption)
  function* nums(){ try { yield 1; yield 2; yield 3 } finally { console.log('nums fin') } }
  console.log(Array.from(nums()));
  console.log(new Set(nums()).size);
  // destructuring with rest consumes fully
  function* rest3(){ try { yield 1; yield 2; yield 3 } finally { console.log('rest fin') } }
  const [h, ...tl] = rest3(); console.log(h, tl);
}
