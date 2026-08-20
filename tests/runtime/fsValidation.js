// The argument checks node's fs tests assert directly: the encoding is reported
// as 'encoding' however it was passed, a control character is escaped in the
// message rather than emitted raw, an invalid option field is a PROPERTY error,
// and fs.exists rejects a callback that is not one. lchmod/lchown simply did
// not exist.
const fs = require('fs');
const NUL = String.fromCharCode(0);
const t = (l, f) => { try { f(); console.log(l, 'NO THROW'); } catch (e) { console.log(l, e.code, '|', String(e.message).slice(0, 96)); } };
t('bad encoding string', () => fs.readFileSync('/etc/hosts', 'foo'));
t('bad encoding option', () => fs.readFileSync('/etc/hosts', { encoding: 'foo' }));
t('null byte in path', () => fs.statSync('foo' + NUL + 'bar'));
t('exists non-function cb', () => fs.exists('/tmp', 'nope'));
t('mkdir bad mode', () => fs.mkdirSync('/tmp/mjx', { mode: 'zz' }));
// (lchmod/lchown argument checks are not asserted here: node opens the path
// first, so on a symlinked /tmp it answers EPERM before it ever looks at them.)
// fs.lchmod exists only where O_SYMLINK does, which is darwin and not linux, so
// its typeof is a PLATFORM fact and cannot be pinned into a single .expected —
// doing that made this fixture unpassable on CI and took the whole suite with
// it. Assert the rule node applies instead of one platform's answer to it.
console.log('lchmod follows O_SYMLINK:',
  (typeof fs.lchmod === 'function') === (fs.constants.O_SYMLINK !== undefined));
console.log('lchown/promises:', typeof fs.lchownSync, typeof fs.promises.lchown);
// parseInt stops at the first character it cannot use, so a partly-octal mode
// string parsed to its prefix and the file was chmod'd to a mode nobody asked
// for. The path does not exist, so a mode that WAS accepted surfaces as ENOENT.
t('chmod partial octal', () => fs.chmodSync('/tmp/mj-no-such-path', '755x'));
t('chmod octal string', () => fs.chmodSync('/tmp/mj-no-such-path', '755'));
