// node:child_process, on the __spawnSync native.
//
// One honest limitation runs through all of it: the native merges the child's
// stderr into its stdout, because keeping them apart needs two pipes and a
// select loop. So `stderr` reports the same combined text as `stdout` rather
// than pretending to be empty, and a caller that diffs the two will see them
// agree.
var EventEmitter = require('events').EventEmitter;

function toArgs(args) {
  if (args === undefined || args === null) return [];
  if (Array.isArray(args)) return args.map(String);
  return [];
}

function run(command, args) {
  var r = __spawnSync(String(command), toArgs(args));
  var out = r.stdout === undefined ? '' : r.stdout;
  return {
    pid: 0,
    status: r.error ? null : r.status,
    signal: null,
    output: [null, out, out],
    stdout: out,
    stderr: out,
    error: r.error ? new Error('spawnSync ' + command + ' ENOENT') : undefined,
  };
}

function spawnSync(command, args, options) {
  // A single string with arguments in it is a shell command, which is what
  // exec-family callers pass; run it through the shell rather than treating the
  // whole thing as a program name.
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    options = args;
    args = undefined;
  }
  return run(command, args);
}

function execSync(command, options) {
  var r = run('/bin/sh', ['-c', String(command)]);
  if (r.status !== 0) {
    var err = new Error('Command failed: ' + command + '\n' + r.stdout);
    err.status = r.status;
    err.stdout = r.stdout;
    err.stderr = r.stderr;
    throw err;
  }
  return r.stdout;
}

function execFileSync(file, args, options) {
  if (!Array.isArray(args)) { options = args; args = []; }
  var r = run(file, args);
  if (r.status !== 0) {
    var err = new Error('Command failed: ' + file);
    err.status = r.status;
    err.stdout = r.stdout;
    err.stderr = r.stderr;
    throw err;
  }
  return r.stdout;
}

// A finished child presented as an event emitter. The work already happened by
// the time this is built, so the events are emitted on the next tick: a caller
// that attaches handlers after the call still sees them, which is the whole
// contract of the async form.
function ChildProcess(result) {
  EventEmitter.call(this);
  this.pid = result.pid;
  this.exitCode = result.status;
  this.signalCode = null;
  this.killed = false;
  this.stdin = { write: function () { return true; }, end: function () {}, on: function () {} };
  this.stdout = new EventEmitter();
  this.stderr = new EventEmitter();
  this.stdout.setEncoding = function () {};
  this.stderr.setEncoding = function () {};
  this.stdout.pipe = function (d) { return d; };
  this.stderr.pipe = function (d) { return d; };
  var self = this;
  setTimeout(function () {
    if (result.error) { self.emit('error', result.error); return; }
    if (result.stdout.length > 0) self.stdout.emit('data', result.stdout);
    self.stdout.emit('end');
    self.stderr.emit('end');
    self.emit('exit', result.status, null);
    self.emit('close', result.status, null);
  }, 0);
}
ChildProcess.prototype = Object.create(EventEmitter.prototype);
ChildProcess.prototype.constructor = ChildProcess;
ChildProcess.prototype.kill = function () { this.killed = true; return true; };
ChildProcess.prototype.ref = function () { return this; };
ChildProcess.prototype.unref = function () { return this; };
ChildProcess.prototype.disconnect = function () {};
ChildProcess.prototype.send = function () { return false; };

function spawn(command, args, options) {
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    options = args;
    args = undefined;
  }
  return new ChildProcess(run(command, args));
}

function execFile(file, args, options, callback) {
  if (typeof args === 'function') { callback = args; args = []; options = undefined; }
  else if (typeof options === 'function') { callback = options; options = undefined; }
  if (!Array.isArray(args)) args = [];
  var r = run(file, args);
  var child = new ChildProcess(r);
  if (callback) {
    setTimeout(function () {
      if (r.status === 0 && !r.error) callback(null, r.stdout, r.stderr);
      else {
        var err = r.error || new Error('Command failed: ' + file);
        err.code = r.status;
        callback(err, r.stdout, r.stderr);
      }
    }, 0);
  }
  return child;
}

function exec(command, options, callback) {
  if (typeof options === 'function') { callback = options; options = undefined; }
  return execFile('/bin/sh', ['-c', String(command)], options, callback);
}

// fork runs another script under THIS runtime, which is what makes it fork
// rather than spawn. There is no IPC channel, so `send` answers false and a
// caller depending on messages will see that rather than a silent drop.
function fork(modulePath, args, options) {
  return spawn(process.execPath, [String(modulePath)].concat(toArgs(args)), options);
}

exports.spawn = spawn;
exports.spawnSync = spawnSync;
exports.exec = exec;
exports.execSync = execSync;
exports.execFile = execFile;
exports.execFileSync = execFileSync;
exports.fork = fork;
exports.ChildProcess = ChildProcess;
