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
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { execFileSync, spawn } from "child_process";
import { join, resolve, isAbsolute } from "path";
import { homedir } from "node:os";

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
const jobs = arg("--jobs") ? parseInt(arg("--jobs")!) : 8;
// A --dir run is a DIAGNOSTIC, not the published number: the same rule the
// test262 sweep follows, and for the same reason. Only a whole-suite run may
// write the committed report.
const isCanonical = !subDir;
const jsonPath = arg("--json") ?? (isCanonical ? "docs/conformance/node-compat.json" : ".dev/node-compat-partial.json");
const failsPath = arg("--fails");

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

// Each case runs DETACHED, in its own process group, and the timeout kills the
// group rather than the pid. Node's tests spawn children (`fork(__filename)` is
// how half of test-child-process-* works), and a plain execFile timeout signals
// only the process it started: the grandchildren survive, keep running, and if
// the runtime under test has a spawn bug they keep multiplying. That is how this
// sweep took a machine down. Run it under tools/guard.sh as well; this is the
// inner half of the same defence.
function runOne(f: string): Promise<Row> {
  return new Promise((resolve) => {
    const child = spawn(RUNTIME, [join(PARALLEL, f)], {
      cwd: PARALLEL,
      env: CHILD_ENV,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
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

    const finish = (row: Row) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
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

// A fixed pool rather than one promise per case: 3979 concurrent processes would
// thrash, and the servers these tests start would collide on ports.
const rows: Row[] = new Array(selected.length);
let next = 0;
async function worker() {
  while (true) {
    const i = next++;
    if (i >= selected.length) return;
    rows[i] = await runOne(selected[i]);
  }
}
await Promise.all(Array.from({ length: Math.max(1, jobs) }, () => worker()));
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
