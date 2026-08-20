// bun's PUBLISHED compatibility table, captured as evidence.
//
// This is the one input here that is asserted rather than measured: bun's page
// is hand-maintained, and its 🟢 means "we implemented this module", not "node's
// cases pass". Capturing it lets gen-node-compat.mjs put that claim next to the
// measurement of the same bun binary on the same files, which is the only way to
// answer "bun says green and we beat bun, so why are we not green?" without
// anyone re-deriving it by hand.
//
// Needs network, so it is manual like the sweeps, not CI. --check refetches and
// fails if the committed capture has drifted.
//
// Usage: node tools/gen-bun-claims.mjs [--check]
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/conformance/bun-claims.json");
const SOURCE = "https://bun.sh/docs/runtime/nodejs-compat";
const check = process.argv.includes("--check");

const STATUS = { "🟢": "full", "🟡": "partial", "🔴": "none" };

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`gen-bun-claims: ${SOURCE} returned ${res.status}`);
  process.exit(2);
}
const html = await res.text();

// Each module is an <h3> containing <code>node:NAME</code>, and its status is the
// emoji opening the paragraph that follows.
//
// Anchored on that inline <code>, NOT on the heading's slug: bun slugifies
// `node:async_hooks` to id="node-async-hooks", so matching the slug and reading
// the name out of it silently dropped every underscored module (async_hooks,
// child_process, diagnostics_channel, perf_hooks, string_decoder,
// worker_threads) and produced a capture that looked complete. The <code> holds
// the real specifier.
const claims = {};
for (const m of html.matchAll(/<h3\b[^>]*>(.*?)<\/h3>/gs)) {
  const name = m[1].match(/<code>node:([a-z_0-9]+)<\/code>/);
  if (!name) continue;  // a section heading ("Node.js globals"), not a module
  const rest = html.slice(m.index + m[0].length);
  const p = rest.match(/<p>\s*(🟢|🟡|🔴)/);
  const h3 = rest.search(/<h3\b/);
  // Only take a status that belongs to THIS heading: if the next <h3> comes
  // first, this module has no status paragraph and is recorded as unknown
  // rather than inheriting its neighbour's.
  claims[name[1]] = (p && (h3 === -1 || p.index < h3)) ? STATUS[p[1]] : "unknown";
}

const found = Object.keys(claims).length;
// Two floors, because the first capture passed a count check while missing six
// modules. The count catches a parser that broke outright; the unknown check
// catches one that still matches headings but no longer finds their status.
const unknown = Object.entries(claims).filter(([, v]) => v === "unknown").map(([k]) => k);
if (found < 40 || unknown.length) {
  console.error(
    `gen-bun-claims: parsed ${found} modules` +
    (unknown.length ? `, ${unknown.length} with no status (${unknown.join(", ")})` : "") +
    ": the page markup changed. Fix the parser rather than committing a thin capture.");
  process.exit(2);
}

// The page states which node it tracks but never which bun it describes, so the
// capture cannot be pinned to a version. Recording that explicitly keeps a
// reader from assuming it lines up with the measured peer binary.
const targets = html.match(/compatibility with <em>Node\.js ([^<]+)<\/em>/);

const capture = {
  schemaVersion: 1,
  source: SOURCE,
  note: "hand-maintained by bun; 🟢 asserts implemented, not that node's cases pass. The page names no bun version.",
  tracksNode: targets ? targets[1] : null,
  modules: Object.fromEntries(Object.keys(claims).sort().map((k) => [k, claims[k]])),
};
const text = JSON.stringify(capture, null, 2) + "\n";

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf-8") : "";
  if (current !== text) {
    console.error("gen-bun-claims: docs/conformance/bun-claims.json no longer matches the published page — run `node tools/gen-bun-claims.mjs`");
    process.exit(1);
  }
  console.log(`gen-bun-claims: ${found} modules checked, capture matches the published page`);
} else {
  writeFileSync(OUT, text);
  const n = (s) => Object.values(claims).filter((v) => v === s).length;
  console.log(`gen-bun-claims: wrote ${OUT} (${found} modules: ${n("full")} full, ${n("partial")} partial, ${n("none")} none)`);
}
