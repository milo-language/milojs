// ToObject rejects null and undefined, and these answered an empty array: a
// typo that produced undefined read as "an object with no keys" rather than
// throwing where node throws.
const t = (l, f) => { try { console.log(l, JSON.stringify(f())); } catch (e) { console.log(l, e.constructor.name, '|', e.message); } };
t('keys(undefined)', () => Object.keys(undefined));
t('keys(null)', () => Object.keys(null));
t('keys()', () => Object.keys());
t('values(null)', () => Object.values(null));
t('entries(undefined)', () => Object.entries(undefined));
t('getOwnPropertyNames(null)', () => Object.getOwnPropertyNames(null));
t('getOwnPropertySymbols(null)', () => Object.getOwnPropertySymbols(null));
// A primitive is still boxed rather than rejected.
t('keys(1)', () => Object.keys(1));
t('keys("ab")', () => Object.keys('ab'));
t('keys(true)', () => Object.keys(true));
t('getOwnPropertyNames(5)', () => Object.getOwnPropertyNames(5));

// node's exact wording for the most common runtime error there is.
t('read of undefined', () => { let u; return u.x; });
t('read of null', () => { const n = null; return n.foo; });
