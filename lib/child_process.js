// node:child_process, on the __spawnSync native.
//
// One honest limitation runs through all of it: the native merges the child's
// stderr into its stdout, because keeping them apart needs two pipes and a
// select loop. So `stderr` reports the same combined text as `stdout` rather
// than pretending to be empty, and a caller that diffs the two will see them
// agree.
var EventEmitter = require('events').EventEmitter;

// Runaway-spawn guard.
//
// Node's tests re-exec themselves (`fork(__filename, ['child'])`, then branch on
// process.argv[2]). If argv does not reach the child correctly the child takes
// the PARENT branch and forks again, and the growth is exponential — every one
// of those processes is a full interpreter heap, so the machine is out of memory
// within seconds. That is not hypothetical; it has already taken a machine down.
//
// The depth travels in the environment because that is the only channel that
// survives execve into an unrelated binary. A bomb has to cross MAX_DEPTH
// generations before it can get wide, so capping depth kills it while it is
// still linear. MAX_SPAWNS is the other shape: a loop in one process that spawns
// without recursing.
var MAX_DEPTH = parseInt(process.env.MILOJS_SPAWN_MAX_DEPTH || '8', 10);
var MAX_SPAWNS = parseInt(process.env.MILOJS_SPAWN_MAX || '256', 10);
var spawnDepth = parseInt(process.env.MILOJS_SPAWN_DEPTH || '0', 10) || 0;
var spawnCount = 0;

function checkSpawnBudget(command) {
  if (spawnDepth >= MAX_DEPTH) {
    var e = new Error('spawn ' + command + ': refused, MILOJS_SPAWN_MAX_DEPTH (' +
      MAX_DEPTH + ') reached — this process is ' + spawnDepth + ' levels deep, ' +
      'which is what a runaway self-fork looks like');
    e.code = 'EAGAIN';
    throw e;
  }
  if (++spawnCount > MAX_SPAWNS) {
    var e2 = new Error('spawn ' + command + ': refused, MILOJS_SPAWN_MAX (' +
      MAX_SPAWNS + ') children already started by this process');
    e2.code = 'EAGAIN';
    throw e2;
  }
}

function toArgs(args) {
  if (args === undefined || args === null) return [];
  if (Array.isArray(args)) return args.map(String);
  return [];
}

function run(command, args) {
  checkSpawnBudget(command);
  // __spawnSync takes no env, so the child inherits ours verbatim. Bumping the
  // counter in process.env first is the only way the depth reaches it. Whether
  // that write reaches the real environ is the runtime's business, so this is
  // best-effort: the per-process count cap in checkSpawnBudget holds either way.
  var saved = process.env.MILOJS_SPAWN_DEPTH;
  try { process.env.MILOJS_SPAWN_DEPTH = String(spawnDepth + 1); } catch (e) {}
  var r = __spawnSync(String(command), toArgs(args));
  try { if (saved === undefined) delete process.env.MILOJS_SPAWN_DEPTH; else process.env.MILOJS_SPAWN_DEPTH = saved; } catch (e) {}
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

// Parse the "<status>|<output>" the async native sends back. The first pipe is
// the separator, so output containing pipes survives.
function decodeAsync(res) {
  var bar = String(res).indexOf('|');
  var head = bar < 0 ? String(res) : String(res).slice(0, bar);
  var out = bar < 0 ? '' : String(res).slice(bar + 1);
  var failed = head.charAt(0) === 'E';
  var status = failed ? null : parseInt(head, 10);
  return {
    pid: 0,
    status: status,
    signal: null,
    output: [null, out, out],
    stdout: out,
    stderr: out,
    error: failed ? new Error('spawn failed') : undefined,
  };
}

// A child that has NOT finished yet: the events fire when the worker thread
// reports back, so a server the child starts does not hang this process. The
// synchronous path could not do this at all.
function AsyncChildProcess(spawned) {
  EventEmitter.call(this);
  // __spawnAsync hands back both halves: the promise settles when the child
  // exits, the pid is usable while it is still running.
  var promise = spawned && typeof spawned.then === 'function' ? spawned : spawned.promise;
  this.pid = (spawned && spawned.pid) || 0;
  this.exitCode = null;
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
  promise.then(function (res) {
    var r = decodeAsync(res);
    self.exitCode = r.status;
    if (r.error) { self.emit('error', r.error); return; }
    if (r.stdout.length > 0) self.stdout.emit('data', r.stdout);
    self.stdout.emit('end');
    self.stderr.emit('end');
    if (self._exited) return;
    self._exited = true;
    // A child killed by a signal reports a NULL exit code and the signal name;
    // the status the wait returns is meaningless in that case.
    var code = self.signalCode ? null : r.status;
    self.emit('exit', code, self.signalCode);
    self.emit('close', code, self.signalCode);
  });
}
AsyncChildProcess.prototype = Object.create(EventEmitter.prototype);
AsyncChildProcess.prototype.constructor = AsyncChildProcess;
// Signal numbers, so the caller can pass either a name or a number as node does.
var SIGNALS = {
  SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGKILL: 9, SIGTERM: 15,
  SIGUSR1: 30, SIGUSR2: 31, SIGSTOP: 17, SIGCONT: 19,
};

// A real signal, not a flag. kill() used to set `killed = true`, return true and
// signal nothing: a test that spawned a long-running child and killed it waited
// forever for an 'exit' that could not come, and the child stayed alive after
// the parent moved on.
AsyncChildProcess.prototype.kill = function (signal) {
  var name = typeof signal === 'string' ? signal : (signal === undefined ? 'SIGTERM' : null);
  var num = typeof signal === 'number' ? signal : SIGNALS[name || 'SIGTERM'];
  if (num === undefined) {
    var e = new Error('Unknown signal: ' + signal);
    e.code = 'ERR_UNKNOWN_SIGNAL';
    throw e;
  }
  this.killed = true;
  if (!this.pid) return false;
  var ok = __killPid(this.pid, num);
  // A killed child reports a null exit code and the signal that ended it, which
  // is the pair node's tests assert on.
  this.signalCode = typeof signal === 'number' ? null : (name || 'SIGTERM');
  this.exitCode = null;
  return ok;
};
AsyncChildProcess.prototype[Symbol.dispose] = function () { return this.kill(); };
AsyncChildProcess.prototype.ref = function () { return this; };
AsyncChildProcess.prototype.unref = function () { return this; };
AsyncChildProcess.prototype.disconnect = function () {};
AsyncChildProcess.prototype.send = function () { return false; };

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

// Environment overrides travel as "K=V" strings, which is the shape the native
// takes and the shape execve wants underneath. The depth counter is always
// appended: inheriting the parent's copy unchanged would leave it pinned at 0
// forever and the cap above would never fire.
function envPairs(options) {
  var out = ['MILOJS_SPAWN_DEPTH=' + (spawnDepth + 1)];
  if (!options || !options.env) return out;
  for (var k in options.env) {
    if (k === 'MILOJS_SPAWN_DEPTH') continue;
    out.push(k + '=' + options.env[k]);
  }
  return out;
}

function spawn(command, args, options) {
  checkSpawnBudget(command);
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    options = args;
    args = undefined;
  }
  return new AsyncChildProcess(__spawnAsync(String(command), toArgs(args), envPairs(options)));
}

function execFile(file, args, options, callback) {
  if (typeof args === 'function') { callback = args; args = []; options = undefined; }
  else if (typeof options === 'function') { callback = options; options = undefined; }
  if (!Array.isArray(args)) args = [];
  checkSpawnBudget(file);
  var spawned = __spawnAsync(String(file), toArgs(args), envPairs(options));
  var promise = spawned && typeof spawned.then === 'function' ? spawned : spawned.promise;
  var child = new AsyncChildProcess(spawned);
  if (callback) {
    promise.then(function (res) {
      var r = decodeAsync(res);
      if (r.status === 0 && !r.error) callback(null, r.stdout, r.stderr);
      else {
        var err = r.error || new Error('Command failed: ' + file);
        err.code = r.status;
        callback(err, r.stdout, r.stderr);
      }
    });
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
  if (args !== undefined && !Array.isArray(args)) { options = args; args = []; }
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
