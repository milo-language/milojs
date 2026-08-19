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
import { readdirSync, existsSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";

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

console.log(`check-sweeps: ${sweeps.length} sweep(s), ${bad} that score without a binary`);
process.exit(bad ? 1 : 0);
