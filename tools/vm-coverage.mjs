// How much of a real-world corpus compiles to bytecode, measured by the compiler
// itself: every file is run through `milojs-engine --vm-audit`, which parses and
// attempts to compile each function body and loop without executing anything.
// No reimplementation of the admission rules exists to drift (the earlier plan
// was an acorn-based classifier; this replaced it for exactly that reason).
//
// Writes docs/conformance/vm-coverage.json — committed evidence, ranked residue.
// Usage: bun tools/vm-coverage.mjs [--json path] [--corpus dir]
import { readdirSync, writeFileSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { homedir } from "os";

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const CORPUS = arg("--corpus") ?? process.env.NODE_TESTS ?? join(homedir(), "git/node/test/parallel");
const ENGINE = process.env.MILOJS_ENGINE ?? ".dev/mj-engine";
const jsonPath = arg("--json") ?? "docs/conformance/vm-coverage.json";

const rev = (dir) => { try { return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim(); } catch { return "?"; } };
const dirty = (dir) => { try { return execFileSync("git", ["-C", dir, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf-8" }).trim().length > 0; } catch { return true; } };

const files = readdirSync(CORPUS).filter((f) => f.endsWith(".js")).sort().map((f) => join(CORPUS, f));
if (files.length === 0) { console.error(`vm-coverage: no .js files under ${CORPUS}`); process.exit(1); }

let bodiesOk = 0, bodiesNo = 0, loopsOk = 0, loopsNo = 0, parseFail = 0, audited = 0;
const reasons = new Map();
let done = 0;
for (const f of files) {
  let out = "";
  try {
    out = execFileSync(ENGINE, ["--vm-audit", f], { encoding: "utf-8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    // The engine could not parse the file (or died trying): that is a missing
    // SYNTAX feature, tracked by the conformance sweeps; here it only means the
    // file contributes no bodies to the denominator.
    parseFail++;
    continue;
  }
  const m = /vm-stats: bodies (\d+) compiled \/ (\d+) rejected; loops (\d+) compiled \/ (\d+) rejected/.exec(out);
  if (!m) { parseFail++; continue; }
  audited++;
  bodiesOk += +m[1]; bodiesNo += +m[2]; loopsOk += +m[3]; loopsNo += +m[4];
  for (const line of out.split("\n")) {
    const r = /^  (\d+)  (.+)$/.exec(line);
    if (r) reasons.set(r[2], (reasons.get(r[2]) ?? 0) + +r[1]);
  }
  if (++done % 500 === 0) process.stderr.write(`  ${done}/${files.length}\r`);
}

const bodies = bodiesOk + bodiesNo;
const pct = bodies ? +((bodiesOk / bodies) * 100).toFixed(1) : 0;
// Zero bodies audited means the gate has no universe: refuse to write a report
// that would read as "100% of nothing".
if (bodies === 0) { console.error("vm-coverage: audited zero function bodies"); process.exit(1); }

const report = {
  schemaVersion: 1,
  suite: "vm-coverage",
  corpus: { path: CORPUS.replace(homedir(), "~"), revision: rev(CORPUS) },
  milojs: { revision: rev("."), dirty: dirty(".") },
  totals: { files: files.length, audited, parseFail, functionBodies: bodies, compiledBodies: bodiesOk, pct, loops: loopsOk + loopsNo, compiledLoops: loopsOk },
  blockers: [...reasons.entries()].map(([construct, bodiesBlocked]) => ({ construct, bodiesBlocked }))
    .sort((a, b) => b.bodiesBlocked - a.bodiesBlocked || a.construct.localeCompare(b.construct)),
};
mkdirSync(jsonPath.replace(/\/[^/]+$/, ""), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
console.log(`vm-coverage: ${bodiesOk}/${bodies} function bodies compile (${pct}%), ${loopsOk}/${loopsOk + loopsNo} loops, ${parseFail} of ${files.length} files unparsable`);
console.log(`top blockers: ${report.blockers.slice(0, 8).map((b) => `${b.construct} (${b.bodiesBlocked})`).join(", ")}`);
console.log(`wrote ${jsonPath}`);
