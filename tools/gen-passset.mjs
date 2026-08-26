// Seed or update a conformance pass set from its committed sweep report.
//
// Usage: bun tools/gen-passset.mjs <suite> [...]   (suite: test262 | quickjs | node-compat)
//
// Writes docs/conformance/passset-<suite>.txt: a pinned header plus the sorted
// per-case pass list from docs/conformance/<suite>.json. Run this in the SAME
// commit as the sweep that improved the numbers; the ratchet
// (tools/check-conformance-ratchet.mjs) refuses to compare across differing pins.
// Shrinking a pass set is a deliberate act: this tool rewrites to exactly the
// report's passes, so if the report lost cases the diff will show the removal and
// the commit message owes the argument.
import { readFileSync, writeFileSync } from "fs";

const DIR = "docs/conformance";
const suites = process.argv.slice(2);
if (suites.length === 0) { console.error("usage: bun tools/gen-passset.mjs <suite> [...]"); process.exit(2); }

for (const suite of suites) {
  const report = JSON.parse(readFileSync(`${DIR}/${suite}.json`, "utf-8"));
  if (!Array.isArray(report.passes) || report.passes.length === 0) {
    console.error(`gen-passset: ${suite}: report has no per-case passes — rerun the sweep first`);
    process.exit(1);
  }
  const header = [`# corpus ${report.corpus.revision}`];
  if (report.selection?.seed) { header.push(`# seed ${report.selection.seed}`, `# sample ${report.selection.sample}`); }
  const out = header.join("\n") + "\n" + [...report.passes].sort().join("\n") + "\n";
  const path = `${DIR}/passset-${suite}.txt`;
  writeFileSync(path, out);
  console.log(`gen-passset: wrote ${path} (${report.passes.length} cases)`);
}
