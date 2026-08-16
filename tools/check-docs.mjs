#!/usr/bin/env node
// Structural gate on the docs. Everything here is checkable by running it, which
// is the point: "keep the docs current" was a request, and requests are not gates.
//
//   node tools/check-docs.mjs              # fail on any finding
//   node tools/check-docs.mjs --baseline   # re-record the staleness ratchet
//
// Four checks, each earned by something that was actually wrong in this tree:
//
//   doc-meta present  — AGENTS.md says every doc opens with one. backlog.md, the
//                       most-edited doc in the repo, had none.
//   key-files exist   — three docs pointed at paths that do not exist
//                       (std/arena, std/runtime.milo, a fixture that moved).
//   tables match      — the AGENTS.md tools table said "if you build a tool it
//                       belongs in this table", and was itself missing two tools.
//   last-verified     — a hand-typed date that nothing compared against anything.
//                       Now compared against the commit date of the doc's own
//                       key-files: if the code moved after the doc was last
//                       verified, the doc is stale by definition.
//
// The staleness half is a RATCHET, not a cliff. tools/verify-contracts.sh already
// works this way and for the same reason: gating the whole existing backlog would
// make the check un-landable, so the current stale set is recorded in
// tools/docs-staleness.txt and only a NEW stale doc fails. Re-verify a doc, bump
// its last-verified, drop it from the baseline — the list only shrinks.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const p = (...xs) => join(ROOT, ...xs);
const BASELINE = p("tools/docs-staleness.txt");
const REBASELINE = process.argv.includes("--baseline");

const docs = readdirSync(p("docs")).filter((f) => f.endsWith(".md")).map((f) => join("docs", f));
let fail = 0;
const stale = [];

function meta(rel) {
  const src = readFileSync(p(rel), "utf8");
  const m = src.match(/^<!--\s*doc-meta\n([\s\S]*?)-->/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

// Last commit that touched any of the doc's own key-files. That is the moment the
// doc's subject matter moved; anything the doc asserts predates it.
function lastTouched(paths) {
  const real = paths.filter((f) => existsSync(p(f)));
  if (!real.length) return null;
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", ...real], {
      encoding: "utf8", cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch { return null; }
}

for (const rel of docs) {
  const m = meta(rel);
  if (!m) {
    console.error(`NO-META  ${rel} has no doc-meta block (AGENTS.md says every doc opens with one)`);
    fail = 1;
    continue;
  }
  for (const key of ["key-files", "update-when", "last-verified"]) {
    if (!m[key]) {
      console.error(`NO-KEY   ${rel}: doc-meta is missing "${key}"`);
      fail = 1;
    }
  }
  const keyFiles = (m["key-files"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const f of keyFiles) {
    // std/* names the Milo standard library, which lives outside this repo.
    if (f.startsWith("std/")) continue;
    if (!existsSync(p(f))) {
      console.error(`NO-FILE  ${rel}: key-files names ${f}, which does not exist`);
      fail = 1;
    }
  }

  // last-verified may carry a parenthetical note after the date; take the date.
  const verified = (m["last-verified"] ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!verified) {
    console.error(`BAD-DATE ${rel}: last-verified "${m["last-verified"]}" does not start with YYYY-MM-DD`);
    fail = 1;
    continue;
  }
  const touched = lastTouched(keyFiles);
  if (touched && touched.slice(0, 10) > verified) {
    stale.push({ rel, verified, touched: touched.slice(0, 10) });
  }
}

// --- AGENTS.md tables must name everything on disk ---
const agents = readFileSync(p("AGENTS.md"), "utf8");
// Only executables. tools/ also holds data the tools read (the staleness
// baseline), which is not something the table should document.
for (const tool of readdirSync(p("tools")).sort().filter((f) => /\.(sh|mjs)$/.test(f))) {
  if (!agents.includes(`tools/${tool}`)) {
    console.error(`NO-ROW   AGENTS.md tools table does not mention tools/${tool}`);
    fail = 1;
  }
}
for (const doc of docs) {
  if (!agents.includes(doc)) {
    console.error(`NO-ROW   AGENTS.md docs table does not mention ${doc}`);
    fail = 1;
  }
}

// --- the install snippet must name assets the release job actually builds ---
// The README tells people to construct a download URL from `uname`. If the release
// matrix gains or loses a platform, that snippet silently starts 404ing for whoever
// is on it, and nothing in the repo connects the two.
{
  const release = readFileSync(p(".github/workflows/release.yml"), "utf8");
  const built = new Set([...release.matchAll(/^\s*target:\s*(\S+)\s*$/gm)].map((m) => m[1]));
  const readme = readFileSync(p("README.md"), "utf8");
  // What the README's `uname` expression yields on each platform it claims support
  // for. Kept as data rather than parsed out of the snippet: the check is whether
  // the two sets agree, and a table makes the disagreement readable.
  const derived = new Map([
    ["darwin-arm64", "macOS arm64"],
    ["linux-x64", "Linux x64"],
    ["linux-arm64", "Linux arm64"],
  ]);
  for (const t of built) {
    if (!derived.has(t)) {
      console.error(`NO-DOC   release.yml builds milojs-${t}, which the README install snippet cannot produce`);
      fail = 1;
    }
  }
  for (const [t, label] of derived) {
    if (!built.has(t)) {
      console.error(`NO-BUILD README's install snippet yields milojs-${t} (${label}), which release.yml does not build`);
      fail = 1;
    }
  }
  if (!readme.includes("milojs-$P.tar.gz")) {
    console.error("NO-SNIP  README install snippet no longer builds a milojs-$P.tar.gz URL; update tools/check-docs.mjs");
    fail = 1;
  }
}

// --- staleness ratchet ---
if (REBASELINE) {
  const body =
    "# Docs whose key-files moved after their last-verified date.\n" +
    "# A RATCHET: tools/check-docs.mjs fails on a doc that goes stale and is not\n" +
    "# listed here. Re-verify the doc, bump its last-verified, delete its line.\n" +
    "# The list is only ever allowed to shrink. Re-record with --baseline.\n" +
    stale.map((s) => `${s.rel}\n`).join("");
  writeFileSync(BASELINE, body);
  console.log(`recorded ${stale.length} stale doc(s) in tools/docs-staleness.txt`);
  process.exit(0);
}

const allowed = new Set(
  existsSync(BASELINE)
    ? readFileSync(BASELINE, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : []
);
for (const s of stale) {
  if (allowed.has(s.rel)) {
    console.log(`stale    ${s.rel} (key-files moved ${s.touched}, verified ${s.verified}) — known, in the baseline`);
  } else {
    console.error(`STALE    ${s.rel}: key-files last moved ${s.touched}, doc last verified ${s.verified}`);
    fail = 1;
  }
}
for (const rel of allowed) {
  if (!stale.some((s) => s.rel === rel)) {
    console.error(`RATCHET  ${rel} is no longer stale; drop it from tools/docs-staleness.txt`);
    fail = 1;
  }
}

console.log(`\ncheck-docs: ${docs.length} docs, ${stale.length} stale (${allowed.size} baselined)`);
if (fail) console.error("FAIL: docs are out of step with the tree");
process.exit(fail);
