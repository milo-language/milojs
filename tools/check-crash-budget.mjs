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
const BUDGET = join(DIR, "crash-budget.json");
const budgets = JSON.parse(readFileSync(BUDGET, "utf-8"));

let bad = 0;
for (const [suite, entry] of Object.entries(budgets)) {
  if (suite.startsWith("_")) continue;
  const report = join(DIR, `${suite}.json`);
  if (!existsSync(report)) {
    console.error(`check-crash-budget: ${BUDGET} names ${suite}, but ${report} does not exist`);
    bad++;
    continue;
  }
  const totals = JSON.parse(readFileSync(report, "utf-8")).totals ?? {};
  // A report with no crashes field predates the sweep learning to count them, so
  // its zero would be an artifact of the old code rather than a measurement.
  if (typeof totals.crashes !== "number") {
    console.error(`check-crash-budget: ${report} has no totals.crashes — re-run the sweep to score it`);
    bad++;
    continue;
  }
  if (totals.crashes > entry.budget) {
    console.error(`check-crash-budget: ${suite} crashes ${totals.crashes} > budget ${entry.budget} — a new input kills the runtime`);
    bad++;
  } else if (totals.crashes < entry.budget) {
    console.error(`check-crash-budget: ${suite} crashes ${totals.crashes} < budget ${entry.budget} — lower the budget in ${BUDGET} and drop the fixed entry from "known"`);
    bad++;
  }
}

if (bad) process.exit(1);
const summary = Object.entries(budgets).filter(([k]) => !k.startsWith("_"))
  .map(([k, v]) => `${k}=${v.budget}`).join(", ");
console.log(`check-crash-budget: ${summary}`);
