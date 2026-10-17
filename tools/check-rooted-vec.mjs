// Ratchet on bare `Vec<JSValue>` in src/engine/*.milo.
//
// A Vec<JSValue> local keeps its elements in malloc'd memory, which the conservative stack
// scan cannot see, so a collection while it is live frees objects it holds. The cure is
// RootedVec (src/engine/rooted.milo). The type checker cannot enforce it, so this does:
//
//   * src/.rooted-vec-exempt lists legitimate sites (fields of structures collect() walks),
//     each with the reason. A listed site that no longer exists fails (the list only shrinks).
//   * every other occurrence is counted per file against tools/rooted-vec-baseline.txt.
//     More than the baseline fails and names the new lines; FEWER than the baseline fails
//     too, until the baseline is lowered, so the ratchet tightens and cannot rot.
//   * src/engine/rooted.milo is the definition and is not scanned.
//
// Anti-vacuity: fails if it saw fewer than MIN_SEEN occurrences, so a changed pattern or
// directory cannot turn this into a gate that checks nothing and exits 0.
//
// Usage: node tools/check-rooted-vec.mjs
import { readFileSync, readdirSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";

const ROOT = ".";
const NEEDLE = "Vec<JSValue>";
const MIN_SEEN = 100;
const SKIP = new Set(["src/engine/rooted.milo"]);

const meta = (p) => readFileSync(join(ROOT, p), "utf-8").split("\n");
const data = (p) => meta(p).map((l) => l.replace(/^\s*#.*/, "").trim()).filter(Boolean);

// exempt: file -> Map(trimmed line -> [reason...]) consumed one occurrence at a time
const exempt = new Map();
for (const l of data("src/.rooted-vec-exempt")) {
  const [file, text, ...why] = l.split("|").map((s) => s.trim());
  if (!file || !text || !why.join("|").trim()) { console.error(`rooted-vec: bad exempt line (need file | line | reason): ${l}`); process.exit(1); }
  if (!exempt.has(file)) exempt.set(file, new Map());
  exempt.get(file).set(text, (exempt.get(file).get(text) ?? 0) + 1);
}
const baseline = new Map(data("tools/rooted-vec-baseline.txt").map((l) => { const [f, n] = l.split(/\s+/); return [f, Number(n)]; }));

const dir = join(ROOT, "src/engine");
const files = readdirSync(dir).filter((f) => f.endsWith(".milo")).map((f) => `src/engine/${f}`).sort();
let seen = 0, failed = false;
const rows = [];
for (const file of files) {
  if (SKIP.has(file)) continue;
  const left = new Map(exempt.get(file) ?? []);
  const bare = [];
  readFileSync(join(ROOT, file), "utf-8").split("\n").forEach((raw, i) => {
    const code = raw.replace(/\/\/.*$/, "");
    const n = code.split(NEEDLE).length - 1;
    if (!n) return;
    seen += n;
    const t = raw.trim();
    if (left.get(t) > 0) { left.set(t, left.get(t) - 1); return; }
    for (let k = 0; k < n; k++) bare.push({ line: i + 1, text: t });
  });
  for (const [t, c] of left) if (c > 0) { failed = true; console.error(`FAIL ${file}: exempt entry matches no line (remove it from src/.rooted-vec-exempt): ${t}`); }
  const base = baseline.get(file) ?? 0;
  rows.push([file, bare.length, base]);
  if (bare.length > base) {
    failed = true;
    let added = [];
    try {
      added = execFileSync("git", ["-C", ROOT, "diff", "HEAD", "-U0", "--", file], { encoding: "utf-8" })
        .split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++") && l.includes(NEEDLE)).map((l) => l.slice(1).trim());
    } catch {}
    console.error(`FAIL ${file}: ${bare.length} bare ${NEEDLE} > baseline ${base}. Use RootedVec (src/engine/rooted.milo), or if it is a field the collector traces, register it in src/.rooted-vec-exempt.`);
    const named = bare.filter((b) => added.includes(b.text));
    for (const b of (named.length ? named : bare)) console.error(`  ${file}:${b.line}: ${b.text}${named.length ? "   <- new" : ""}`);
  } else if (bare.length < base) {
    failed = true;
    console.error(`FAIL ${file}: ${bare.length} bare ${NEEDLE} < baseline ${base}. Lower tools/rooted-vec-baseline.txt to ${bare.length} so the ratchet tightens.`);
  }
}
for (const f of baseline.keys()) if (!files.includes(f)) { failed = true; console.error(`FAIL baseline names a file that does not exist: ${f}`); }
if (seen < MIN_SEEN) { failed = true; console.error(`FAIL scanned only ${seen} ${NEEDLE} occurrences (< ${MIN_SEEN}); the scan is vacuous`); }
const total = rows.reduce((a, r) => a + r[1], 0);
const nEx = [...exempt.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0);
if (!failed) console.log(`rooted-vec: ${total} bare ${NEEDLE} ratcheted (${rows.filter((r) => r[1]).map((r) => `${r[0].split("/").pop()} ${r[1]}`).join(", ")}), ${nEx} exempt, ${seen} seen`);
process.exit(failed ? 1 : 0);
