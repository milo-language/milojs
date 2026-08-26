// Ratchet on the committed VM coverage number: the fraction of corpus function
// bodies that compile may not go DOWN. tools/vm-coverage.mjs writes the report;
// this holds the floor at what the last committed report achieved, recorded in
// the report itself (the diff shows both numbers when it moves).
//
// The floor is the committed pct, not a separate baseline file: a regression
// would need the report rewritten with a lower number, and this gate is what
// makes that rewrite fail instead of slide through.
import { readFileSync, existsSync } from "fs";

const PATH = "docs/conformance/vm-coverage.json";
const FLOOR = "docs/conformance/vm-coverage-floor.txt";

if (!existsSync(PATH)) { console.error(`check-vm-coverage: ${PATH} missing — run bun tools/vm-coverage.mjs`); process.exit(1); }
if (!existsSync(FLOOR)) { console.error(`check-vm-coverage: ${FLOOR} missing — seed it with the achieved pct`); process.exit(1); }

const report = JSON.parse(readFileSync(PATH, "utf-8"));
const floorLine = readFileSync(FLOOR, "utf-8").trim().split(/\s+/);
const floor = parseFloat(floorLine[0]);
const t = report.totals ?? {};

// An empty universe is a broken gate, not a clean one.
if (!t.functionBodies || t.functionBodies === 0) { console.error("check-vm-coverage: report audited zero function bodies"); process.exit(1); }
if (!Number.isFinite(floor)) { console.error(`check-vm-coverage: ${FLOOR} does not start with a number`); process.exit(1); }

if (t.pct < floor) {
  console.error(`check-vm-coverage: FAIL — coverage ${t.pct}% fell below the floor ${floor}% (${t.compiledBodies}/${t.functionBodies} bodies)`);
  process.exit(1);
}
const note = t.pct > floor ? `, above the ${floor}% floor — ratchet it up (echo "${t.pct}" > ${FLOOR})` : "";
console.log(`check-vm-coverage: ${t.compiledBodies}/${t.functionBodies} bodies = ${t.pct}%${note}`);
