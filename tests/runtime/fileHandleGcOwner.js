// A FileHandle's fd has one owner, and close() and the GC race to dispose of it.
// Bun's subprocess-stdin bug is this shape: the GC side closed an fd number the
// explicit side had already closed and the kernel had already handed to someone
// else. So: close h1, reopen until the fd is reused, drop h1, collect, and the
// second file must still read. Then an unclosed handle: node closes its fd on GC
// and reports ERR_INVALID_STATE as an uncaught exception.
const fs = require('fs');
const os = require('os');
const path = require('path');
const gc = globalThis.gc || (require('v8').setFlagsFromString('--expose-gc'), require('vm').runInNewContext('gc'));
const tick = () => new Promise((r) => setImmediate(r));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fhgc-'));
const a = path.join(dir, 'a');
const b = path.join(dir, 'b');
fs.writeFileSync(a, 'aaaa');
fs.writeFileSync(b, 'bbbb');

const uncaught = [];
process.on('uncaughtException', (e) => {
  uncaught.push(e.code + ': ' + e.message.split(' File descriptor')[0]);
});

async function closeThenReuse() {
  // print first: on macOS libuv opens an fd of its own the first time a piped
  // stdout is written, and it would take the number this test wants reused
  console.log('start');
  let h1 = await fs.promises.open(a, 'r');
  const n = h1.fd;
  await h1.close();
  console.log('fd after close:', h1.fd);
  await h1.close();
  console.log('second close resolved');
  const h2 = await fs.promises.open(b, 'r');
  console.log('fd reused:', h2.fd === n);
  h1 = null;
  return h2;
}

async function openAndDrop() {
  const h = await fs.promises.open(a, 'r');
  return h.fd;
}

function fdState(fd) {
  try {
    fs.readSync(fd, Buffer.alloc(1), 0, 1, 0);
    return 'open';
  } catch (e) {
    return e.code;
  }
}

(async () => {
  const h2 = await closeThenReuse();
  for (let i = 0; i < 3; i++) { gc(); await tick(); }
  const buf = Buffer.alloc(4);
  const r = await h2.read(buf, 0, 4, 0);
  console.log('second file still reads:', r.bytesRead, buf.toString());
  await h2.close();

  const fd = await openAndDrop();
  let state = 'open';
  for (let i = 0; i < 20 && state === 'open'; i++) {
    gc();
    await tick();
    state = fdState(fd);
  }
  console.log('dropped handle fd:', state);
  console.log('uncaught:', uncaught);
  fs.rmSync(dir, { recursive: true });
})();
