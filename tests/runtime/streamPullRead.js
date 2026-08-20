// A Readable fills ON DEMAND: the stream asks the producer for data by calling
// _read, and the producer answers with push() — synchronously or several ticks
// later. milojs stored options.read and never called it, so a stream of this
// shape (the one every node example uses) emitted nothing at all and the program
// waited forever for data nobody had requested.
const { Readable } = require('stream');

let ticks = 3;
let got = 0;
const rs = new Readable({
  objectMode: true,
  read: () => {
    if (ticks-- > 0) return process.nextTick(() => rs.push({ n: ticks }));
    rs.push({ last: true });
    rs.push(null);
  },
});
rs.on('data', () => { got++; });
let asyncEnded = false;
rs.on('end', () => { asyncEnded = true; });

// A synchronous producer must not be treated differently.
let syncGot = 0;
let left = 3;
const sync = new Readable({
  objectMode: true,
  read: () => { left-- > 0 ? sync.push({}) : sync.push(null); },
});
sync.on('data', () => { syncGot++; });
let syncEnded = false;
sync.on('end', () => { syncEnded = true; });

// One line, printed after both streams have finished: the relative ORDER of the
// two 'end' events differs from node today, and this fixture is about whether
// the producer is asked for data at all, not about that.
setTimeout(() => {
  console.log('async got', got, 'ended', asyncEnded);
  console.log('sync got', syncGot, 'ended', syncEnded);
}, 200);
