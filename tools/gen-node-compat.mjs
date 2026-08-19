// The per-module Node compatibility table, DERIVED.
//
// Every runtime that publishes one of these (bun's is the well-known example)
// writes it by hand, and a hand-written matrix is the fastest-rotting document
// in a repo: closing a gap never touches the file claiming it is open. This one
// is compiled from two measured sources and gated with --check, so it cannot
// disagree with the tree.
//
//   1. EXPORTS. require() each builtin under node and under milojs and diff the
//      export names. That is bun's "fully / partially / missing" column, derived
//      instead of asserted, and the missing names are a ranked worklist.
//   2. TESTS. The per-area pass rate already measured in
//      docs/conformance/node-compat.json.
//
// Usage: node tools/gen-node-compat.mjs [--check]
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/node-compat.md");
const check = process.argv.includes("--check");

const RUNTIME = process.env.MILOJS_RUNTIME ?? join(ROOT, ".dev/mj-runtime");
if (!existsSync(RUNTIME)) {
  console.error(`gen-node-compat: no runtime at ${RUNTIME} — build it first (tools/dev.sh), or set MILOJS_RUNTIME.`);
  process.exit(2);
}

// node's own list, so a module added upstream shows up here as missing rather
// than being quietly absent from the table.
const MODULES = [
  "assert", "async_hooks", "buffer", "child_process", "cluster", "console",
  "constants", "crypto", "dgram", "diagnostics_channel", "dns", "domain",
  "events", "fs", "http", "http2", "https", "inspector", "module", "net",
  "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline",
  "repl", "sqlite", "stream", "string_decoder", "test", "timers", "tls",
  "trace_events", "tty", "url", "util", "v8", "vm", "wasi", "worker_threads",
  "zlib",
];

// A test file's area, the same way the sweep derives it: test-<area>-*.js.
// Several areas do not name a module (whatwg, runner, cli) and several modules
// have no area of their own; both are reported rather than hidden.
const AREA_ALIAS = { child_process: "child", worker_threads: "worker", string_decoder: "string", perf_hooks: "perf", diagnostics_channel: "diagnostics", async_hooks: "async" };

// One process for the whole probe: spawning 43 runtimes costs seconds, and the
// engine's own startup is the dominant term.
//
// The requires are emitted as LITERALS rather than `require("node:" + m)` in a
// loop. milojs pre-loads the module graph by scanning literal require
// specifiers before it runs anything, so a computed specifier resolves to
// nothing and every module would be reported missing — the probe would measure
// the preloader, not the modules.
const PROBE = `
const out = {};
function take(m, x) {
  const names = new Set();
  for (const k of Object.keys(x)) names.add(k);
  // A module whose export is a class or function (events, sqlite) carries its
  // surface as own properties of that function, not as keys of a namespace.
  if (typeof x === "function") {
    for (const k of Object.getOwnPropertyNames(x)) {
      if (k !== "length" && k !== "name" && k !== "prototype" && k !== "caller" && k !== "arguments") names.add(k);
    }
  }
  out[m] = { ok: true, names: [...names].sort() };
}
${MODULES.map((m) =>
  `try { take(${JSON.stringify(m)}, require(${JSON.stringify("node:" + m)})); } ` +
  `catch (e) { out[${JSON.stringify(m)}] = { ok: false, names: [], why: String(e && e.message).slice(0, 80) }; }`
).join("\n")}
console.log("__PROBE__" + JSON.stringify(out));
`;

const PROBE_FILE = join(ROOT, ".dev/node-compat-probe.js");
mkdirSync(join(ROOT, ".dev"), { recursive: true });
writeFileSync(PROBE_FILE, PROBE);

// A file rather than -e: milojs's CLI takes a path, not an inline program.
function probe(bin) {
  const raw = execFileSync(bin, [PROBE_FILE], { encoding: "utf-8", maxBuffer: 1 << 24 });
  const line = raw.split("\n").find((l) => l.startsWith("__PROBE__"));
  if (!line) throw new Error(`no probe output from ${bin}`);
  return JSON.parse(line.slice("__PROBE__".length));
}

// The reference sides are a COMMITTED SNAPSHOT, not a live probe.
//
// They were live at first, and that made the generated table depend on the
// machine: node's version string goes into the file, and whether bun is
// installed decides whether there is a bun column at all. So `--check` passed
// on the laptop that generated it and failed in CI, which is a gate that cannot
// be satisfied rather than a gate that caught something. Only the milojs
// binary is probed now; everything it is compared against is in the repo, which
// is the same rule docs/conformance/*.json already follows.
//
// `--refresh` re-probes node and bun and rewrites the snapshot. That is a
// deliberate act, committed alongside whatever it changes.
const SNAPSHOT = join(ROOT, "docs/conformance/node-exports.json");
const refresh = process.argv.includes("--refresh");

function versionOf(bin) {
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf-8" }).trim().split("\n")[0];
  } catch { return null; }
}

if (refresh) {
  let nodeProbe;
  try {
    nodeProbe = probe("node");
  } catch (e) {
    console.error(`gen-node-compat: could not probe node itself: ${e.message}`);
    process.exit(2);
  }
  let bunProbe = null, bunVersion = null;
  try { bunProbe = probe("bun"); bunVersion = versionOf("bun"); } catch { bunProbe = null; }
  writeFileSync(SNAPSHOT, JSON.stringify({
    schemaVersion: 1,
    node: { version: versionOf("node"), modules: nodeProbe },
    bun: bunProbe ? { version: bunVersion, modules: bunProbe } : null,
  }, null, 2) + "\n");
  console.log(`gen-node-compat: refreshed ${SNAPSHOT}`);
}

if (!existsSync(SNAPSHOT)) {
  console.error("gen-node-compat: docs/conformance/node-exports.json is missing — " +
    "run `node tools/gen-node-compat.mjs --refresh` to record what node and bun export.");
  process.exit(2);
}
const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf-8"));
const nodeSide = snapshot.node.modules;
const bunSide = snapshot.bun ? snapshot.bun.modules : null;

let miloSide;
try {
  miloSide = probe(RUNTIME);
} catch (e) {
  console.error(`gen-node-compat: could not probe ${RUNTIME}: ${e.message}`);
  process.exit(2);
}

const reportPath = join(ROOT, "docs/conformance/node-compat.json");
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf-8")) : null;
if (report?.milojs?.dirty) {
  console.error("gen-node-compat: docs/conformance/node-compat.json was measured on a DIRTY tree");
  process.exit(2);
}
const sweepDate = (() => {
  const rev = report?.milojs?.revision;
  if (!rev) return "1970-01-01";
  try {
    return execFileSync("git", ["show", "-s", "--format=%cs", rev], {
      encoding: "utf-8", cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return "1970-01-01"; }
})();

const areaByName = new Map((report?.areas ?? []).map((a) => [a.area, a]));

const rows = [];
for (const m of MODULES) {
  const n = nodeSide[m], j = miloSide[m];
  const wanted = new Set(n.ok ? n.names : []);
  const have = new Set(j.ok ? j.names : []);
  const missing = [...wanted].filter((k) => !have.has(k));
  const covered = wanted.size === 0 ? 0 : wanted.size - missing.length;
  const area = areaByName.get(AREA_ALIAS[m] ?? m);
  const b = bunSide?.[m];
  rows.push({
    module: m,
    loads: j.ok,
    wanted: wanted.size,
    covered,
    missing,
    bun: b && b.ok ? [...wanted].filter((k) => b.names.includes(k)).length : (b ? 0 : null),
    tests: area ? { pass: area.pass, ran: area.total - (area.skipped ?? 0), skipped: area.skipped ?? 0 } : null,
  });
}

// Best first, so the table reads as a ladder from green down to red.
const ranked = [...rows].sort((a, b) => {
  const d = bandRank(band(a)) - bandRank(band(b));
  if (d !== 0) return d;
  return score(b) - score(a);
});

const pct = (a, b) => (b === 0 ? "n/a" : `${((a / b) * 100).toFixed(0)}%`);

// GitHub's markdown renders no table styling, so the "colour" of a row has to
// be a glyph in it.
//
// Banded on the WORSE of the two measurements, not on exports alone. An export
// diff measures surface: a module can export every name node does and pass
// nothing, which is how `vm` looked green at 10/10 exports while failing two
// thirds of its tests. Green has to mean the names are there AND they behave.
//
// A module with no tests that ran has no behavioural evidence at all, so it is
// capped at yellow however complete its surface is. Saying "unverified" with a
// green dot is the failure mode this whole file exists to avoid.
function band(r) {
  if (!r.loads || r.wanted === 0) return "🔴";
  const exportPct = (r.covered / r.wanted) * 100;
  const testPct = r.tests && r.tests.ran > 0 ? (r.tests.pass / r.tests.ran) * 100 : null;
  if (testPct === null) return exportPct >= 60 ? "🟡" : "🔴";
  const worst = Math.min(exportPct, testPct);
  if (worst >= 90) return "🟢";
  if (worst >= 60) return "🟡";
  return "🔴";
}

// Best first: the table should read as a ladder, green at the top down to red.
function bandRank(b) { return b === "🟢" ? 0 : b === "🟡" ? 1 : 2; }
function score(r) {
  const e = r.wanted === 0 ? 0 : r.covered / r.wanted;
  const t = r.tests && r.tests.ran > 0 ? r.tests.pass / r.tests.ran : null;
  return t === null ? e : Math.min(e, t);
}
const testCell = (t) => {
  if (!t) return "n/a";
  if (t.ran === 0) return t.skipped > 0 ? `0/0 (${t.skipped} skipped)` : "n/a";
  return `${t.pass}/${t.ran}${t.skipped ? ` (+${t.skipped} skipped)` : ""}`;
};

const lines = [];
lines.push("<!-- doc-meta");
lines.push("system: node-compat");
lines.push("purpose: per-module Node compatibility, derived from an export diff against node and from the test sweep");
lines.push("key-files: tools/gen-node-compat.mjs, docs/conformance/node-compat.json, lib/");
lines.push("update-when: generated; run `node tools/gen-node-compat.mjs`, never edit by hand");
// Dated from the sweep's own commit rather than from today: a generated file
// stamped with the wall clock churns on every run and its --check gate can
// never be satisfied twice.
lines.push(`last-verified: ${sweepDate} (generated from the node-compat sweep at ${(report?.milojs?.revision ?? "unknown").slice(0, 8)})`);
lines.push("-->");
lines.push("");
lines.push("# Node module compatibility");
lines.push("");
lines.push("**Generated. Do not edit.** `node tools/gen-node-compat.mjs` rewrites this file and");
lines.push("`--check` fails if it is stale; both run in CI.");
lines.push("");
lines.push("Two independent measurements per module, because either one alone lies:");
lines.push("");
lines.push("- **exports**: how many of the names `node:<module>` exports under node also exist");
lines.push("  under milojs. A high number here means the SURFACE is present, not that it works.");
lines.push("- **tests**: node's own `test-<area>-*.js` cases that pass, out of those that ran.");
lines.push("  Skipped cases are counted separately and scored neither way.");
// A peer column only means something if it was measured the same way. Bun's own
// compatibility page assigns each module a hand-picked mark; this runs our
// probe against the bun binary instead, so the two columns are comparable.
if (bunSide) {
  lines.push("");
  lines.push("The bun column is the SAME probe, recorded from bun rather than quoted from its");
  lines.push("compatibility page, which is hand-assigned per module. It is there so our own");
  lines.push("column has something measured to sit beside it.");
}
lines.push("");
lines.push(`Reference surface: node ${snapshot.node.version}` +
  (snapshot.bun ? `, bun ${snapshot.bun.version}` : "") +
  (report ? `. Sweep at \`${(report.milojs?.revision ?? "").slice(0, 8)}\`` : "") + ".");
lines.push("");
lines.push("Colour bands the WORSE of the two columns: 🟢 both 90%+, 🟡 both 60%+, 🔴 below");
lines.push("that or does not load. A module with no tests that ran is capped at 🟡 however");
lines.push("complete its surface: exports alone are not evidence that anything works.");
lines.push("");
const bunHead = bunSide ? " bun exports |" : "";
const bunDashes = bunSide ? "---|" : "";
lines.push(`| | module | exports | tests |${bunHead} notable missing exports |`);
lines.push(`|---|---|---|---|${bunDashes}---|`);
for (const r of ranked) {
  const miss = r.missing.slice(0, 6).map((x) => `\`${x}\``).join(", ")
    + (r.missing.length > 6 ? ` +${r.missing.length - 6} more` : "");
  const name = r.loads ? `\`${r.module}\`` : `\`${r.module}\` **(does not load)**`;
  const bunCell = bunSide ? ` ${r.bun === null ? "n/a" : `${r.bun}/${r.wanted} ${pct(r.bun, r.wanted)}`} |` : "";
  lines.push(`| ${band(r)} | ${name} | ${r.covered}/${r.wanted} ${pct(r.covered, r.wanted)} | ${testCell(r.tests)} |${bunCell} ${miss || "n/a"} |`);
}
lines.push("");

const totalWanted = rows.reduce((a, r) => a + r.wanted, 0);
const totalCovered = rows.reduce((a, r) => a + r.covered, 0);
const notLoading = rows.filter((r) => !r.loads).map((r) => r.module);
const bandCount = { "🟢": 0, "🟡": 0, "🔴": 0 };
for (const r of rows) bandCount[band(r)]++;
lines.push(`Across all ${rows.length} modules: **${totalCovered}/${totalWanted} exports present (${pct(totalCovered, totalWanted)})**: ` +
  `🟢 ${bandCount["🟢"]}, 🟡 ${bandCount["🟡"]}, 🔴 ${bandCount["🔴"]}.`);
if (notLoading.length) {
  lines.push("");
  lines.push(`Modules that do not load at all: ${notLoading.map((m) => `\`${m}\``).join(", ")}.`);
}
lines.push("");

const text = lines.join("\n");
if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf-8") : "";
  if (current !== text) {
    console.error("gen-node-compat: docs/node-compat.md is stale — run `node tools/gen-node-compat.mjs`");
    process.exit(1);
  }
  console.log(`gen-node-compat: ${rows.length} modules checked, table matches the tree`);
} else {
  writeFileSync(OUT, text);
  console.log(`gen-node-compat: wrote docs/node-compat.md (${rows.length} modules, ${totalCovered}/${totalWanted} exports)`);
}
