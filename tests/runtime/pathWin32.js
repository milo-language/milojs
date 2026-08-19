// path.win32. It was undefined, and node's path tests exercise BOTH variants in
// one file, so eleven of them died on their first line without testing
// anything. Aliasing it to posix would have been worse than the absence: the
// tests would then compare posix answers against win32 expectations.
//
// Written separately rather than parameterised on a separator, because the
// differences are structural: two separators are legal, a path can be rooted on
// a DRIVE, "C:foo" is relative to that drive's own directory while "C:\\foo" is
// absolute, and "\\\\server\\share" is a third kind of root again.
const w = require("path").win32;
const cases = [
  ["join a b", () => w.join("a", "b")],
  ["join C:\\ foo", () => w.join("C:\\", "foo")],
  ["join UNC", () => w.join("\\\\server\\share", "a", "b")],
  ["join ..", () => w.join("C:\\a\\b", "..", "c")],
  ["normalize slashes", () => w.normalize("C:/a//b/../c/")],
  ["normalize rel", () => w.normalize("a/b/../c")],
  ["normalize dotdot rel", () => w.normalize("../../a")],
  ["isAbsolute C:\\", () => w.isAbsolute("C:\\foo")],
  ["isAbsolute C:foo", () => w.isAbsolute("C:foo")],
  ["isAbsolute \\foo", () => w.isAbsolute("\\foo")],
  ["isAbsolute UNC", () => w.isAbsolute("\\\\s\\sh\\a")],
  ["isAbsolute rel", () => w.isAbsolute("a\\b")],
  ["resolve C:\\a b", () => w.resolve("C:\\a", "b")],
  ["resolve abs override", () => w.resolve("C:\\a", "D:\\b")],
  ["resolve rooted", () => w.resolve("C:\\a\\b", "\\c")],
  ["dirname C:\\a\\b", () => w.dirname("C:\\a\\b")],
  ["dirname C:\\", () => w.dirname("C:\\")],
  ["dirname UNC", () => w.dirname("\\\\s\\sh\\a\\b")],
  ["basename", () => w.basename("C:\\a\\b.txt")],
  ["basename ext", () => w.basename("C:\\a\\b.txt", ".txt")],
  ["extname", () => w.extname("C:\\a\\b.tar.gz")],
  ["relative same drive", () => w.relative("C:\\a\\b", "C:\\a\\c\\d")],
  ["relative diff drive", () => w.relative("C:\\a", "D:\\b")],
  ["relative case", () => w.relative("c:\\A\\b", "C:\\a\\c")],
  ["parse", () => JSON.stringify(w.parse("C:\\a\\b.txt"))],
  ["parse UNC", () => JSON.stringify(w.parse("\\\\s\\sh\\a.txt"))],
  ["format", () => w.format({ root: "C:\\", dir: "C:\\a", base: "b.txt" })],
  ["toNamespacedPath", () => w.toNamespacedPath("C:\\a\\b")],
  ["sep/delim", () => w.sep + " " + w.delimiter],
  ["posix roundtrip", () => w.posix.join("a", "b")],
];
for (const [l, fn] of cases) { try { console.log(l.padEnd(22), JSON.stringify(fn())); } catch (e) { console.log(l.padEnd(22), "THREW", e.code || e.message); } }
