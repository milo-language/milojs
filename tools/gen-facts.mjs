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
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const p = (...xs) => join(ROOT, ...xs);

const lines = (f) => readFileSync(f, "utf8").split("\n").length - 1;
const listing = (dir, ext) =>
  existsSync(p(dir)) ? readdirSync(p(dir)).filter((f) => f.endsWith(ext)) : [];
const totalLines = (dir, ext) =>
  listing(dir, ext).reduce((n, f) => n + lines(p(dir, f)), 0);

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

  // --- host surface ---
  // status.md hand-counts "Ten of 64 Node-API entry points are honest stubs".
  // The 64 is derivable and agrees. The 10 is NOT: nothing in src/napi.milo marks
  // a stub, so the split is a human judgement with no machine-readable basis.
  // Mechanizing it needs a marker convention first (a `// STUB:` line on each
  // shimmed entry point, then count those) — that is domain work, not tooling
  // work, so the number stays hand-maintained and unmarked until someone does it
  // rather than being published wrong from a guess at the source.
  "napi-entry-points": () => String(napiEntryPoints()),

  "node-modules-shimmed": () =>
    String(
      new Set(
        (readFileSync(p("src/modules.milo"), "utf8").match(/@embedFile\("\.\.\/lib\/([a-z_-]+)\.js"\)/g) || [])
      ).size
    ),
};

function napiEntryPoints() {
  const src = readFileSync(p("src/napi.milo"), "utf8");
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

const argv = process.argv.slice(2);
if (argv.includes("--list")) {
  for (const [name, fn] of Object.entries(FACTS)) console.log(`${name.padEnd(24)} ${fn()}`);
  process.exit(0);
}
const CHECK = argv.includes("--check");

let stale = 0, rewrote = 0, unknown = 0, marked = 0;

for (const rel of DOCS) {
  const file = p(rel);
  if (!existsSync(file)) continue;
  const before = readFileSync(file, "utf8");
  const after = before.replace(RE, (whole, name, current) => {
    marked++;
    const fn = FACTS[name];
    if (!fn) {
      console.error(`UNKNOWN  ${rel}: no fact named "${name}"`);
      unknown++;
      return whole;
    }
    const want = fn();
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
