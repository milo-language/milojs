#!/usr/bin/env node
// Compiles the facts that prose quotes about this repo, and checks the prose
// still agrees with them.
//
//   node tools/gen-facts.mjs           # rewrite every marked span in place
//   node tools/gen-facts.mjs --check   # fail if any span is stale (CI / hook)
//   node tools/gen-facts.mjs --list    # print every fact and its current value
//
// A fact is marked in Markdown like this:
//
//   about <!--fact:loc-milo-->34.1k<!--/fact--> lines of Milo
//
// The comments are invisible when rendered, so the prose reads normally and the
// number stops being something a human has to remember to update.
//
// Why this exists: README, AGENTS.md and docs/status.md each carried a DIFFERENT
// line count for the same tree (30.5k / 26.5k / 35.2k against an actual 34.1k),
// and the fixture counts in status.md were two low. Three commits before this one
// were hand-fixes to exactly this class of drift. Nothing here is hard to compute
// — it was only ever hard to remember.
//
// Adding a fact: add an entry to FACTS, wrap the number in prose with its
// markers, run without --check. An unknown fact name is an error, not a no-op,
// so a renamed fact fails loudly instead of leaving a stale value in place.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const p = (...xs) => join(ROOT, ...xs);

const lines = (f) => readFileSync(f, "utf8").split("\n").length - 1;
const listing = (dir, ext) =>
  existsSync(p(dir)) ? readdirSync(p(dir)).filter((f) => f.endsWith(ext)) : [];
// Recursive: src/ gained engine/ and runtime/ subdirectories in the layering
// split, and a flat readdir would have silently reported the three entry points
// as the whole engine.
const listingDeep = (dir, ext) =>
  existsSync(p(dir))
    ? readdirSync(p(dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? listingDeep(join(dir, e.name), ext).map((f) => join(e.name, f))
          : e.name.endsWith(ext) ? [e.name] : []
      )
    : [];
const totalLines = (dir, ext) =>
  listingDeep(dir, ext).reduce((n, f) => n + lines(p(dir, f)), 0);

// Rounded to one decimal in thousands, which is how the prose says it. Anything
// finer would churn the docs on every commit and train everyone to ignore it.
const k = (n) => (n / 1000).toFixed(1) + "k";

const FACTS = {
  // --- size ---
  "loc-milo": () => k(totalLines("src", ".milo")),
  "loc-js": () => k(totalLines("lib", ".js")),
  "loc-total": () => k(totalLines("src", ".milo") + totalLines("lib", ".js")),

  // --- test surface ---
  "fixtures-engine": () => String(listing("tests", ".js").length),
  "fixtures-runtime": () => String(listing("tests/runtime", ".js").length),
  "fixtures-milo": () => String(listing("tests/milo", ".milo").length),
  "fixtures-milo-errors": () => String(listing("tests/milo-errors", ".milo").length),
  // The exemptions are the hole in the node-oracle gate, so their count is a
  // number worth publishing rather than hiding.
  "fixtures-node-exempt": () => {
    const f = p("tests/.node-oracle-exempt");
    if (!existsSync(f)) return "0";
    return String(
      readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#")).length
    );
  },

  // --- layering ---
  // AGENTS.md says how many host natives the ENGINE binary installs. That number
  // is the size of the hole in "the engine is the language and nothing else", so
  // it is worth stating, and it moves whenever bootstrap.milo does. Derived from
  // the same ledger tools/check-layering.sh gates against.
  "layering-host-globals": () =>
    String(
      readFileSync(p("src/.layering-exempt"), "utf8")
        .split("\n")
        .filter((l) => /^global:.*\shost-native\s/.test(l)).length
    ),
  "layering-exempt-edges": () =>
    String(
      readFileSync(p("src/.layering-exempt"), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("#") && / -> /.test(l)).length
    ),

  // --- host surface ---
  // status.md hand-counts "Ten of 64 Node-API entry points are honest stubs".
  // The 64 is derivable and agrees. The 10 is NOT: nothing in src/runtime/napi.milo marks
  // a stub, so the split is a human judgement with no machine-readable basis.
  // Mechanizing it needs a marker convention first (a `// STUB:` line on each
  // shimmed entry point, then count those) — that is domain work, not tooling
  // work, so the number stays hand-maintained and unmarked until someone does it
  // rather than being published wrong from a guess at the source.
  "napi-entry-points": () => String(napiEntryPoints()),

  // --- conformance ---
  // These come from a COMMITTED report written by the sweep, never from prose.
  // The published 45.2% previously had no artifact behind it at all: the only
  // machine-readable file on disk lived under a gitignored .dev/ and said
  // something else entirely, and nobody could tell which was real.
  "t262-pct": () => pct(report("test262").totals.pass, report("test262").totals.scored),
  "t262-pass": () => String(report("test262").totals.pass),
  "t262-scored": () => String(report("test262").totals.scored),
  "t262-skipped": () => String(report("test262").totals.skip),
  "t262-sample": () => String(report("test262").selection.sample),
  "t262-seed": () => String(report("test262").selection.seed),
  "t262-corpus": () => short(report("test262").corpus.revision),
  "qjs-pct": () => pct(report("quickjs").totals.pass, report("quickjs").totals.total ?? report("quickjs").totals.scored),
  // The node-compat sweep measures the RUNTIME against node's own test/parallel
  // suite. It is a different axis from test262, which measures the ENGINE, and
  // the docs say so where they quote it.
  "node-pass": () => String(report("node-compat").totals.pass),
  "node-total": () => String(report("node-compat").totals.total),
  // Scored against what RAN, not against every file. A test that calls
  // common.skip() declined to run: counting it as a pass inflated this number
  // by 19 points, and counting it as a failure would understate it by as much.
  "node-ran": () => String(report("node-compat").totals.ran),
  "node-skipped": () => String(report("node-compat").totals.skipped),
  "node-pct": () => pct(report("node-compat").totals.pass, report("node-compat").totals.ran),
  // THE HEADLINE. Scored against every selected case, skips included in the
  // denominator, which is the only form that is monotone in progress: a skip
  // leaves the ran-only denominator, so a subsystem milojs cannot attempt is
  // forgiven rather than counted. 606 of the current skips are one gap
  // ("missing crypto"), and shipping crypto makes them RUN and mostly fail, so
  // node-pct falls while the runtime got strictly better. node-pct-all rises.
  // Quote this one anywhere a number is compared to another engine or to an
  // older milojs; node-pct is the secondary "of what we attempt".
  "node-pct-all": () => pct(report("node-compat").totals.pass, report("node-compat").totals.total),
  // The peer column. Same corpus, same harness, same caps, measured rather than
  // quoted from a vendor's table — see docs/conformance/node-compat-peer.json.
  "node-peer-name": () => peerName(),
  "node-peer-pass": () => String(report("node-compat-peer").totals.pass),
  "node-peer-total": () => String(report("node-compat-peer").totals.total),
  "node-peer-skipped": () => String(report("node-compat-peer").totals.skipped),
  "node-peer-pct": () => pct(report("node-compat-peer").totals.pass, report("node-compat-peer").totals.ran),
  "node-peer-pct-all": () => pct(report("node-compat-peer").totals.pass, report("node-compat-peer").totals.total),
  "node-sample": () => String(report("node-compat").selection.sample ?? report("node-compat").totals.total),
  "node-available": () => String(report("node-compat").selection.available),
  "node-excluded": () => String(report("node-compat").selection.excludedNodeInternal),
  "qjs-pass": () => String(report("quickjs").totals.pass),
  "qjs-total": () => String(report("quickjs").totals.total ?? report("quickjs").totals.scored),
  "qjs-corpus": () => short(report("quickjs").corpus.revision),
  // Cases the engine could not PARSE, and the rate over the ones that actually
  // ran. Published alongside the headline so a missing syntax feature, which
  // takes a whole file with it, cannot read as a pile of unrelated failures.
  // test262's parse gaps do NOT amplify the way quickjs's do: one case per file
  // there, so a missing syntax feature costs exactly the cases that use it. The
  // count is published as a share of FAILURES, which is the number that says how
  // much of the gap is syntax rather than semantics.
  "t262-parsefail": () => String(report("test262").totals.parseFail ?? 0),
  "t262-fail": () => String(report("test262").totals.fail),
  "t262-parsefail-pct": () => pct(report("test262").totals.parseFail ?? 0, report("test262").totals.fail),
  "qjs-parsefail": () => String(report("quickjs").totals.parseFail ?? 0),
  "qjs-ran": () => String(report("quickjs").totals.ran ?? report("quickjs").totals.total),
  "qjs-ran-pct": () => pct(report("quickjs").totals.pass, report("quickjs").totals.ran ?? report("quickjs").totals.total),

  "node-modules-shimmed": () =>
    String(
      new Set(
        (readFileSync(p("src/runtime/modules.milo"), "utf8").match(/@embedFile\("(?:\.\.\/)+lib\/([a-z_-]+)\.js"\)/g) || [])
      ).size
    ),
};

// A fact that cannot be computed must FAIL, not be written. A missing field
// made this return "NaN%", and gen-facts wrote that straight into the README
// table — a published conformance score of NaN%, staged by the pre-commit hook,
// with nothing in the output saying anything had gone wrong.
const pct = (a, b) => {
  const v = (a / b) * 100;
  if (!Number.isFinite(v)) {
    throw new Error(`cannot compute a percentage from ${a}/${b} — the report is missing a field`);
  }
  return v.toFixed(1) + "%";
};
const short = (rev) => (rev ? rev.slice(0, 8) : "unknown");

// "bun 1.3.10", not "bun": a peer score nobody can pin to a version is not
// evidence, it is a rumour. Some runtimes already print their own name in
// --version output ("milojs 0.1.0 (dev …)"), so do not repeat it.
function peerName(suite = "node-compat-peer") {
  const r = report(suite);
  const bin = String(r.runtime ?? "peer").split("/").pop();
  const ver = String(r.runtimeVersion ?? "unknown");
  if (ver === "unknown") {
    throw new Error(
      `docs/conformance/${suite}.json records no runtimeVersion — re-run the sweep with a build ` +
      `of scripts/node-compat-sweep.ts that captures it, or the peer number cannot be cited.`
    );
  }
  return ver.toLowerCase().startsWith(bin.toLowerCase()) ? ver : `${bin} ${ver}`;
}

const reportCache = new Map();
function report(suite) {
  if (reportCache.has(suite)) return reportCache.get(suite);
  const f = p("docs/conformance", `${suite}.json`);
  if (!existsSync(f)) {
    throw new Error(
      `docs cite a ${suite} number but docs/conformance/${suite}.json does not exist. ` +
      `A published score needs committed evidence — run the sweep (see AGENTS.md §Conformance sweeps).`
    );
  }
  const r = JSON.parse(readFileSync(f, "utf8"));
  // A score measured on a dirty tree cannot be reproduced by anyone, including
  // the person who measured it, so it is not evidence and will not be published.
  if (r.milojs?.dirty) {
    throw new Error(`docs/conformance/${suite}.json was measured on a DIRTY tree; re-run the sweep from a clean checkout`);
  }
  reportCache.set(suite, r);
  return r;
}

// Not a fact — a note. How far the published score has drifted from HEAD is worth
// saying out loud, but gating on it would go red on every unrelated commit.
function reportAge(suite) {
  const f = p("docs/conformance", `${suite}.json`);
  if (!existsSync(f)) return null;
  const rev = JSON.parse(readFileSync(f, "utf8")).milojs?.revision;
  if (!rev) return null;
  try {
    const n = execFileSync("git", ["rev-list", "--count", `${rev}..HEAD`], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], cwd: ROOT,
    }).trim();
    return { rev: rev.slice(0, 8), behind: parseInt(n, 10) };
  } catch { return { rev: rev.slice(0, 8), behind: null }; }
}

function napiEntryPoints() {
  const src = readFileSync(p("src/runtime/napi.milo"), "utf8");
  const defs = new Set();
  for (const m of src.matchAll(/^\s*(?:pub\s+)?fn\s+(napi_[A-Za-z0-9_]+)/gm)) defs.add(m[1]);
  return defs.size;
}

const DOCS = [
  "README.md",
  "AGENTS.md",
  ...listing("docs", ".md").map((f) => join("docs", f)),
];

const RE = /<!--fact:([a-z0-9-]+)-->([\s\S]*?)<!--\/fact-->/g;

// A fact BLOCK is the same idea for content that is a table rather than a
// number: the whole body between the markers is regenerated. The failing-area
// table in status.md was hand-kept and went stale the moment any sweep moved,
// which is the drift this file exists to end.
const BLOCK_RE = /<!--fact-block:([a-z0-9-]+)-->([\s\S]*?)<!--\/fact-block-->/g;

// Where the remaining failures are, straight out of the committed report.
function areaTable() {
  const r = report("test262");
  const areas = (r.areas || []).filter((a) => a.fail > 0);
  areas.sort((a, b) => b.fail - a.fail);
  const rows = areas.slice(0, 8).map(
    (a) => `| \`${a.area}\` | ${a.fail} | ${a.pass}/${a.total} |`
  );
  return [
    "",
    "| area | failing | passing |",
    "|---|---:|---:|",
    ...rows,
    "",
  ].join("\n");
}

const BLOCKS = { "t262-areas": areaTable };

const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  for (const [name, fn] of Object.entries(FACTS)) {
    let v;
    try { v = fn(); } catch (e) { v = `(unavailable: ${e.message.split(".")[0]})`; }
    console.log(`${name.padEnd(24)} ${v}`);
  }
  process.exit(0);
}
const CHECK = argv.includes("--check");

let stale = 0, rewrote = 0, unknown = 0, marked = 0;

for (const rel of DOCS) {
  const file = p(rel);
  if (!existsSync(file)) continue;
  const before = readFileSync(file, "utf8");
  const withBlocks = before.replace(BLOCK_RE, (whole, name, current) => {
    marked++;
    const fn = BLOCKS[name];
    if (!fn) {
      console.error(`UNKNOWN  ${rel}: no fact block named "${name}"`);
      unknown++;
      return whole;
    }
    let want;
    try {
      want = fn();
    } catch (e) {
      console.error(`ERROR    ${rel}: ${name}: ${e.message}`);
      unknown++;
      return whole;
    }
    if (current === want) return whole;
    if (CHECK) {
      console.error(`STALE    ${rel}: fact block ${name} disagrees with the report`);
      stale++;
      return whole;
    }
    return `<!--fact-block:${name}-->${want}<!--/fact-block-->`;
  });
  const after = withBlocks.replace(RE, (whole, name, current) => {
    marked++;
    const fn = FACTS[name];
    if (!fn) {
      console.error(`UNKNOWN  ${rel}: no fact named "${name}"`);
      unknown++;
      return whole;
    }
    let want;
    try {
      want = fn();
    } catch (e) {
      console.error(`ERROR    ${rel}: ${name}: ${e.message}`);
      unknown++;
      return whole;
    }
    if (current === want) return whole;
    if (CHECK) {
      console.error(`STALE    ${rel}: ${name} says "${current}", tree says "${want}"`);
      stale++;
      return whole;
    }
    return `<!--fact:${name}-->${want}<!--/fact-->`;
  });
  if (after !== before) {
    writeFileSync(file, after);
    console.log(`rewrote  ${rel}`);
    rewrote++;
  }
}

for (const suite of ["test262", "quickjs"]) {
  const age = reportAge(suite);
  if (age?.behind) {
    console.log(`note: the ${suite} score was measured at ${age.rev}, ${age.behind} commit(s) before HEAD`);
  }
}

if (unknown) process.exit(1);
if (CHECK) {
  console.log(`gen-facts: ${marked} marked spans checked`);
  if (stale) {
    console.error("FAIL: prose disagrees with the tree — run `node tools/gen-facts.mjs`");
    process.exit(1);
  }
  console.log("every marked fact matches the tree");
} else {
  console.log(`gen-facts: ${marked} marked spans, ${rewrote} file(s) rewritten`);
}
