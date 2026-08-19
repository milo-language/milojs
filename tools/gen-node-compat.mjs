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
// machine: node's version string goes into the file, so `--check` passed on the
// laptop that generated it and failed in CI, which is a gate that cannot be
// satisfied rather than a gate that caught something. Only the milojs binary is
// probed now; everything it is compared against is in the repo, which is the
// same rule docs/conformance/*.json already follows.
//
// `--refresh` re-probes node and rewrites the snapshot. That is a deliberate
// act, committed alongside whatever it changes.
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
  writeFileSync(SNAPSHOT, JSON.stringify({
    schemaVersion: 1,
    node: { version: versionOf("node"), modules: nodeProbe },
  }, null, 2) + "\n");
  console.log(`gen-node-compat: refreshed ${SNAPSHOT}`);
}

if (!existsSync(SNAPSHOT)) {
  console.error("gen-node-compat: docs/conformance/node-exports.json is missing — " +
    "run `node tools/gen-node-compat.mjs --refresh` to record what node exports.");
  process.exit(2);
}
const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf-8"));
const nodeSide = snapshot.node.modules;

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
// The peer column. Optional: the table is about milojs and still generates
// without it, but when the report is present every row carries a second engine
// measured on the SAME corpus by the SAME harness. That is the difference
// between a number and a number that means something — a reader looking at a
// column of red has no way to know whether 34% on node's fs suite is bad or
// whether node's fs suite is brutal, and the shipping runtime everyone compares
// against scoring 57% on the identical files answers it.
const peerPath = join(ROOT, "docs/conformance/node-compat-peer.json");
const peer = existsSync(peerPath) ? JSON.parse(readFileSync(peerPath, "utf-8")) : null;
if (peer?.milojs?.dirty) {
  console.error("gen-node-compat: docs/conformance/node-compat-peer.json was measured on a DIRTY tree");
  process.exit(2);
}
// A peer measured against a different node checkout is not a comparison, it is
// two unrelated numbers side by side. Refuse rather than publish it.
if (peer && report && peer.corpus?.revision !== report.corpus?.revision) {
  console.error(
    `gen-node-compat: peer report was measured against node ${String(peer.corpus?.revision).slice(0, 8)} ` +
    `but the milojs report against ${String(report.corpus?.revision).slice(0, 8)} — re-run both on one corpus.`);
  process.exit(2);
}
const peerLabel = (() => {
  if (!peer) return null;
  const bin = String(peer.runtime ?? "peer").split("/").pop();
  const ver = String(peer.runtimeVersion ?? "");
  if (!ver || ver === "unknown") {
    console.error("gen-node-compat: peer report records no runtimeVersion — re-run the peer sweep");
    process.exit(2);
  }
  return ver.toLowerCase().startsWith(bin.toLowerCase()) ? ver : `${bin} ${ver}`;
})();
const peerByName = new Map((peer?.areas ?? []).map((a) => [a.area, a]));

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
  rows.push({
    module: m,
    loads: j.ok,
    wanted: wanted.size,
    covered,
    missing,
    tests: area ? { pass: area.pass, ran: area.total - (area.skipped ?? 0), skipped: area.skipped ?? 0 } : null,
    peer: (() => {
      const pa = peerByName.get(AREA_ALIAS[m] ?? m);
      return pa ? { pass: pa.pass, ran: pa.total - (pa.skipped ?? 0), skipped: pa.skipped ?? 0 } : null;
    })(),
  });
}

const pct = (a, b) => (b === 0 ? "n/a" : `${((a / b) * 100).toFixed(0)}%`);

// GitHub's markdown renders no table styling, so the "colour" of a row has to
// be a glyph in it.
//
// THE DOT BANDS THE TESTS, and nothing else. Two earlier rules were worse:
//
//   - Banding on exports alone called a module green for having the names,
//     which is how `vm` read green at 10/10 exports while failing two thirds of
//     its cases.
//   - Banding on the WORSE of exports and tests, which replaced it, is honest
//     and reads as noise. Pass rates are under 60% nearly everywhere, so the min
//     pinned 38 of 43 modules red and 0 green, and a column that says the same
//     thing about almost every row carries no information.
//
// Nobody cares that a module exports a name that does not work, so exports do
// not get a vote on the colour. They stay in the table as the WORKLIST: the
// count says how much surface is missing and the last column names it, which is
// what you read AFTER the dot tells you the module is behind.
//
// Four bands, not three: at these rates a three-band scale puts almost
// everything in the bottom one, and 48% (`timers`) and 10% (`http`) are not the
// same problem.
//
// ⚪ is "no evidence", which is not a zero: no test in node's suite targets this
// module, or every one of them skipped. Those modules are ranked by exports
// alone, and a green dot is not available to them at any surface.
const BANDS = ["🟢", "🟡", "🟠", "🔴", "⚪"];
const rawDot = (p) => (p === null ? "⚪" : p >= 90 ? "🟢" : p >= 60 ? "🟡" : p >= 30 ? "🟠" : "🔴");

// Two caps, both learned from a row that was obviously wrong.
//
// A module that does not LOAD is red whatever its cases did. `inspector` ranked
// top of this table at 1/1 with 54 skipped: the one case that ran was the one
// asserting the module is unavailable, and requiring it throws.
//
// Under MIN_CASES a module cannot earn better than 🟠. A handful of cases does
// not certify a module, and node's suite is lopsided: `assert` has 13 that run
// against `http`'s 371. The cap is one-sided on purpose. Failing 4 of 4 IS
// evidence of failure, so a small sample can still go red; it just cannot go
// green.
const MIN_CASES = 5;
function dot(r) {
  if (!r.loads) return "🔴";
  const d = rawDot(testPct(r));
  if ((r.tests?.ran ?? 0) < MIN_CASES && (d === "🟢" || d === "🟡")) return "🟠";
  return d;
}
const exportPct = (r) => (!r.loads || r.wanted === 0 ? 0 : (r.covered / r.wanted) * 100);
// null, not 0, when nothing ran: "no evidence" is a different statement from
// "measured and failing", and ⚪ says so rather than implying a zero.
const testPct = (r) => (r.tests && r.tests.ran > 0 ? (r.tests.pass / r.tests.ran) * 100 : null);
// Every case node has for this module, skips included. null only when node ships
// no test for it at all, which is the one honest "no evidence" case: a module
// whose every case SKIPPED has evidence, and the evidence is that it is missing.
const allPct = (r) => {
  const n = (r.tests?.ran ?? 0) + (r.tests?.skipped ?? 0);
  return n > 0 ? (r.tests.pass / n) * 100 : null;
};
// Behaviour first, surface as the tiebreak. An unmeasured module sorts on its
// surface alone, below anything with a measured pass rate above zero, and a
// module that does not load sorts last whatever it exports.
function score(r) {
  if (!r.loads) return -100;
  // RANKED on all-selected, not on what ran, even though the cell displays the
  // ran-only rate. Ranking on ran-only let a module climb the table by
  // declining work: `tls` ran exactly one of its 188 cases, passed it, and
  // sorted top of the table at "100%" above modules passing a hundred cases
  // apiece. Skips belong in the denominator of an ORDERING for the same reason
  // they belong in the denominator of the headline.
  const t = allPct(r);
  // Unmeasured sorts BELOW a measured zero: "0 of 19 pass" is a stronger
  // statement than "nothing ran", and the bottom of the table should be where
  // the evidence runs out.
  if (t === null) return -50 + exportPct(r) / 100;
  return t * 100 + exportPct(r) / 100;
}
// Best first, so the table reads as a ladder from green down to red. Sorted on
// the pair (behaviour first, then surface): a module whose tests pass is further
// along than one that merely exports the names, and an unmeasured module sorts
// on its surface alone rather than being pushed to either end.
const ranked = [...rows].sort((a, b) => score(b) - score(a));

const testCell = (t) => {
  if (!t) return "no cases";
  if (t.ran === 0) return t.skipped > 0 ? `0 ran (${t.skipped} skipped)` : "no cases";
  return `${t.pass}/${t.ran} ${pct(t.pass, t.ran)}${t.skipped ? ` (+${t.skipped} skipped)` : ""}`;
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
lines.push("**The dot is the test pass rate.** That is the only column that says whether a");
lines.push("module WORKS: node's own `test-<area>-*.js` cases that pass, out of those that");
lines.push("ran. Skipped cases are counted separately and scored neither way.");
lines.push("");
lines.push(`🟢 90%+ · 🟡 60%+ · 🟠 30%+ · 🔴 below · ⚪ no case ran, so there is no`);
lines.push("evidence either way. Two caps: a module that does not load is 🔴 whatever its");
lines.push(`cases did, and under ${MIN_CASES} cases that ran the best available band is 🟠, because a`);
lines.push("handful of cases does not certify a module. Failing all of a small sample still");
lines.push("reads red: the cap is on the good end only.");
lines.push("");
lines.push("**Exports do not affect the dot.** A name that exists and does not work is worth");
lines.push("nothing, so the export count is here as the WORKLIST, not as a score: it says how");
lines.push("much of node's surface is missing and the last column names it. Read it after the");
lines.push("dot has told you the module is behind. `vm` exports all 10 of node's names and");
lines.push("fails two thirds of its cases, which is the whole reason this column stopped");
lines.push("voting.");
lines.push("");
if (peerLabel) {
  lines.push(`**The ${peerLabel} column is measured, not quoted.** Same corpus, same node`);
  lines.push("`test/common` harness, same per-case caps, produced by this repo's own sweep with");
  lines.push("`MILOJS_RUNTIME=$(which bun)`. It is here because a column of red says nothing on its");
  lines.push("own: it cannot tell you whether milojs is behind or whether node's suite is brutal.");
  lines.push("A shipping runtime on the identical files answers that, and the answer is often that");
  lines.push("the suite is brutal — modules that vendor tables mark fully-implemented do not score");
  lines.push("100% here either.");
  lines.push("");
  lines.push("Read the two cells against each other only through their skip counts. Where milojs");
  lines.push("skipped and the peer did not, milojs's denominator is smaller and its rate is");
  lines.push("flattered; the whole-suite line under the table is the comparable form.");
  lines.push("");
}
lines.push(`Reference surface: node ${snapshot.node.version}` +
  (report ? `. Sweep at \`${(report.milojs?.revision ?? "").slice(0, 8)}\`` : "") + ".");
lines.push("");
lines.push(`| | module | tests |${peerLabel ? ` ${peerLabel} |` : ""} exports | missing exports |`);
lines.push(`|---|---|---|${peerLabel ? "---|" : ""}---|---|`);
for (const r of ranked) {
  const miss = r.missing.slice(0, 6).map((x) => `\`${x}\``).join(", ")
    + (r.missing.length > 6 ? ` +${r.missing.length - 6} more` : "");
  const name = r.loads ? `\`${r.module}\`` : `\`${r.module}\` **(does not load)**`;
  lines.push(`| ${dot(r)} | ${name} | ${testCell(r.tests)} |${peerLabel ? ` ${testCell(r.peer)} |` : ""}` +
    ` ${r.covered}/${r.wanted} ${pct(r.covered, r.wanted)} | ${miss || "none"} |`);
}
lines.push("");

const totalWanted = rows.reduce((a, r) => a + r.wanted, 0);
const totalCovered = rows.reduce((a, r) => a + r.covered, 0);
const notLoading = rows.filter((r) => !r.loads).map((r) => r.module);
const bandCount = Object.fromEntries(BANDS.map((b) => [b, 0]));
for (const r of rows) bandCount[dot(r)]++;
const ranTotal = rows.reduce((a, r) => a + (r.tests?.ran ?? 0), 0);
const passTotal = rows.reduce((a, r) => a + (r.tests?.pass ?? 0), 0);
lines.push(`Across all ${rows.length} modules: **${passTotal}/${ranTotal} node cases pass (${pct(passTotal, ranTotal)})**, ` +
  BANDS.map((b) => `${b} ${bandCount[b]}`).join(", ") +
  `. Surface: ${totalCovered}/${totalWanted} exports present (${pct(totalCovered, totalWanted)}).`);
if (report) {
  const t = report.totals;
  lines.push("");
  lines.push(`Whole suite, every selected case counted: **${t.pass}/${t.total} (${pct(t.pass, t.total)})**` +
    (peer ? `, against ${peerLabel} at **${peer.totals.pass}/${peer.totals.total} (${pct(peer.totals.pass, peer.totals.total)})**` : "") +
    `. This is the number to quote. The per-module column above is scored against what RAN, which forgives` +
    ` whatever an engine declines: milojs skips ${t.skipped} cases` +
    (peer
      ? ` and ${peerLabel.split(" ")[0]} skips ${peer.totals.skipped}, so the two ran-only rates are not comparable to each other.`
      : `, so that rate rises and falls with how much milojs is able to attempt.`));
}
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
