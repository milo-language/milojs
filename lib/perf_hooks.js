// node:perf_hooks. The clock is Date.now based, so resolution is a millisecond
// rather than a fraction of one: a caller timing microseconds sees zeroes rather
// than noise, which is the honest failure of the two.
const START = Date.now();

class PerformanceEntry {
  constructor(name, entryType, startTime, duration) {
    this.name = name;
    this.entryType = entryType;
    this.startTime = startTime;
    this.duration = duration;
  }
  toJSON() {
    return { name: this.name, entryType: this.entryType, startTime: this.startTime, duration: this.duration };
  }
}
class PerformanceMark extends PerformanceEntry {
  constructor(name, startTime) { super(name, 'mark', startTime, 0); }
}
class PerformanceMeasure extends PerformanceEntry {
  constructor(name, startTime, duration) { super(name, 'measure', startTime, duration); }
}

const marks = new Map();
const entries = [];

const performance = {
  timeOrigin: START,
  now() { return Date.now() - START; },
  mark(name, options) {
    const t = options && options.startTime !== undefined ? options.startTime : performance.now();
    const m = new PerformanceMark(String(name), t);
    marks.set(String(name), m);
    entries.push(m);
    return m;
  },
  measure(name, startOrOptions, endMark) {
    let start = 0;
    let end = performance.now();
    // A named mark that was never set is an error rather than a zero: measuring
    // against a mark that does not exist is a bug in the caller, and silently
    // reporting a duration from 0 hides it.
    if (typeof startOrOptions === 'string') {
      const s = marks.get(startOrOptions);
      if (!s) throw new Error('The "' + startOrOptions + '" performance mark has not been set');
      start = s.startTime;
    }
    if (typeof endMark === 'string') {
      const e = marks.get(endMark);
      if (!e) throw new Error('The "' + endMark + '" performance mark has not been set');
      end = e.startTime;
    }
    const m = new PerformanceMeasure(String(name), start, end - start);
    entries.push(m);
    return m;
  },
  clearMarks(name) {
    if (name === undefined) marks.clear();
    else marks.delete(String(name));
  },
  clearMeasures() {},
  getEntries() { return entries.slice(0); },
  getEntriesByName(name, type) {
    return entries.filter((e) => e.name === name && (type === undefined || e.entryType === type));
  },
  getEntriesByType(type) { return entries.filter((e) => e.entryType === type); },
  eventLoopUtilization() { return { idle: 0, active: 0, utilization: 0 }; },
  nodeTiming: { name: 'node', entryType: 'node', startTime: 0, duration: 0 },
  toJSON() { return { timeOrigin: START }; },
};

// No observation is wired up: nothing here emits entries asynchronously, so a
// callback that never fires is the accurate behaviour rather than a fabricated
// one.
class PerformanceObserver {
  constructor(callback) { this._cb = callback; }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
}
PerformanceObserver.supportedEntryTypes = ['mark', 'measure'];

class PerformanceObserverEntryList {
  getEntries() { return []; }
  getEntriesByName() { return []; }
  getEntriesByType() { return []; }
}

module.exports = {
  performance, PerformanceEntry, PerformanceMark, PerformanceMeasure,
  PerformanceObserver, PerformanceObserverEntryList,
  monitorEventLoopDelay() {
    return { enable() {}, disable() {}, reset() {}, min: 0, max: 0, mean: 0, stddev: 0, percentile() { return 0; } };
  },
  createHistogram() {
    return { min: 0, max: 0, mean: 0, stddev: 0, percentile() { return 0; }, record() {}, reset() {} };
  },
  timerify(fn) { return fn; },
  eventLoopUtilization: performance.eventLoopUtilization,
  constants: {},
};
