// _readableState / _writableState. node's own tests read these internals
// directly, and 16 of the stream area's failures were nothing but "cannot read
// property 'x' of undefined" against one of them. They are live views over the
// fields this implementation actually maintains, so a field it does not track
// is absent rather than invented.
//
// Also here because getting the view right forced them: cork/uncork used to be
// no-ops, flowing started false where node starts null, and 'finish' was
// emitted inline so a caller could see a finished stream before the tick that
// finished it.
const { Readable, Writable, PassThrough } = require("stream");
const r = new Readable({ read() {}, objectMode: true, highWaterMark: 5 });
console.log("r objectMode:", r._readableState.objectMode, "hwm:", r._readableState.highWaterMark);
console.log("r flowing:", r._readableState.flowing, "ended:", r._readableState.ended);
r.setEncoding("utf8");
console.log("r encoding:", r._readableState.encoding);
console.log("readableListening:", r._readableState.readableListening);
r.on("readable", () => {});
console.log("readableListening after:", r._readableState.readableListening);

const w = new Writable({ write(c, e, cb) { cb(); } });
console.log("w ending:", w._writableState.ending, "ended:", w._writableState.ended, "finished:", w._writableState.finished);
w.cork();
console.log("corked:", w._writableState.corked);
console.log("write returned:", w.write("a"), "buffered:", w._writableState.bufferedRequestCount);
w.write("b");
console.log("buffered after 2:", w._writableState.bufferedRequestCount, "needDrain:", w._writableState.needDrain);
w.uncork();
console.log("after uncork corked:", w._writableState.corked, "buffered:", w._writableState.bufferedRequestCount);
w.end();
console.log("w ended:", w._writableState.ended, "finished:", w._writableState.finished);

const src = new PassThrough(), d1 = new PassThrough(), d2 = new PassThrough();
src.pipe(d1); src.pipe(d2);
console.log("pipes:", src._readableState.pipes.length);
src.unpipe(d1);
console.log("pipes after unpipe:", src._readableState.pipes.length);
