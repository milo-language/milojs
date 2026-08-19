// path corners node's own suite checks and this runtime got wrong: resolve()
// falling through zero-length arguments to the cwd, matchesGlob, the ".."
// extname special case, the UNC device in win32.resolve, and the identity of
// the path/posix and path/win32 specifiers.
const path = require('path');

console.log(path.resolve('') === process.cwd(), path.resolve('', '') === process.cwd());
console.log(path.relative('', process.cwd()), '|', path.relative(process.cwd(), ''), '|');

console.log(path.matchesGlob('foo/bar/baz', 'foo/[bcr]ar/baz'));
console.log(path.matchesGlob('foo/bar/baz', 'foo/[!bcr]ar/baz'));
console.log(path.matchesGlob('foo/bar/baz', 'foo/**'));
console.log(path.matchesGlob('foo/bar/baz', '*'));
console.log(path.win32.matchesGlob('foo\\bar\\baz', 'foo\\[bc-r]ar\\baz'));
console.log(path.win32.matchesGlob('foo\\bar\\baz', 'foo/**'));

console.log(JSON.stringify(['..', '...', '.a', '..a', 'a.'].map((s) => path.extname(s))));
console.log(JSON.stringify(['..', '...', '.a'].map((s) => path.win32.extname(s))));

console.log(path.win32.resolve('//server/share', '..', 'relative\\'));
console.log(path.win32.resolve('//server//share', 'x'));
console.log(JSON.stringify(path.win32.normalize('C:')));

console.log(require('path/posix') === path.posix, require('path/win32') === path.win32);
