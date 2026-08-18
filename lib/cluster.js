// node:cluster, on the async spawn. A worker is this same script re-run as a
// child process, told which role it has through an environment variable, which
// is how node distinguishes them too.
//
// What is NOT here is the IPC channel. Node gives primary and worker a message
// port and cluster uses it to hand out server handles; there is no such channel
// in this runtime, so `worker.send()` answers false and workers cannot share a
// listening socket. Each worker that listens binds its own port. That is stated
// rather than faked: code that round-trips a message will see the false return
// instead of a message that silently never arrives.
const EventEmitter = require('events').EventEmitter;
const childProcess = require('child_process');

const WORKER_ENV = 'NODE_UNIQUE_ID';

const isWorker = Boolean(process.env && process.env[WORKER_ENV]);
const isPrimary = !isWorker;

let nextId = 1;
const workers = {};

class Worker extends EventEmitter {
  constructor(id, child) {
    super();
    this.id = id;
    this.process = child;
    this.exitedAfterDisconnect = false;
    this.state = 'online';
    const self = this;
    if (child) {
      child.on('exit', function (code, signal) {
        self.state = 'dead';
        delete workers[self.id];
        self.emit('exit', code, signal);
        cluster.emit('exit', self, code, signal);
      });
      child.on('error', function (err) { self.emit('error', err); });
    }
  }
  isDead() { return this.state === 'dead'; }
  isConnected() { return this.state !== 'dead'; }
  // No IPC channel exists, so this reports failure rather than dropping the
  // message silently.
  send() { return false; }
  kill(signal) { this.destroy(signal); }
  destroy(signal) {
    this.state = 'dead';
    if (this.process && this.process.kill) this.process.kill(signal);
  }
  disconnect() {
    this.exitedAfterDisconnect = true;
    this.state = 'disconnected';
    this.emit('disconnect');
    return this;
  }
}

class Cluster extends EventEmitter {
  constructor() {
    super();
    this.isWorker = isWorker;
    this.isPrimary = isPrimary;
    // Node keeps the old spelling as an alias, and plenty of code still reads it.
    this.isMaster = isPrimary;
    this.Worker = Worker;
    this.workers = workers;
    this.settings = { execArgv: [], exec: process.argv[1], args: process.argv.slice(2), silent: false };
    this.SCHED_NONE = 1;
    this.SCHED_RR = 2;
    this.schedulingPolicy = this.SCHED_RR;
  }

  setupPrimary(settings) {
    if (settings) for (const k in settings) this.settings[k] = settings[k];
    this.emit('setup', this.settings);
  }

  fork(env) {
    if (!isPrimary) {
      throw new Error('cluster.fork() can only be called from the primary process');
    }
    const id = nextId++;
    const childEnv = {};
    for (const k in process.env) childEnv[k] = process.env[k];
    if (env) for (const k in env) childEnv[k] = env[k];
    childEnv[WORKER_ENV] = String(id);
    // The worker runs the same entry script. execArgv is accepted and ignored:
    // there are no per-process V8 flags to pass on here.
    const child = childProcess.fork(this.settings.exec, this.settings.args, { env: childEnv });
    const worker = new Worker(id, child);
    workers[id] = worker;
    const self = this;
    setTimeout(function () {
      worker.emit('online');
      self.emit('online', worker);
    }, 0);
    this.emit('fork', worker);
    return worker;
  }

  disconnect(cb) {
    for (const id in workers) workers[id].disconnect();
    if (cb) setTimeout(cb, 0);
  }
}

const cluster = new Cluster();
// The worker's own handle, which node exposes only in a worker process.
cluster.worker = isWorker ? new Worker(Number(process.env[WORKER_ENV]), null) : undefined;

module.exports = cluster;
