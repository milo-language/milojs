// AssertionError.generatedMessage says whether the message was node's or the
// caller's, and `message || fallback` threw that distinction away: every
// generated message reported generatedMessage false.
const assert = require('assert');
// The message TEXT is a separate gap (node quotes the call site source and
// appends a diff), so this pins the flag, the code and the operator.
function grab(fn) {
  try { fn(); } catch (e) { return [e.code, e.generatedMessage, e.operator]; }
  return ['NO THROW'];
}
console.log(JSON.stringify(grab(() => assert.fail())));
console.log(JSON.stringify(grab(() => assert.fail('mine'))));
console.log(JSON.stringify(grab(() => assert.ok(false))));
console.log(JSON.stringify(grab(() => assert.ok(false, 'mine'))));
console.log(JSON.stringify(grab(() => assert.strictEqual(1, 2, 'mine'))));
console.log(JSON.stringify(grab(() => assert.throws(() => {}, Error, 'mine'))));

// An object that merely inherits Date.prototype has no date value. Comparing
// one used to call getTime on it and throw a TypeError out of the assertion.
function FakeDate() {}
FakeDate.prototype = Date.prototype;
const fake = new FakeDate();
const real = new Date('2016');
assert.notDeepEqual(real, fake);
assert.notDeepEqual(fake, real);
assert.deepStrictEqual(fake, new FakeDate());
console.log('fake dates compared without throwing');
