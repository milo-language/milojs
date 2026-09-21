// mkdirSync reports the kernel's errno, not a guess: a parent that is a regular
// file is ENOTDIR (not ENOENT), and {recursive:true} throws instead of quietly
// returning. The recursive form returns the first directory it created, or
// undefined when everything already existed. Paths are printed relative to the
// temp root so the output is stable across machines.
const fs = require("fs");
const os = require("os");
const path = require("path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mj-mkdir-"));
const rel = (p) => path.relative(root, p);
function probe(label, fn) {
  try {
    const r = fn();
    console.log(label, "ok", r === undefined ? r : rel(r));
  } catch (e) {
    console.log(label, e.code, e.errno === os.constants.errno[e.code] * -1, e.syscall, rel(e.path),
      JSON.stringify(e.message.replace(root, "<root>")));
  }
}
const file = path.join(root, "file");
fs.writeFileSync(file, "x");
probe("enotdir plain", () => fs.mkdirSync(path.join(file, "sub")));
probe("enotdir recursive", () => fs.mkdirSync(path.join(file, "sub", "deep"), { recursive: true }));
probe("eexist file plain", () => fs.mkdirSync(file));
probe("eexist file recursive", () => fs.mkdirSync(file, { recursive: true }));
probe("enoent plain", () => fs.mkdirSync(path.join(root, "a", "b")));
probe("recursive creates", () => fs.mkdirSync(path.join(root, "a", "b", "c"), { recursive: true }));
probe("recursive partial", () => fs.mkdirSync(path.join(root, "a", "b", "d"), { recursive: true }));
probe("recursive existing", () => fs.mkdirSync(path.join(root, "a", "b", "c"), { recursive: true }));
probe("eexist dir plain", () => fs.mkdirSync(path.join(root, "a")));
fs.mkdir(path.join(file, "cb"), (err) => {
  console.log("callback", err.code, err.syscall, rel(err.path));
  fs.rmSync(root, { recursive: true });
});
