// Web IDL checks the argument COUNT before it does anything else: a missing
// required argument is ERR_MISSING_ARGS, and the name is stringified (a
// conversion that can run user code and throw).
const params = new URLSearchParams('a=1&b=2&a=3');
const t = (l, f) => { try { console.log(l, JSON.stringify(f())); } catch (e) { console.log(l, e.code, '|', e.message); } };
t('get()', () => params.get());
t('getAll()', () => params.getAll());
t('has()', () => params.has());
t('delete()', () => params.delete());
t('append()', () => params.append());
t('append(name only)', () => params.append('a'));
t('set()', () => params.set());
t('get.call(undefined)', () => params.get.call(undefined));
t('get(obj throwing)', () => params.get({ toString() { throw new Error('toString'); } }));
t('get numeric name', () => params.get(1));

const sp = new URLSearchParams('a=1&b=2&a=3');
sp.set('a', 'z');
console.log('set replaces first and drops the rest:', sp.toString());
sp.append('c', 4);
console.log('append stringifies:', sp.toString());
console.log('has(name, value):', sp.has('b', '2'), sp.has('b', '9'));
