// Minimal worker_threads: this runtime has no worker threads, so it is always
// the main thread and there is no port or worker data. Present because a great
// deal of real code, node's own test harness included, opens with
// `const { isMainThread } = require('worker_threads')` and fails the whole
// module without it. Worker itself throws rather than pretending to spawn.
const isMainThread = true;
const threadId = 0;
const parentPort = null;
const workerData = null;
const resourceLimits = {};

class Worker {
  constructor() {
    throw new Error("worker_threads.Worker is not supported by this runtime");
  }
}

function markAsUntransferable() {}
function moveMessagePortToContext() {
  throw new Error("worker_threads.moveMessagePortToContext is not supported by this runtime");
}
function receiveMessageOnPort() {
  return undefined;
}
function setEnvironmentData() {}
function getEnvironmentData() {
  return undefined;
}

module.exports = {
  isMainThread, threadId, parentPort, workerData, resourceLimits, Worker,
  markAsUntransferable, moveMessagePortToContext, receiveMessageOnPort,
  setEnvironmentData, getEnvironmentData,
};
