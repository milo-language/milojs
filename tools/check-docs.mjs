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
//   key-files cover   — the staleness check below is only as good as the list it
//                       watches, and that list is chosen by the doc itself. The
//                       roadmap declared src/milojs.milo and src/milojs-engine.milo
//                       while its only in-progress stage was fourteen paragraphs
//                       about src/engine/bytecode.milo. bytecode.milo moved three
//                       hours after the roadmap was last verified and the gate
//                       stayed green, because it was watching two files the stage
//                       does not touch. So: every src/, lib/, bench/ or scripts/
//                       path a doc names in its BODY must be in its key-files.
//   tables match      — the AGENTS.md tools table said "if you build a tool it
//                       belongs in this table", and was itself missing two tools.
//   last-verified     — a hand-typed date that nothing compared against anything.
//                       Now compared against the commit date of the doc's own
//                       key-files, AND against whether the doc itself was touched
//                       at or after that commit. The date is the human assertion
//                       that someone read it; the commit order is what catches a
//                       same-day move, which a hand-typed date cannot express and
//                       which is exactly how the roadmap drifted (verified 02:53,
//                       key-file moved 06:30, same date, green).
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

// Repo paths a doc's prose names, restricted to the trees whose CONTENTS the doc
// is making claims about. tools/ is deliberately excluded: every doc names
// tools/dev.sh, and naming a command you are told to run is not the same as
// describing an implementation. Only paths that exist count, so a path typo is
// the NO-FILE check's problem and not reported twice here.
const SUBJECT_TREES = /\b(?:src|lib|bench|scripts)\/[A-Za-z0-9_.\/-]+\.(?:milo|js|ts|mjs|sh)\b/g;

function namedInBody(rel, metaBlockLength) {
  const body = readFileSync(p(rel), "utf8").slice(metaBlockLength);
  return [...new Set([...body.matchAll(SUBJECT_TREES)].map((m) => m[0]))]
    .filter((f) => existsSync(p(f)))
    .sort();
}

function meta(rel) {
  const src = readFileSync(p(rel), "utf8");
  const m = src.match(/^<!--\s*doc-meta\n([\s\S]*?)-->/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  // Where the prose starts, so the coverage check does not read the doc's own
  // key-files line back as evidence that it named the file.
  out.metaLength = m[0].length;
  return out;
}

// Has this path got uncommitted changes? A doc being edited in the working tree is
// mid-update, and failing it would make the pre-commit hook complain about the very
// edit that fixes it.
function dirtyInTree(rel) {
  try {
    return execFileSync("git", ["status", "--porcelain", "--", rel], {
      encoding: "utf8", cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0;
  } catch { return false; }
}

// A shallow clone answers "HEAD" for every path, because HEAD is the only commit
// it has. That does not read as an error anywhere: `git log -1 -- <path>` prints
// a perfectly good timestamp, every doc looks touched at once, and the gate goes
// from "did this doc's subject move" to "is HEAD newer than this doc's
// last-verified date" without saying a word about it. CI's default checkout is
// depth 1, so that is where it happened. Refuse instead.
function shallow() {
  try {
    return execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
      encoding: "utf8", cwd: ROOT, stdio: ["ignore", "pipe", "ignore"],
    }).trim() === "true";
  } catch { return false; }
}
if (shallow()) {
  console.error("check-docs: this is a SHALLOW clone, so git cannot say when a doc's key-files last moved.");
  console.error("  Every path would answer HEAD and the staleness ratchet would measure the commit date instead.");
  console.error("  Fetch full history (actions/checkout with fetch-depth: 0, or `git fetch --unshallow`).");
  process.exit(2);
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

  // The staleness check is only as sharp as key-files, and key-files is
  // self-declared. A doc that writes fourteen paragraphs about a file it does not
  // watch has opted itself out of the gate without saying so.
  const declared = new Set(keyFiles);
  for (const f of namedInBody(rel, m.metaLength)) {
    if (!declared.has(f)) {
      console.error(
        `NO-WATCH ${rel}: the body describes ${f}, which is not in its key-files, ` +
        `so the staleness check cannot see that file move`
      );
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

  // Freshness takes TWO signals, because either one alone has a hole a real drift
  // has already gone through.
  //
  //   the date  — a human asserting they read it. Day granularity is all a
  //               hand-typed field can carry, and the roadmap drift was 3.5 hours
  //               wide: verified 02:53, key-file moved 06:30, same date, green.
  //   the order — did the doc get touched at or after the code did. Git knows this
  //               to the second and nobody types it. This is what catches
  //               same-day, and it is satisfied for free by the workflow AGENTS.md
  //               already asks for: update the doc in the SAME commit.
  //
  // Neither replaces the other. Order alone would accept a whitespace commit as
  // re-verification; the date alone accepted a doc whose subject moved four hours
  // after someone last read it.
  // A GENERATED doc cannot answer this check, and does not need to. Its content
  // is a function of its key-files, so when they move and the derived output is
  // unchanged there is nothing to edit and no date to bump — it is stale for
  // ever through no fault of anyone's. Its own generator's --check already
  // proves it is in step, and proves it harder than an edit-time heuristic can:
  // it regenerates and compares byte for byte.
  const generated = /^generated\b/i.test(m["update-when"] ?? "");
  const touched = generated ? null : lastTouched(keyFiles.filter((f) => f !== rel));
  if (touched) {
    const touchedDay = touched.slice(0, 10);
    // A doc with uncommitted edits is being written right now — that IS the
    // same-commit update, seen before the commit exists.
    const docMoved = dirtyInTree(rel) ? "9999" : lastTouched([rel]);
    const staleByOrder = !docMoved || docMoved < touched;
    const staleByDate = touchedDay > verified;
    if (staleByDate || staleByOrder) {
      stale.push({
        rel,
        verified,
        touched: touchedDay,
        why: staleByDate ? "not re-verified since" : "not edited since",
        at: staleByOrder && !staleByDate ? touched.slice(0, 16) : touchedDay,
      });
    }
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
    console.log(`stale    ${s.rel} (key-files moved ${s.at}, ${s.why} ${s.verified}) — known, in the baseline`);
  } else {
    console.error(`STALE    ${s.rel}: key-files last moved ${s.at}, ${s.why} ${s.verified}`);
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
