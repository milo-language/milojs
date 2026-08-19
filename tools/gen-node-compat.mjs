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

let nodeSide, miloSide;
try {
  nodeSide = probe("node");
} catch (e) {
  console.error(`gen-node-compat: could not probe node itself: ${e.message}`);
  process.exit(2);
}
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
  rows.push({
    module: m,
    loads: j.ok,
    wanted: wanted.size,
    covered,
    missing,
    tests: area ? { pass: area.pass, ran: area.total - (area.skipped ?? 0), skipped: area.skipped ?? 0 } : null,
  });
}

// Ranked by what is missing, so the table opens on the work rather than on the
// alphabet.
const ranked = [...rows].sort((a, b) => {
  if (a.loads !== b.loads) return a.loads ? 1 : -1;
  return (b.wanted - b.covered) - (a.wanted - a.covered);
});

const pct = (a, b) => (b === 0 ? "—" : `${((a / b) * 100).toFixed(0)}%`);
const testCell = (t) => {
  if (!t) return "—";
  if (t.ran === 0) return t.skipped > 0 ? `0/0 (${t.skipped} skipped)` : "—";
  return `${t.pass}/${t.ran}${t.skipped ? ` (+${t.skipped} skipped)` : ""}`;
};

const lines = [];
lines.push("<!-- doc-meta");
lines.push("system: node-compat");
lines.push("purpose: per-module Node compatibility, derived from an export diff against node and from the test sweep");
lines.push("key-files: tools/gen-node-compat.mjs, docs/conformance/node-compat.json, lib/");
lines.push("update-when: generated — run `node tools/gen-node-compat.mjs`; never edit by hand");
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
lines.push("- **exports** — how many of the names `node:<module>` exports under node also exist");
lines.push("  under milojs. A high number here means the SURFACE is present, not that it works.");
lines.push("- **tests** — node's own `test-<area>-*.js` cases that pass, out of those that ran.");
lines.push("  Skipped cases are counted separately and scored neither way.");
lines.push("");
lines.push(`Measured against node ${process.version}` + (report ? `, sweep at \`${(report.milojs?.revision ?? "").slice(0, 8)}\`` : "") + ".");
lines.push("");
lines.push("| module | loads | exports | tests | notable missing exports |");
lines.push("|---|---|---|---|---|");
for (const r of ranked) {
  const miss = r.missing.slice(0, 6).map((x) => `\`${x}\``).join(", ")
    + (r.missing.length > 6 ? ` +${r.missing.length - 6} more` : "");
  lines.push(`| \`${r.module}\` | ${r.loads ? "yes" : "**no**"} | ${r.covered}/${r.wanted} ${pct(r.covered, r.wanted)} | ${testCell(r.tests)} | ${miss || "—"} |`);
}
lines.push("");

const totalWanted = rows.reduce((a, r) => a + r.wanted, 0);
const totalCovered = rows.reduce((a, r) => a + r.covered, 0);
const notLoading = rows.filter((r) => !r.loads).map((r) => r.module);
lines.push(`Across all ${rows.length} modules: **${totalCovered}/${totalWanted} exports present (${pct(totalCovered, totalWanted)})**.`);
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
