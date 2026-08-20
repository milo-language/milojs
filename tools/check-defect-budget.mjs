// The number of cases that kill the runtime with a SIGNAL, ratcheted per suite.
//
// Separate from the pass rate on purpose. A crash is the runtime dying on input
// a user could write — not a feature it lacks — and averaged into a four-digit
// failure count it is invisible: three of them ran for a whole afternoon while
// every published number stayed flat. tools/check-crash-visibility.mjs makes
// sure a sweep can SEE a crash; this makes sure nobody adds one.
//
// The budget only goes down. A report under budget fails too, and says what to
// write instead: a fixed crash that leaves its slot open is a slot the next
// regression slides into for free.
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DIR = "docs/conformance";
const BUDGET = join(DIR, "defect-budget.json");
const budgets = JSON.parse(readFileSync(BUDGET, "utf-8"));

let bad = 0;
// crashes must MATCH; the other two are ceilings. A crash is rare and each one is
// named in the budget file, so a drop should be written down. A hang count moves
// with whatever the runtime learned to finish, and demanding ceremony for every
// improvement would just train people to bump the number without reading it.
const EXACT = new Set(["crashes"]);
const METRICS = ["crashes", "timeouts", "parseFailures"];

for (const [suite, entry] of Object.entries(budgets)) {
  if (suite.startsWith("_")) continue;
  const report = join(DIR, `${suite}.json`);
  if (!existsSync(report)) {
    console.error(`check-defect-budget: ${BUDGET} names ${suite}, but ${report} does not exist`);
    bad++;
    continue;
  }
  const totals = JSON.parse(readFileSync(report, "utf-8")).totals ?? {};
  for (const metric of METRICS) {
    if (entry[metric] === undefined) continue;
    // The same metric has two spellings across the three sweeps: node-compat
    // writes totals.parseFailures, test262 and quickjs write totals.parseFail.
    // Accept either rather than re-running every sweep to unify a key name, but
    // do not silently accept NEITHER — that is the case below.
    const ALIASES = { parseFailures: ["parseFailures", "parseFail"] };
    for (const alt of ALIASES[metric] ?? []) {
      if (typeof totals[alt] === "number") { totals[metric] = totals[alt]; break; }
    }
    // A report with no field for a metric predates the sweep learning to count
    // it, so its absence would read as zero — a measurement nobody made.
    if (typeof totals[metric] !== "number") {
      console.error(`check-defect-budget: ${report} has no totals.${metric} — re-run the sweep to score it`);
      bad++;
      continue;
    }
    if (totals[metric] > entry[metric]) {
      console.error(`check-defect-budget: ${suite} ${metric} ${totals[metric]} > budget ${entry[metric]}`);
      bad++;
    } else if (totals[metric] < entry[metric] && EXACT.has(metric)) {
      console.error(`check-defect-budget: ${suite} ${metric} ${totals[metric]} < budget ${entry[metric]} — lower it in ${BUDGET} and drop the fixed entry from "known"`);
      bad++;
    }
  }
}

if (bad) process.exit(1);
const summary = Object.entries(budgets).filter(([k]) => !k.startsWith("_"))
  .map(([k, v]) => `${k}: ` + METRICS.filter((m) => v[m] !== undefined).map((m) => `${m}=${v[m]}`).join(" "))
  .join(", ");
console.log(`check-defect-budget: ${summary}`);
