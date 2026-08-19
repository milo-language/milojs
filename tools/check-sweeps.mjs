// Every conformance sweep must REFUSE to score when its engine binary is
// missing, rather than recording each case as a crash and writing a clean-
// looking JSON that reads as a total collapse.
//
// This defect has now appeared twice: test262-sweep reported 1347 crashes off a
// nonexistent /tmp/mj-eng, was fixed, and quickjs-sweep carried the identical
// bug (0/149) for months because the fix was applied to the one instance
// instead of the pattern. Hence a gate rather than a third manual fix.
//
// The check is behavioural, not textual: point each sweep's binary at a path
// that cannot exist and require a nonzero exit with no output file. A guard
// that exists but runs after the scoring loop still fails here.
import { readdirSync, existsSync, unlinkSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { tmpdir, homedir } from "os";

// Which env var names the binary under test. A sweep not listed here fails the
// coverage check below, so adding a sweep forces a decision about its guard.
const BINARY_ENV = {
  "quickjs-sweep.ts": "MILOJS_ENGINE",
  "test262-sweep.ts": "MILOJS_ENGINE",
  "node-compat-sweep.ts": "MILOJS_RUNTIME",
};

const sweeps = readdirSync("scripts").filter((f) => f.endsWith("-sweep.ts"));
let bad = 0;

const unregistered = sweeps.filter((s) => !BINARY_ENV[s]);
if (unregistered.length) {
  console.error(`check-sweeps: ${unregistered.join(", ")} not registered in BINARY_ENV`);
  bad++;
}

for (const s of sweeps) {
  const env = BINARY_ENV[s];
  if (!env) continue;
  const out = `/tmp/check-sweeps-${s}.json`;
  if (existsSync(out)) unlinkSync(out);
  let code = 0;
  try {
    execFileSync("bun", [`scripts/${s}`, "--json", out], {
      env: { ...process.env, [env]: "/nonexistent/milojs-binary" },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
  } catch (e) {
    code = e.status ?? 1;
  }
  if (code === 0) {
    console.error(`check-sweeps: ${s} exited 0 with ${env} pointing at a missing binary`);
    bad++;
  }
  if (existsSync(out)) {
    console.error(`check-sweeps: ${s} wrote ${out} with ${env} pointing at a missing binary`);
    unlinkSync(out);
    bad++;
  }
}

// --- second defect, same shape: scoring a test that DECLINED to run.
//
// node's common.skip() writes the TAP plan "1..0 # Skipped: <reason>" and exits
// 0. node-compat-sweep discarded stdout and scored on the exit code alone, so
// 298 skipped cases (every http2 and https test, all of them "missing crypto")
// counted as passes — the published number was inflated by exactly the features
// the runtime was missing most. A textual check would not catch the regression;
// this runs the sweep against two stub runtimes and requires it to tell them
// apart.
function stub(dir, name, body) {
  const p = join(dir, name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}

const NODE_TESTS = process.env.NODE_TESTS ?? join(homedir(), "git/node/test");
if (!existsSync(join(NODE_TESTS, "parallel"))) {
  console.error(`check-sweeps: no node corpus at ${NODE_TESTS}, skip-scoring not probed`);
} else {
  const work = mkdtempSync(join(tmpdir(), "check-sweeps-skip-"));
  mkdirSync(join(work, "parallel"), { recursive: true });
  // --dir filters to test-<dir>-*.js, so this name is what selects it and
  // nothing else in the real corpus.
  writeFileSync(join(work, "parallel", "test-skipteeth-probe.js"), "// probe\n");

  const cases = [
    { label: "a skipped case", body: "echo '1..0 # Skipped: teeth probe'\nexit 0", want: { pass: 0, skipped: 1 } },
    { label: "a passing case", body: "echo 'ok 1'\nexit 0", want: { pass: 1, skipped: 0 } },
  ];
  for (const c of cases) {
    const bin = stub(work, c.label.includes("skip") ? "skip-stub" : "pass-stub", c.body);
    const out = join(work, "report.json");
    if (existsSync(out)) unlinkSync(out);
    try {
      execFileSync("bun", ["scripts/node-compat-sweep.ts", "--dir", "skipteeth", "--json", out], {
        env: { ...process.env, NODE_TESTS: work, MILOJS_RUNTIME: bin },
        encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
      });
    } catch (e) {
      console.error(`check-sweeps: node-compat-sweep failed on ${c.label}: ${e.status}`);
      bad++;
      continue;
    }
    if (!existsSync(out)) {
      console.error(`check-sweeps: node-compat-sweep wrote no report for ${c.label}`);
      bad++;
      continue;
    }
    const t = JSON.parse(readFileSync(out, "utf-8")).totals;
    if (t.pass !== c.want.pass || t.skipped !== c.want.skipped) {
      console.error(`check-sweeps: ${c.label} scored pass=${t.pass} skipped=${t.skipped}, ` +
        `expected pass=${c.want.pass} skipped=${c.want.skipped}`);
      bad++;
    }
  }
  rmSync(work, { recursive: true, force: true });
}

console.log(`check-sweeps: ${sweeps.length} sweep(s), ${bad} that score without a binary or miscount a skip`);
process.exit(bad ? 1 : 0);
