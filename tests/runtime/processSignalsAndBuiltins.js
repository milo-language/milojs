// process.kill did not exist at all, so nothing here could signal a process it
// had not spawned — including node's own tests, which kill themselves to check a
// signal handler. Signal 0 is the existence probe: it delivers nothing, so a
// fixture can call it on its own pid and stay deterministic.
console.log('kill:', typeof process.kill);
console.log('self probe:', process.kill(process.pid, 0));
const t = (l, f) => { try { f(); console.log(l, 'NO THROW'); } catch (e) { console.log(l, e.code, '|', e.message); } };
t('unknown signal name', () => process.kill(process.pid, 'SIGNOPE'));
// An object is reported as an unknown SIGNAL, not a bad type, and it is
// inspected rather than stringified.
t('object signal', () => process.kill(process.pid, {}));
t('non-integer pid', () => process.kill('x', 0));
t('no such pid', () => process.kill(0x7ffffffe, 0));
// getBuiltinModule answers undefined for a module this runtime does not have;
// the point of the API is to ask without a try/catch.
console.log('builtin:', typeof process.getBuiltinModule('fs'), process.getBuiltinModule('no_such_builtin'));
console.log('capture:', process.hasUncaughtExceptionCaptureCallback());
process.setUncaughtExceptionCaptureCallback(() => {});
console.log('capture:', process.hasUncaughtExceptionCaptureCallback());
process.setUncaughtExceptionCaptureCallback(null);
console.log('capture:', process.hasUncaughtExceptionCaptureCallback());
t('capture bad arg', () => process.setUncaughtExceptionCaptureCallback(5));
