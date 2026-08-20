// Every sweep must report a child that died on a SIGNAL as a crash, and count
// it separately from its failure total.
//
// Why this is a gate and not a fix: all three sweeps had the identical defect,
// each written independently — `output || crash(signal)`. A crashing engine
// almost always prints something on the way down, so output won, and the crash
// was filed under whatever line it happened to have written. The node-compat
// fails file recorded reasons like "11 |   ReflectApply,"; the machine produced
// twenty crash reports in one afternoon and every conformance number stayed
// flat. In test262 and quickjs it was worse than invisible: a nonzero exit reads
// as "the case threw", which is the PASS condition for a negative test, so a
// segfault could score a point.
//
// The check is behavioural. Each sweep is pointed at a stub "engine" that writes
// a line to stderr and then kills itself with SIGSEGV, over a synthetic
// one-case corpus, and its own JSON report has to come back saying so.
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, existsSync, readFileSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

const MARKER = "CRASHPROBE-STDERR-MARKER";

// Writes to stderr FIRST, so a sweep that prefers output over the signal has
// something to prefer. That ordering is the whole bug.
const STUB = `#!/bin/sh
echo "${MARKER}" >&2
kill -SEGV $$
`;

const root = mkdtempSync(join(tmpdir(), "crashvis-"));
const stub = join(root, "stub-engine");
writeFileSync(stub, STUB);
chmodSync(stub, 0o755);

// Each sweep gets the smallest corpus its own discovery accepts.
function nodeCompatCorpus() {
  const dir = join(root, "node-tests");
  mkdirSync(join(dir, "parallel"), { recursive: true });
  writeFileSync(join(dir, "parallel", "test-crashprobe.js"), "console.log('probe');\n");
  return dir;
}
function test262Corpus() {
  const dir = join(root, "test262");
  mkdirSync(join(dir, "test", "probe"), { recursive: true });
  mkdirSync(join(dir, "harness"), { recursive: true });
  for (const h of ["assert.js", "sta.js", "doneprintHandle.js"]) writeFileSync(join(dir, "harness", h), "\n");
  writeFileSync(join(dir, "test", "probe", "crashprobe.js"), "var x = 1;\n");
  return dir;
}
function quickjsCorpus() {
  const dir = join(root, "quickjs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "test_crashprobe.js"), "var x = 1;\n");
  return dir;
}

const SWEEPS = [
  { file: "node-compat-sweep.ts", binEnv: "MILOJS_RUNTIME", corpusEnv: "NODE_TESTS", corpus: nodeCompatCorpus },
  { file: "test262-sweep.ts", binEnv: "MILOJS_ENGINE", corpusEnv: "TEST262", corpus: test262Corpus },
  { file: "quickjs-sweep.ts", binEnv: "MILOJS_ENGINE", corpusEnv: "QUICKJS_TESTS", corpus: quickjsCorpus },
];

let bad = 0;
for (const s of SWEEPS) {
  const out = join(root, s.file.replace(/\.ts$/, "") + ".json");
  if (existsSync(out)) unlinkSync(out);
  const env = { ...process.env, [s.binEnv]: stub, [s.corpusEnv]: s.corpus() };
  let stdout = "";
  try {
    stdout = execFileSync("bun", [`scripts/${s.file}`, "--json", out], {
      env, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
    });
  } catch (e) {
    stdout = (e.stdout ?? "") + (e.stderr ?? "");
  }
  if (!existsSync(out)) {
    console.error(`check-crash-visibility: ${s.file} wrote no report when every case crashed`);
    console.error(stdout.split("\n").slice(-6).join("\n"));
    bad++;
    continue;
  }
  const report = JSON.parse(readFileSync(out, "utf-8"));
  const crashes = report.totals?.crashes;
  if (typeof crashes !== "number") {
    console.error(`check-crash-visibility: ${s.file} report has no totals.crashes`);
    bad++;
  } else if (crashes < 1) {
    console.error(`check-crash-visibility: ${s.file} scored a SIGSEGV as totals.crashes=${crashes}`);
    bad++;
  }
  // The signal has to WIN over the output. If the stub's stderr line shows up as
  // a failure reason, the sweep classified the crash by what it printed.
  const text = JSON.stringify(report.failureBuckets ?? report.areas ?? {});
  if (text.includes(MARKER)) {
    console.error(`check-crash-visibility: ${s.file} bucketed the crash under the stub's stderr line`);
    bad++;
  }
}

rmSync(root, { recursive: true, force: true });
if (bad) { console.error(`check-crash-visibility: ${bad} problem(s)`); process.exit(1); }
console.log(`check-crash-visibility: ${SWEEPS.length} sweep(s), all report a signal death as a crash`);
