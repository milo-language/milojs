// fs.Stats and fs.Dirent are CONSTRUCTORS in node — its tests reach for
// fs.Stats.prototype and for `stats instanceof fs.Stats`, and readdir's
// withFileTypes answers Dirents. fs.promises.open, writev and readv did not
// exist at all.
const fs = require('fs');
const os = require('os');
const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mjfs-'));
const file = path.join(dir, 'a.txt');
fs.writeFileSync(file, 'hello world');
const st = fs.statSync(file);
console.log('instanceof Stats:', st instanceof fs.Stats, 'isFile:', st.isFile(), 'size:', st.size);
console.log('Stats.prototype:', typeof fs.Stats.prototype.isFile, 'Dirent:', typeof fs.Dirent);
fs.mkdirSync(path.join(dir, 'sub'));
const ents = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1);
console.log(ents.map((e) => e.name + ':' + (e.isDirectory() ? 'dir' : e.isFile() ? 'file' : '?')).join(','));
console.log('parentPath ok:', ents[0].parentPath === dir, ents[0] instanceof fs.Dirent);
const fd = fs.openSync(file, 'r+');
console.log('writev:', fs.writevSync(fd, [Buffer.from('AB'), Buffer.from('CD')], 0));
fs.closeSync(fd);
console.log('after writev:', fs.readFileSync(file, 'utf8'));
(async () => {
  const h = await fs.promises.open(file, 'r');
  const buf = Buffer.alloc(5);
  const r = await h.read(buf, 0, 5, 0);
  console.log('handle read:', r.bytesRead, JSON.stringify(buf.toString()));
  console.log('handle stat size:', (await h.stat()).size);
  await h.close();
  console.log('promises.readFile:', await fs.promises.readFile(file, 'utf8'));
  fs.rmSync(dir, { recursive: true, force: true });
})();
