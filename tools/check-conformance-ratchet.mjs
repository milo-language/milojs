// Conformance pass-set ratchet: no previously passing case may fail.
//
// Each suite has a committed high-water pass set (docs/conformance/passset-<suite>.txt)
// and a committed sweep report (docs/conformance/<suite>.json) whose `passes` array
// the sweep writes per case. The aggregate score cannot express "a +5/-5 swap":
// this gate compares per case, and fails naming the exact cases that were lost.
//
// The pass set only moves two ways:
//   up:   a sweep that passes new cases prints them as "unclaimed wins"; the commit
//         that earned them rewrites the file (append + sort) to claim them.
//   down: only with an explicit argued removal in the commit that shrinks the file.
//
// A header pins what the set was measured against; comparing across different
// corpus revisions (or a different test262 sample) is an ERROR, not a pass or fail:
// the two runs are incommensurable and the sweep must be rerun on the pin first.
import { readFileSync, existsSync } from "fs";

const DIR = "docs/conformance";
// Suites the ratchet covers. node is added when its sweep report carries `passes`
// and its pass set is seeded — extend this list in that commit, never silently.
const SUITES = ["test262", "quickjs"];

let bad = 0;
const complain = (msg) => { console.error(msg); bad = 1; };

for (const suite of SUITES) {
  const setPath = `${DIR}/passset-${suite}.txt`;
  const reportPath = `${DIR}/${suite}.json`;
  if (!existsSync(setPath)) { complain(`check-conformance-ratchet: ${setPath} missing — seed it from the report's passes`); continue; }
  if (!existsSync(reportPath)) { complain(`check-conformance-ratchet: ${reportPath} missing`); continue; }

  const lines = readFileSync(setPath, "utf-8").split("\n").filter((l) => l.length > 0);
  const header = lines.filter((l) => l.startsWith("#"));
  const cases = lines.filter((l) => !l.startsWith("#"));
  const report = JSON.parse(readFileSync(reportPath, "utf-8"));

  if (!Array.isArray(report.passes)) { complain(`check-conformance-ratchet: ${reportPath} has no per-case passes (sweep predates the ratchet — rerun it)`); continue; }
  // An empty universe is a broken gate, not a clean one.
  if (cases.length === 0) { complain(`check-conformance-ratchet: ${setPath} lists zero cases`); continue; }
  if (report.passes.length === 0) { complain(`check-conformance-ratchet: ${reportPath} lists zero passing cases`); continue; }

  // Header pins: corpus revision always; seed + sample size for a sampled suite.
  const pins = {};
  for (const h of header) { const m = /^#\s*(\S+)\s+(.+)$/.exec(h); if (m) pins[m[1]] = m[2].trim(); }
  const want = { corpus: report.corpus?.revision ?? "?" };
  if (report.selection?.seed) { want.seed = String(report.selection.seed); want.sample = String(report.selection.sample); }
  let pinned = true;
  for (const [k, v] of Object.entries(want)) {
    if (pins[k] !== String(v)) {
      complain(`check-conformance-ratchet: ${suite}: pass set pins ${k}=${pins[k] ?? "(absent)"} but report has ${v} — incommensurable runs; rerun the sweep on the pin or reseed the set in this commit`);
      pinned = false;
    }
  }
  if (!pinned) continue;

  const passing = new Set(report.passes);
  const lost = cases.filter((c) => !passing.has(c));
  if (lost.length > 0) {
    complain(`check-conformance-ratchet: ${suite}: ${lost.length} previously passing case(s) no longer pass:`);
    for (const c of lost.slice(0, 40)) console.error(`  ${c}`);
    if (lost.length > 40) console.error(`  … and ${lost.length - 40} more`);
    continue;
  }

  const claimed = new Set(cases);
  const wins = report.passes.filter((c) => !claimed.has(c));
  const winNote = wins.length > 0 ? `, ${wins.length} unclaimed win(s) — rewrite ${setPath} to claim them (bun tools/gen-passset.mjs ${suite})` : "";
  console.log(`check-conformance-ratchet: ${suite}: ${cases.length} case(s) held${winNote}`);
}

process.exit(bad);
