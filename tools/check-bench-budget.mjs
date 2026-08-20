// Per-bench ceilings on the milojs/peer time ratio, ratcheted.
//
// Why this exists: every stage gate in docs/milojs-roadmap.md is a CORRECTNESS
// gate ("byte-identical to bun", "both sweeps unchanged"), and product gate 4 in
// docs/status.md — the performance one — read "decided and underway", which is a
// narrative, not a number. Conformance has committed reports, a defect budget and
// a peer column; perf had bench/run.sh printing ratios to a terminal and nothing
// reading them. A bytecode VM that made every bench 3x slower passed every gate
// in the repo.
//
// The ratio is the measurement, not the millisecond count: absolute times move
// with the machine, the ratio does not. bench/run.sh's header documents the
// scaling work that makes it repeatable to about 2%; the ceilings below carry
// HEADROOM well past that so an ordinary commit does not go red on noise.
//
//   node tools/check-bench-budget.mjs             # fail on any finding
//   node tools/check-bench-budget.mjs --baseline  # re-record ceilings from the report
//
// Three ways to fail, and the third is the one that matters:
//
//   OVER      a bench got slower than its ceiling. The regression this exists for.
//   UNCOVERED the report has a bench the budget does not, or the reverse. A bench
//             renamed or dropped would otherwise silently stop being checked,
//             which is how a gate starts reporting "0 checked" and exiting 0
//             forever (see tools/check-gate-teeth.sh for the three that did).
//   SLACK     a bench came in under HALF its ceiling. That is a 2x win, far
//             outside noise, and it means the ceiling no longer bounds anything.
//             Re-baseline so the next regression has something to hit.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const DIR = "docs/conformance";
const REPORT = join(DIR, "bench.json");
const BUDGET = join(DIR, "bench-budget.json");
const REBASELINE = process.argv.includes("--baseline");

// How much room above the measured ratio a re-baselined ceiling gets. bench/run.sh
// holds three consecutive runs inside about 2%; 15% is that with room for a
// different machine's cache behaviour, and still tight enough that a real
// regression (the ones this repo has seen are 3-12x) cannot hide under it.
const HEADROOM = 1.15;
// Below this fraction of its ceiling a bench is no longer bounded by it.
const SLACK_AT = 0.5;

if (!existsSync(REPORT)) {
  console.error(
    `check-bench-budget: ${REPORT} does not exist. A published perf number needs committed ` +
    `evidence, same as a conformance score — run:\n` +
    `  tools/dev.sh --rebuild zzz && bench/run.sh .dev/mj-engine --json ${REPORT}`
  );
  process.exit(1);
}

const report = JSON.parse(readFileSync(REPORT, "utf-8"));

// Same rule gen-facts applies to every other report: a number measured on a tree
// nobody can check out again is not evidence.
if (report.milojs?.dirty) {
  console.error(`check-bench-budget: ${REPORT} was measured on a DIRTY tree; re-run it from a clean checkout`);
  process.exit(1);
}

const measured = report.benches ?? {};
if (!Object.keys(measured).length) {
  console.error(`check-bench-budget: ${REPORT} scored no benches — the harness ran and measured nothing`);
  process.exit(1);
}

if (REBASELINE) {
  const ceilings = {};
  for (const name of Object.keys(measured).sort()) {
    ceilings[name] = Math.ceil(measured[name].ratio * HEADROOM);
  }
  writeFileSync(BUDGET, JSON.stringify({
    _comment:
      "Ceilings on the milojs/peer wall-time ratio per bench, from bench/run.sh --json. " +
      "Enforced by tools/check-bench-budget.mjs. Recorded at the measured ratio plus 15% " +
      "headroom; the harness itself repeats to about 2%. Lower them with --baseline after " +
      "a win lands, never raise one by hand to make a red run green.",
    _peer: `${report.peer?.name ?? "peer"} ${report.peer?.version ?? "unknown"}`,
    _measuredAt: report.milojs?.revision ?? null,
    ceilings,
  }, null, 2) + "\n");
  console.log(`check-bench-budget: recorded ${Object.keys(ceilings).length} ceiling(s) in ${BUDGET}`);
  process.exit(0);
}

if (!existsSync(BUDGET)) {
  console.error(`check-bench-budget: ${BUDGET} does not exist — record it with --baseline`);
  process.exit(1);
}
const ceilings = JSON.parse(readFileSync(BUDGET, "utf-8")).ceilings ?? {};

let bad = 0;
for (const name of Object.keys(measured).sort()) {
  if (ceilings[name] === undefined) {
    console.error(`UNCOVERED ${name} is in ${REPORT} with no ceiling in ${BUDGET} — record one with --baseline`);
    bad++;
  }
}
for (const name of Object.keys(ceilings).sort()) {
  const m = measured[name];
  if (!m) {
    console.error(`UNCOVERED ${BUDGET} bounds ${name}, which ${REPORT} does not measure — the bench was renamed or dropped, and its ceiling has been checking nothing`);
    bad++;
    continue;
  }
  if (m.ratio > ceilings[name]) {
    console.error(`OVER      ${name} ${m.ratio}x > ceiling ${ceilings[name]}x`);
    bad++;
  } else if (m.ratio < ceilings[name] * SLACK_AT) {
    console.error(`SLACK     ${name} ${m.ratio}x is under half its ${ceilings[name]}x ceiling — re-baseline so the ceiling bounds something again`);
    bad++;
  }
}

if (bad) {
  console.error(`FAIL: check-bench-budget found ${bad} finding(s)`);
  process.exit(1);
}
const t = report.totals ?? {};
console.log(
  `check-bench-budget: ${Object.keys(measured).length} bench(es) within ceilings ` +
  `(median ${t.medianRatio}x, worst ${t.worstRatio}x on ${t.worstBench}, ` +
  `vs ${report.peer?.name} ${report.peer?.version})`
);
