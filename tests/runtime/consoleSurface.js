// Eleven console methods were missing, and each was a TypeError that killed the
// program rather than a degraded log line. console.assert is the first line of
// html-escaper's own test suite, which is where this was found.
//
// Two engine bugs had to be fixed first:
//   - console.log could not be OVERRIDDEN: the call site's fast path fired on
//     the name, so `console.log = fn` was silently ignored. Monkey-patching
//     console is how loggers, test harnesses and output capture all work.
//   - console.error and console.warn wrote to STDOUT, so any program with a
//     piped stdout got its diagnostics mixed into its data.
const names = ["log", "error", "warn", "info", "debug", "trace", "dir", "assert", "table",
  "group", "groupEnd", "groupCollapsed", "time", "timeEnd", "timeLog", "count",
  "countReset", "clear"];
console.log("missing:", names.filter(n => typeof console[n] !== "function").join(" ") || "(none)");

console.assert(true, "not printed");
console.count("hits");
console.count("hits");
console.countReset("hits");
console.count("hits");

console.group("outer");
console.log("indented once");
console.group();
console.log("indented twice");
console.groupEnd();
console.log("back to one");
console.groupEnd();
console.log("back to zero");

// override works, and restores
const orig = console.log;
const seen = [];
console.log = function () { seen.push(Array.prototype.join.call(arguments, " ")); };
console.log("captured", 1);
console.log = orig;
console.log("capture saw:", JSON.stringify(seen));

console.clear();
console.log("clear is a no-op that returns");
