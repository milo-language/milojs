// Every gate the pre-commit hook runs must also run in CI.
//
// AGENTS.md has claimed this in prose ("Every check the hook runs is also a CI
// step, so a missing hook costs a round trip, not correctness") since the hook
// existed, and it was false for seven gates: check-defect-budget,
// check-bench-budget, check-ast-refs, check-gaps, check-exit-codes,
// check-sweeps and check-crash-visibility ran nowhere but a local file that no
// fresh clone has. docs/conformance/node-compat.json therefore sat at 164 hangs
// against a 162 ceiling for five commits with every CI run green.
//
// A prose claim about which gates run is exactly the kind of fact that rots
// silently, so it is checked instead: read the tool invocations out of the hook,
// read them out of the workflow, and require the first set to be inside the
// second.
import { readFileSync } from "fs";

const HOOK = "tools/precommit.sh";
const WORKFLOW = ".github/workflows/ci.yml";
const TOOLS = /tools\/([a-z0-9-]+\.(?:mjs|sh))/g;

const names = (file) => new Set([...readFileSync(file, "utf-8").matchAll(TOOLS)].map((m) => m[1]));

// The hook regenerates these and stages the result; CI checks the committed
// output instead (`--check`), which is the same fact asked in the direction a
// read-only job can ask it. Matching on the tool NAME already covers that, so
// this list is only for tools the hook runs that CI has no business running.
const HOOK_ONLY = new Set([
  "gen-docs.sh", // regenerates docs/api from source; CI gates it through check-docs.mjs
]);

const missing = [...names(HOOK)].filter((n) => !HOOK_ONLY.has(n)).filter((n) => !names(WORKFLOW).has(n)).sort();

if (missing.length) {
  console.error(`check-ci-covers-hook: ${WORKFLOW} does not run ${missing.join(", ")}`);
  console.error(`  ${HOOK} runs them, so a clone without the hook installed can push past them.`);
  console.error(`  Add a step to ${WORKFLOW}, or add the tool to HOOK_ONLY here and say why.`);
  process.exit(1);
}

console.log(`check-ci-covers-hook: ${names(HOOK).size} hook gate(s), all also run in CI`);
