// Two defects that looked like one. An error handed to a write callback is how a
// _write implementation reports failure: node turns it into an 'error' event on
// the stream. milojs passed it to the caller's callback and stopped, so anything
// waiting on 'error' waited forever — one of the shapes behind 163 hanging
// node-compat cases.
//
// The async half of the same test failed for an unrelated reason:
// process.nextTick dropped its trailing arguments, so `nextTick(cb, err)`
// delivered undefined and the error disappeared before the stream ever saw it.
// setTimeout and setImmediate forwarded theirs, which is what made this look
// like a stream bug rather than a nextTick one.
const { Writable } = require('stream');

// Collected, not printed as they fire: node's own ordering between setTimeout(0)
// and setImmediate in the main module is documented as nondeterministic, so
// asserting it would make this fixture flaky against node itself.
const argsSeen = {};
process.nextTick((a, b) => { argsSeen.nextTick = [a, b]; }, 1, 'two');
setImmediate((a) => { argsSeen.setImmediate = a; }, 42);
setTimeout((a) => { argsSeen.setTimeout = a; }, 0, 7);

let syncCb = false, syncErr = false;
const wSync = new Writable({ write: (buf, enc, cb) => { cb(new Error('boom')); } });
wSync.on('error', () => { syncErr = true; });
wSync.write('hi', () => { syncCb = true; });

let asyncCb = false, asyncErr = false;
const wAsync = new Writable({ write: (buf, enc, cb) => { process.nextTick(cb, new Error('boom')); } });
wAsync.on('error', () => { asyncErr = true; });
wAsync.write('hi', () => { asyncCb = true; });

setTimeout(() => {
  console.log('--- callback arguments');
  console.log('nextTick:', argsSeen.nextTick[0], argsSeen.nextTick[1]);
  console.log('setImmediate:', argsSeen.setImmediate, 'setTimeout:', argsSeen.setTimeout);
  console.log('--- write errors');
  console.log('sync  cb', syncCb, 'error', syncErr);
  console.log('async cb', asyncCb, 'error', asyncErr);
}, 150);
