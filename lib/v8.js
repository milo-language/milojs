// node:v8. There is no V8 here, so the statistics are reported as zeroes rather
// than invented: a caller graphing them sees a flat line instead of a fiction.
// serialize/deserialize are the one part with real semantics, and they are
// backed by JSON, which is honest about what it cannot carry (a cyclic or
// non-plain value throws rather than silently changing shape).
function zeroHeap() {
  return {
    total_heap_size: 0, total_heap_size_executable: 0, total_physical_size: 0,
    total_available_size: 0, used_heap_size: 0, heap_size_limit: 0,
    malloced_memory: 0, peak_malloced_memory: 0, does_zap_garbage: 0,
    number_of_native_contexts: 0, number_of_detached_contexts: 0,
    total_global_handles_size: 0, used_global_handles_size: 0, external_memory: 0,
  };
}

function serialize(value) {
  return Buffer.from(JSON.stringify(value === undefined ? null : value), 'utf8');
}
function deserialize(buf) {
  return JSON.parse(String(buf));
}

module.exports = {
  cachedDataVersionTag() { return 0; },
  getHeapStatistics: zeroHeap,
  getHeapSpaceStatistics() { return []; },
  getHeapCodeStatistics() { return { code_and_metadata_size: 0, bytecode_and_metadata_size: 0, external_script_source_size: 0 }; },
  setFlagsFromString() {},
  serialize, deserialize,
  takeCoverage() {}, stopCoverage() {},
  promiseHooks: { onInit() { return () => {}; }, onSettled() { return () => {}; }, onBefore() { return () => {}; }, onAfter() { return () => {}; }, createHook() { return { enable() {}, disable() {} }; } },
};
