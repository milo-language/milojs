// Node compatibility sweep for the milojs RUNTIME — a citeable Node number.
//
// Runs Node's own test/parallel suite against `milojs`, using Node's real test
// harness (test/common), so the oracle is node's tests rather than anything
// written here. A test passes when it exits 0, which is exactly what node's own
// runner checks.
//
//   NODE_TESTS=~/git/node/test MILOJS_RUNTIME=.dev/mj-runtime bun scripts/node-compat-sweep.ts --sample 600
//   ... --dir path                  # only test-path-*.js
//   ... --json other.json --fails f.jsonl
//
// The same harness runs any node-compatible binary, which is the point: pass
// MILOJS_RUNTIME=$(which bun) to score bun on the identical sample and get a
// peer number measured the same way rather than a quoted one.
//
// This measures the RUNTIME (module loader, event loop, host bindings), which
// is a different thing from test262: that measures the ENGINE, the language
// itself. A high score on one says nothing about the other.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, writeSync, rmSync } from "fs";
import { execFileSync, spawn } from "child_process";
import { join, resolve, isAbsolute } from "path";
import { homedir } from "node:os";
import os from "node:os";

const tilde = (x: string) => (x.startsWith(homedir()) ? "~" + x.slice(homedir().length) : x);

const NODE_TESTS = process.env.NODE_TESTS ?? join(homedir(), "git/node/test");
// Resolved to an absolute path up front: each test runs with cwd set to node's
// parallel/ directory (that is how `require("../common")` finds the harness), so
// a relative runtime path would be looked up against the wrong directory and
// every case would fail as ENOENT rather than for any reason worth reading.
const RUNTIME_RAW = process.env.MILOJS_RUNTIME ?? ".dev/mj-runtime";
const RUNTIME = RUNTIME_RAW.includes("/") ? resolve(RUNTIME_RAW) : RUNTIME_RAW;
const PARALLEL = join(NODE_TESTS, "parallel");

if (!existsSync(PARALLEL)) {
  console.error(`node-compat-sweep: no node test suite at ${PARALLEL}\n` +
    `  clone nodejs/node and point NODE_TESTS at its test/ directory.`);
  process.exit(2);
}
if (RUNTIME.includes("/") && !existsSync(RUNTIME)) {
  console.error(`node-compat-sweep: runtime not found at ${RUNTIME}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const arg = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const verbose = argv.includes("-v");
const sampleN = arg("--sample") ? parseInt(arg("--sample")!) : null;
const subDir = arg("--dir") ?? "";
const timeoutMs = arg("--timeout") ? parseInt(arg("--timeout")!) : 10_000;
// Each case is a separate process that mostly waits, and ~7% of them hang until
// the timeout kills them, so a serial run spends most of its wall clock asleep:
// 400 cases took about eight minutes, four and a half of which were the hangs.
// Running them concurrently makes the hangs overlap instead of queue.
//
// The cap is MEMORY, not CPU, and the unit that matters is the JOB, not the
// process: a measured 400-case run at 8 jobs peaked at 83 processes and 9.5 GB,
// because a single case spawns children of its own. That is ~1.2 GB per job,
// and 9.5 of 16 GB is close enough to the edge that the machine, not the sweep,
// decides how the run ends. Derive the default from what this machine has and
// leave half of it alone.
const MB_PER_JOB = 1200;
const totalMb = os.totalmem() / 1024 / 1024;
const memJobs = Math.max(2, Math.floor((totalMb * 0.5) / MB_PER_JOB));
const jobs = arg("--jobs") ? parseInt(arg("--jobs")!) : Math.min(8, memJobs);
// A --dir or --sample run is a DIAGNOSTIC, not the published number: the same
// rule the test262 sweep follows, and for the same reason. Only a whole-suite
// run may write the committed report. --sample belongs here as much as --dir:
// a 400-case sample scores 51.7% where the full 3373 score 48.7%, and it used
// to overwrite the committed report with that number, so gen-facts published a
// sample as the suite.
const isCanonical = !subDir && sampleN === null;
const jsonPath = arg("--json") ?? (isCanonical ? "docs/conformance/node-compat.json" : ".dev/node-compat-partial.json");
const failsPath = arg("--fails");
// --leaks names the cases that leave processes behind. A sweep that slowly eats
// the machine is otherwise a whole-run symptom with no per-case attribution:
// bisecting it by area costs hours and, when several areas are individually
// clean, says nothing. Each case runs in its own process group, so "what is
// still in that group after the case's own process exited" is exactly the set
// it leaked, and it is one ps away.
const trackLeaks = argv.includes("--leaks");
const leaked: Array<{ file: string; n: number }> = [];
// The per-case ceiling on live processes. This is the defence that matters:
// tools/guard.sh only sees the whole run, so by the time it fires the machine
// is already at 10 GB and swapping, and the run dies with no attribution. A
// case that spawns past this cap is killed alone, named in the report, and the
// other 3372 cases keep going. jobs * MAX_GROUP is the true process ceiling.
const MAX_GROUP = arg("--max-group") ? parseInt(arg("--max-group")!) : 24;
// The same defence as MAX_GROUP, for the other resource. A case does not have to
// fork to take the machine down: one that allocates without bound reaches the
// watchdog's whole-run memory limit on its own, and the run dies at case 2200
// of 3373 with no attribution and no report. Killing the one case that did it
// costs one test instead of the other 1173.
const MAX_GROUP_MB = arg("--max-group-mb") ? parseInt(arg("--max-group-mb")!) : 1500;
// Diagnostics go to fd 2 with writeSync, not console.log: a run wide enough to
// be worth diagnosing is a run something SIGKILLs, and SIGKILL drops whatever
// is sitting in stdout's buffer. Two earlier runs lost their whole leak table
// exactly that way.
const diag = (m: string) => { try { writeSync(2, m + "\n"); } catch {} };
type Live = { file: string; bomb: (n: number) => void; hog: (mb: number) => void };
const runningPgid = new Map<number, Live>();
const widest = new Map<string, number>();
const heaviest = new Map<string, number>();

// The group leader is excluded: it is the case's own process, which has just
// exited and may still be sitting in the table as a zombie. Counting it would
// report every single case as a leaker.
function survivorsInGroup(pgid: number): number {
  try {
    const out = execFileSync("ps", ["-A", "-o", "pid=,pgid="], { encoding: "utf-8" });
    let n = 0;
    for (const line of out.split("\n")) {
      const m = line.trim().split(/\s+/);
      if (m.length < 2) continue;
      if (parseInt(m[1], 10) === pgid && parseInt(m[0], 10) !== pgid) n++;
    }
    return n;
  } catch { return 0; }
}

function gitRev(dir: string): string {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
  } catch { return "unknown"; }
}
function gitDirty(dir: string): boolean {
  try {
    return execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf-8" }).trim().length > 0;
  } catch { return true; }
}

// 606 of node's 3979 parallel tests are unwinnable by anything that is not node
// itself, and counting them scores every other runtime against a denominator it
// cannot reach:
//
//   - `// Flags: --expose-internals` and friends. Node's official runner reads
//     that comment and re-execs with those flags; this harness does not, and
//     most of them expose node-private state anyway.
//   - `require("internal/...")` reaches into node's own module tree, which is
//     not API and not implementable by a third party.
//
// Excluding them is not grading on a curve: node still scores highest on what
// remains, and the number finally means "of the tests a Node-compatible runtime
// could pass". --all keeps them, for measuring node against itself.
const keepAll = argv.includes("--all");
const NODE_ONLY = /^\/\/ Flags:|require\(['"]internal\//m;
let files = readdirSync(PARALLEL).filter((f) => f.startsWith("test-") && f.endsWith(".js"));
const before = files.length;
if (!keepAll) {
  files = files.filter((f) => {
    try {
      return !NODE_ONLY.test(readFileSync(join(PARALLEL, f), "utf8"));
    } catch { return true; }
  });
}
const excluded = before - files.length;
if (subDir) files = files.filter((f) => f.startsWith(`test-${subDir}`));
files.sort();

// A seeded sample, so the same N is comparable across runs and across runtimes.
const SEED = 0x5eed17;
function sample(list: string[], n: number): string[] {
  let s = SEED;
  const a = list.slice(0);
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a.slice(0, n).sort();
}
const selected = sampleN ? sample(files, sampleN) : files;

// The area a test belongs to: test-http-server-foo.js is "http". Node names its
// tests this way and it is the only grouping the filenames carry.
const areaOf = (f: string) => {
  const m = /^test-([a-z0-9]+)/.exec(f);
  return m ? m[1] : "other";
};

type Row = { file: string; ok: boolean; why: string };
let done = 0;

// Node's harness asserts that no unexpected globals exist, which fails EVERY
// test on any runtime that adds its own (bun exposes Bun, HTMLRewriter and ~40
// more). That is a property of the runtime's global surface, not of the
// behaviour each test checks, and leaving it on scored bun at 7.5% while milojs,
// which happens to add fewer globals, slipped through. Node supports switching
// it off; without that the comparison measures the wrong thing.
const CHILD_ENV = { ...process.env, NODE_TEST_DIR: NODE_TESTS, NODE_TEST_KNOWN_GLOBALS: "0" };

// Every test that touches the filesystem calls tmpdir.refresh(), and node names
// that directory `.tmp.${TEST_SERIAL_ID ?? TEST_THREAD_ID ?? 0}`. Unset, all of
// them share `.tmp.0`, so concurrent tests rm -rf and recreate the SAME
// directory underneath each other and the losers fail on a temp file that
// vanished mid-test.
//
// Keyed per TEST, not per worker slot. Per-slot still shares a directory
// between every case that slot runs, and a case whose orphaned grandchild
// escaped the process-group kill keeps writing into it — the next case on that
// slot then fails refresh() with EEXIST, which is exactly what 37 of the 38
// mkdir failures were. A unique id per case cannot collide with anything.
// Per-directory try/catch, not one around the loop: a single undeletable temp
// directory used to abort the whole sweep and leave every later one behind,
// silently, because the catch was outside the loop and empty. Failures are
// counted and reported rather than swallowed — a cleanup that quietly does
// nothing is how the previous run's debris fails the next run's cases.
function clearTempDirs(label: string) {
  let removed = 0;
  const failed: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(NODE_TESTS); } catch (e) {
    diag(`  temp cleanup (${label}): cannot read ${NODE_TESTS}: ${e}`);
    return;
  }
  for (const d of entries) {
    if (!d.startsWith(".tmp.")) continue;
    try { rmSync(join(NODE_TESTS, d), { recursive: true, force: true }); removed++; }
    catch (e) { failed.push(`${d} (${(e as Error).message})`); }
  }
  if (failed.length) {
    diag(`  temp cleanup (${label}): removed ${removed}, FAILED ${failed.length}: ${failed.slice(0, 3).join(", ")}`);
  }
}

function envForTest(index: number): NodeJS.ProcessEnv {
  return { ...CHILD_ENV, TEST_THREAD_ID: String(index), TEST_SERIAL_ID: String(index) };
}

// Each case runs DETACHED, in its own process group, and the timeout kills the
// group rather than the pid. Node's tests spawn children (`fork(__filename)` is
// how half of test-child-process-* works), and a plain execFile timeout signals
// only the process it started: the grandchildren survive, keep running, and if
// the runtime under test has a spawn bug they keep multiplying. That is how this
// sweep took a machine down. Run it under tools/guard.sh as well; this is the
// inner half of the same defence.
function runOne(f: string, index: number): Promise<Row> {
  return new Promise((resolve) => {
    const child = spawn(RUNTIME, [join(PARALLEL, f)], {
      cwd: PARALLEL,
      env: envForTest(index),
      detached: true,
      // All three piped, then stdin closed immediately: this is what execFile
      // does, and matching it matters. Handing the child no stdin at all
      // (stdio "ignore") changes what node's tests observe about process.stdin
      // and moved the score by 25 cases with no runtime change behind it.
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.end();
    let stderr = "";
    let timedOut = false;
    let settled = false;
    // Bounded: a test that loops on output would otherwise buffer until this
    // process is the one that runs the machine out of memory.
    const cap = 1 << 16;
    child.stdout.on("data", () => {});
    child.stderr.on("data", (d) => { if (stderr.length < cap) stderr += String(d); });

    const killGroup = (sig: NodeJS.Signals) => {
      try { process.kill(-child.pid!, sig); } catch { try { child.kill(sig); } catch {} }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      // A runtime wedged in a native call ignores SIGTERM; SIGKILL is not
      // optional here, it is the whole point.
      setTimeout(() => killGroup("SIGKILL"), 2_000).unref();
    }, timeoutMs);

    // detached:true made child.pid the process-group id, so the group is
    // exactly this case's tree and killing it cannot touch a sibling case.
    if (child.pid) runningPgid.set(child.pid, {
      file: f,
      bomb: (n) => {
        diag(`  FORKBOMB ${n} proc(s) in ${f} - killing group`);
        killGroup("SIGKILL");
        finish({ file: f, ok: false, why: `forkbomb: ${n} processes` });
      },
      hog: (mb) => {
        diag(`  MEMHOG ${mb} MB in ${f} - killing group`);
        killGroup("SIGKILL");
        finish({ file: f, ok: false, why: `memory: ${mb} MB` });
      },
    });

    const finish = (row: Row) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Counted BEFORE the reap, or there is nothing left to count.
      if (child.pid) runningPgid.delete(child.pid);
      if (trackLeaks && child.pid) {
        const n = survivorsInGroup(child.pid);
        if (n > 0) {
          leaked.push({ file: f, n });
          // Printed as it happens, not summarised at the end: a run that leaks
          // badly enough to be worth diagnosing is a run the watchdog kills
          // before any summary executes. The first attempt lost the whole table
          // that way.
          diag(`  LEAK ${n} proc(s) after ${f}`);
        }
      }
      killGroup("SIGKILL");   // reap anything the test left behind, pass or fail
      done++;
      if (done % 100 === 0) process.stdout.write(`  ${done}/${selected.length}`);
      resolve(row);
    };

    child.on("error", (e: any) => finish({ file: f, ok: false, why: String(e.message).slice(0, 200) }));
    child.on("close", (code, signal) => {
      if (timedOut) { finish({ file: f, ok: false, why: "timeout" }); return; }
      if (code === 0) { finish({ file: f, ok: true, why: "" }); return; }
      const err = stderr.trim();
      const why = err.split("\n").filter((l) => l.trim().length > 0).slice(0, 1).join(" ").slice(0, 200)
        || (signal ? `signal ${signal}` : `exit ${code}`);
      finish({ file: f, ok: false, why });
    });
  });
}

// One ps per second for the whole run, rather than per-case polling: the same
// single snapshot answers "how wide is every running case right now", which is
// 400x cheaper than asking each case separately.
const widthSampler = setInterval(() => {
  let out = "";
  // rss comes back in KiB, summed per process group: a case's cost is its whole
  // tree, not just the process this sweep started.
  try { out = execFileSync("ps", ["-A", "-o", "pgid=,rss="], { encoding: "utf-8" }); } catch { return; }
  const counts = new Map<number, number>();
  const rssKb = new Map<number, number>();
  for (const line of out.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const g = parseInt(parts[0], 10);
    const r = parseInt(parts[1], 10);
    if (isNaN(g)) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
    if (!isNaN(r)) rssKb.set(g, (rssKb.get(g) ?? 0) + r);
  }
  for (const [pgid, live] of runningPgid) {
    const n = counts.get(pgid) ?? 0;
    const mb = Math.round((rssKb.get(pgid) ?? 0) / 1024);
    if (n > (widest.get(live.file) ?? 0)) widest.set(live.file, n);
    if (mb > (heaviest.get(live.file) ?? 0)) heaviest.set(live.file, mb);
    if (n > MAX_GROUP) { runningPgid.delete(pgid); live.bomb(n); continue; }
    if (mb > MAX_GROUP_MB) { runningPgid.delete(pgid); live.hog(mb); }
  }
}, 1000);
widthSampler.unref?.();

// A fixed pool rather than one promise per case: 3979 concurrent processes would
// thrash, and the servers these tests start would collide on ports.
// Cleared BEFORE the run, not only after: a sweep that is killed (the watchdog,
// a ^C) leaves its temp directories behind, and case N of the next run would
// then find `.tmp.N` already populated and fail refresh() with EEXIST through no
// fault of the runtime. Cleaning up on the way out is not enough on its own,
// because the runs that fail to clean up are exactly the ones that crashed.
clearTempDirs("before");

const rows: Row[] = new Array(selected.length);
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= selected.length) return;
    rows[i] = await runOne(selected[i], i);
  }
}
await Promise.all(Array.from({ length: Math.max(1, jobs) }, () => worker()));

// Swept again at the end so a normal run leaves the tree clean.
clearTempDirs("after");
process.stdout.write("\n");

const pass = rows.filter((r) => r.ok).length;
const fail = rows.length - pass;
const pct = rows.length ? ((pass / rows.length) * 100).toFixed(1) : "0.0";

// Per area, so the report says WHERE the runtime stands rather than only how
// far: "fs 60%, http 20%" is actionable in a way one number is not.
const areas = new Map<string, { pass: number; total: number }>();
for (const r of rows) {
  const a = areaOf(r.file);
  const e = areas.get(a) ?? { pass: 0, total: 0 };
  e.total++;
  if (r.ok) e.pass++;
  areas.set(a, e);
}
const areaRows = [...areas].map(([area, v]) => ({ area, pass: v.pass, fail: v.total - v.pass, total: v.total }))
  .sort((a, b) => b.fail - a.fail);

const buckets = new Map<string, number>();
for (const r of rows) {
  if (r.ok) continue;
  const key = r.why.replace(/\/[^ ]*\//g, "").replace(/[0-9]+/g, "N").slice(0, 90);
  buckets.set(key, (buckets.get(key) ?? 0) + 1);
}

clearInterval(widthSampler);
{
  const wide = [...widest].sort((a, b) => b[1] - a[1]).slice(0, 10).filter(([, n]) => n > 4);
  if (wide.length) {
    console.log("widest cases (live processes in the case's own group):");
    wide.forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
    console.log("");
  }
  const heavy = [...heaviest].sort((a, b) => b[1] - a[1]).slice(0, 10).filter(([, mb]) => mb > 200);
  if (heavy.length) {
    console.log("heaviest cases (MB resident in the case's own group):");
    heavy.forEach(([f, mb]) => console.log(`  ${String(mb).padStart(5)}  ${f}`));
    console.log("");
  }
}
if (trackLeaks) {
  const total = leaked.reduce((a, b) => a + b.n, 0);
  console.log(`leaked processes: ${total} across ${leaked.length} case(s)`);
  leaked.sort((a, b) => b.n - a.n).slice(0, 20)
    .forEach((l) => console.log(`  ${String(l.n).padStart(4)}  ${l.file}`));
  console.log("");
}

console.log(`runtime: ${tilde(RUNTIME)}\n`);
console.log("top failure reasons:");
[...buckets].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
console.log("\nby area:");
areaRows.slice(0, 15).forEach((a) => console.log(`  ${String(a.pass).padStart(4)}/${String(a.total).padEnd(5)} ${a.area}`));
if (verbose) {
  console.log("\nfailing:");
  rows.filter((r) => !r.ok).forEach((r) => console.log(`  ${r.file}  ${r.why}`));
}
console.log(`\nnode-compat-sweep: ${pass}/${rows.length} pass (${pct}%), of ${selected.length} selected from ${files.length} runnable (${excluded} node-internal tests excluded)`);

if (failsPath) {
  writeFileSync(failsPath, rows.filter((r) => !r.ok).map((r) => JSON.stringify({ file: r.file, why: r.why })).join("\n") + "\n");
  console.log(`wrote ${failsPath} (${fail} failures)`);
}

const report = {
  schemaVersion: 1,
  suite: "node-compat",
  corpus: { path: tilde(NODE_TESTS), revision: gitRev(NODE_TESTS) },
  milojs: { revision: gitRev("."), dirty: gitDirty(".") },
  runtime: tilde(RUNTIME),
  selection: { directory: subDir || null, sample: sampleN, seed: "0x5eed17", available: files.length, excludedNodeInternal: excluded },
  totals: { pass, fail, total: rows.length },
  areas: areaRows,
};
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
console.log(`\nwrote ${jsonPath}`);
