// test262 conformance sweep for milojs-engine — a citeable ECMAScript number.
//
// Runs official tc39/test262 cases through the engine with the real harness
// (assert.js + sta.js + declared includes), honoring frontmatter: negative
// tests must fail with the right error, async tests must print the completion
// marker, onlyStrict/raw are respected. module tests are skipped (no ESM in the
// engine). Default (non-strict-tagged) tests run once in sloppy mode — a proxy
// that slightly under/over-counts strict-only cases; noted in the output.
//
//   bun scripts/test262-sweep.ts --sample 3000      # random sample, whole suite
//   bun scripts/test262-sweep.ts --dir built-ins/Array
//   bun scripts/test262-sweep.ts --sample 2000 -v   # also list failing files
//   bun scripts/test262-sweep.ts --sample 1500          # writes docs/conformance/test262.json
//   bun scripts/test262-sweep.ts --sample 1500 --json other.json
//
// The report is COMMITTED evidence. After a sweep, run `node tools/gen-facts.mjs`
// so the numbers in status.md/README are recompiled from it, and commit both.
import { readdirSync, readFileSync, writeFileSync, statSync, mkdtempSync, mkdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { homedir } from "node:os";

// The report is committed evidence, so it must not carry the machine it was
// measured on. An absolute path under $HOME is also what the pre-commit
// home-path check rejects, which made the report uncommittable.
const tilde = (x: string) => (x.startsWith(homedir()) ? "~" + x.slice(homedir().length) : x);
import { tmpdir } from "os";

const T262 = process.env.TEST262 ?? "/tmp/test262";
const HARNESS = join(T262, "harness");
const ENGINE = process.env.MILOJS_ENGINE ?? ".dev/mj-engine";
// A missing engine makes every single case "crash", which reads as a catastrophic
// conformance regression instead of as a setup mistake. Say what actually happened.
if (!existsSync(ENGINE)) {
  console.error(`test262-sweep: engine not found at ${ENGINE}\n` +
    `  build it first (tools/dev.sh), or set MILOJS_ENGINE.`);
  process.exit(2);
}
const verbose = process.argv.includes("-v");
const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const sampleN = arg("--sample") ? parseInt(arg("--sample")!) : null;
const subDir = arg("--dir") ?? "";
const limit = arg("--limit") ? parseInt(arg("--limit")!) : Infinity;
// A --dir or --limit run is a DIAGNOSTIC, not the published number, and writing
// it to the committed report silently republished "built-ins/Date, 60.8%" as the
// whole-suite figure the README cites. Only a full or sampled whole-suite run
// may claim that path; anything narrower goes to .dev/ unless --json says
// otherwise.
const isCanonical = !subDir && limit === Infinity;
const jsonPath = arg("--json") ?? (isCanonical ? "docs/conformance/test262.json" : ".dev/test262-partial.json");
// Every failing case with its reason, one JSON object per line. The bucket
// listing above truncates at 8 examples per bucket, which is enough to name a
// cluster and not enough to work one; this is the full set.
const failsPath = arg("--fails");


// The published score has to be traceable to something committed, not to a file
// under .dev/ that is gitignored and reaped. Default the report into the repo:
// running a sweep now produces the evidence, and `node tools/gen-facts.mjs`
// compiles that evidence into the numbers the docs quote. Recording WHICH milojs
// commit produced it is the other half — a score with no engine revision cannot
// be told apart from a score measured forty commits ago.
function selfRevision(): { revision: string | null; dirty: boolean } {
  try {
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    // docs/conformance is where the reports themselves land, so a run that has
    // already written one would otherwise report the NEXT sweep as dirty and
    // make it impossible to produce both reports from one clean checkout.
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.includes("docs/conformance"))
      .length > 0;
    return { revision, dirty };
  } catch { return { revision: null, dirty: false }; }
}

function revision(dir: string): string | null {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], {
      encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

// deterministic sampling so a number is reproducible across runs
let seed = 0x2f6e2b1;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// harness includes are small and reused constantly — cache them
const hcache = new Map<string, string>();
function harness(f: string): string {
  if (!hcache.has(f)) hcache.set(f, readFileSync(join(HARNESS, f), "utf-8"));
  return hcache.get(f)!;
}

type Meta = { includes: string[]; flags: Set<string>; negType: string | null; negPhase: string | null };
function parseMeta(src: string): Meta {
  const m = /\/\*---([\s\S]*?)---\*\//.exec(src);
  const fm = m ? m[1]! : "";
  const includes: string[] = [];
  const inc = /includes:\s*\[([^\]]*)\]/.exec(fm);
  if (inc) inc[1]!.split(",").forEach(s => { const t = s.trim(); if (t) includes.push(t); });
  // multi-line includes form
  const incBlock = /includes:\s*\n((?:\s*-\s*\S+\s*\n)+)/.exec(fm);
  if (incBlock) for (const l of incBlock[1]!.split("\n")) { const t = /-\s*(\S+)/.exec(l); if (t) includes.push(t[1]!); }
  const flags = new Set<string>();
  const fl = /flags:\s*\[([^\]]*)\]/.exec(fm);
  if (fl) fl[1]!.split(",").forEach(s => { const t = s.trim(); if (t) flags.add(t); });
  let negType: string | null = null, negPhase: string | null = null;
  const neg = /negative:\s*\n\s*phase:\s*(\S+)\s*\n\s*type:\s*(\S+)/.exec(fm);
  if (neg) { negPhase = neg[1]!; negType = neg[2]!; }
  return { includes, flags, negType, negPhase };
}

// gather every .js test under a dir (skipping fixtures + staging)
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "staging" && e !== "intl402") out.push(...walk(p)); }
    else if (e.endsWith(".js") && !e.endsWith("_FIXTURE.js")) out.push(p);
  }
  return out;
}

const root = join(T262, "test", subDir);
let files = walk(root);
// Before sampling. status.md publishes the pass rate off a 1500-case sample of a
// ~54k-file corpus, and without this the report cannot say what fraction that is
// — the reader sees "1169/1470" and has no way to know it is under 3% of the
// suite. AGENTS.md already warns that 15% of the node corpus cannot resolve a
// 10-case delta; the same caution has to be legible here.
const available = files.length;
if (sampleN && files.length > sampleN) {
  // Fisher-Yates partial shuffle with the seeded PRNG, take the first sampleN
  for (let i = 0; i < sampleN; i++) { const j = i + Math.floor(rand() * (files.length - i)); [files[i], files[j]] = [files[j]!, files[i]!]; }
  files = files.slice(0, sampleN);
}
files = files.slice(0, limit);

// The $262 host object test262 expects a runner to provide. Without it every
// detached-buffer case died on "$262 is not defined" before testing anything —
// they were counted as engine failures when nothing had been asked of the
// engine yet. detachArrayBuffer goes through ArrayBuffer.prototype.transfer,
// which is what actually detaches the source here.
const HOST_HOOK = `var $262 = {
  global: globalThis,
  detachArrayBuffer: function (buffer) { buffer.transfer(); },
  gc: function () {},
  agent: undefined,
};
`;

const tmp = mkdtempSync(join(tmpdir(), "t262-"));
const casePath = join(tmp, "case.js");

type Res = "pass" | "fail" | "skip";
function runOne(file: string): { res: Res; why: string } {
  const src = readFileSync(file, "utf-8");
  const meta = parseMeta(src);
  if (meta.flags.has("module")) return { res: "skip", why: "module" };
  if (meta.flags.has("CanBlockIsFalse") || meta.flags.has("CanBlockIsTrue")) return { res: "skip", why: "atomics-host" };

  let body = "";
  if (!meta.flags.has("raw")) {
    body += HOST_HOOK;
    body += harness("assert.js") + "\n" + harness("sta.js") + "\n";
    if (meta.flags.has("async")) body += harness("doneprintHandle.js") + "\n";
    for (const inc of meta.includes) { try { body += harness(inc) + "\n"; } catch { return { res: "skip", why: "missing-include:" + inc }; } }
  }
  const strict = meta.flags.has("onlyStrict");
  const source = (strict ? '"use strict";\n' : "") + (meta.flags.has("raw") ? src : body + src);
  writeFileSync(casePath, source);

  let out = "";
  let exitCode = 0;
  try {
    out = execFileSync(ENGINE, [casePath], { encoding: "utf-8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e: any) {
    // A signal death is a CRASH and is returned as one immediately, ahead of
    // whatever the case printed on its way down. Ordered the other way — output
    // first, signal only when the output was empty — a segfault that had managed
    // one line of stderr was filed under that line, and worse: `exitCode !== 0`
    // then reads as "the case threw", which is the PASS condition for a negative
    // test. Crashing scored points.
    // e.killed distinguishes the sweep's own timeout kill from the engine dying.
    if (e.signal && !e.killed) { crashes++; return { res: "fail", why: `crash(${e.signal})` }; }
    if (e.killed) return { res: "fail", why: `timeout(${e.signal ?? "?"})` };
    out = (e.stdout ?? "") + (e.stderr ?? "") || `exit(${e.status})`;
    exitCode = typeof e.status === "number" ? e.status : 1;
  }
  // "Did the case throw?" has to be answered the same way for EVERY engine, or a
  // cross-engine comparison is meaningless. milojs prints `Uncaught …` and still
  // exits 0; QuickJS prints a bare `ReferenceError: …` and exits 1. Detecting only
  // milojs's shape made every QuickJS runtime failure look like a pass and scored
  // qjs at 100% on an API it does not implement at all.
  const threw = /^Uncaught /m.test(out) || exitCode !== 0 ||
    /^(?:[A-Za-z_$][\w$]*Error|Test262Error)\b/m.test(out);

  if (meta.negType) {
    // negative test: must fail. parse-phase → any throw; runtime → matching type.
    if (!threw) return { res: "fail", why: `expected ${meta.negType}, nothing thrown` };
    if (meta.negPhase === "parse" || meta.negPhase === "early") return { res: "pass", why: "" };
    // the type may be reported as `Uncaught TypeError: …` (milojs) or as a bare
    // `TypeError: …` (QuickJS, node), so match the NAME anywhere in the output
    return new RegExp("\\b" + meta.negType + "\\b").test(out) ? { res: "pass", why: "" } : { res: "fail", why: `wanted ${meta.negType}: ${out.split("\n")[0]}` };
  }
  if (meta.flags.has("async")) {
    return out.includes("Test262:AsyncTestComplete") ? { res: "pass", why: "" } : { res: "fail", why: out.split("\n").find(l => l.trim()) ?? "no completion marker" };
  }
  if (threw) {
    const line = out.match(/^Uncaught .*/m)?.[0]
      ?? out.match(/^(?:[A-Za-z_$][\w$]*Error|Test262Error)\b.*/m)?.[0]
      ?? out.split("\n").find(l => l.trim())
      ?? `exit ${exitCode}`;
    return { res: "fail", why: line.slice(0, 100) };
  }
  return { res: "pass", why: "" };
}

function bucket(why: string): string {
  return why.split(tmp).join("").replace(/'[^']*'/g, "'…'").replace(/\b\d+\b/g, "N").slice(0, 90);
}

// A failure the parser caused is a MISSING SYNTAX FEATURE, not a wrong answer,
// and the two want different work. Unlike the QuickJS sweep this does not change
// the score: test262 is one case per file, so a parse gap costs exactly the cases
// that use it rather than taking a whole file down. It is reported as a breakdown
// of the failures so the syntax half of the gap is visible.
function isParseFailure(why: string): boolean {
  return /^milojs(-engine)?: [^\n]*: /.test(why) || /\bSyntaxError\b/.test(why);
}

let pass = 0, fail = 0, skip = 0, parseFail = 0;
// Counted apart from `fail`: a crash is the engine dying on input a user could
// write, not one more case scoring zero, and averaging it into a four-digit
// failure count is how it stayed invisible.
let crashes = 0;
const areaTotals = new Map<string, { p: number; f: number }>();
const buckets = new Map<string, string[]>();
const allFails: { file: string; why: string }[] = [];
// Per-case pass list, committed in the report: the conformance ratchet
// (tools/check-conformance-ratchet.mjs) compares its high-water pass set against
// this, so "previously passing case now fails" is detectable per case, not just
// as an aggregate that a +5/-5 swap would hide.
const passes: string[] = [];
const areaOf = (f: string) => { const rel = f.slice(root.length + 1); const parts = rel.split("/"); return subDir ? parts[0]! : parts.slice(0, 2).join("/"); };

let done = 0;
for (const file of files) {
  const { res, why } = runOne(file);
  if (res === "skip") { skip++; continue; }
  const a = areaOf(file);
  const t = areaTotals.get(a) ?? areaTotals.set(a, { p: 0, f: 0 }).get(a)!;
  if (res === "pass") { pass++; t.p++; passes.push(file.slice(root.length + 1)); }
  else { fail++; t.f++; if (isParseFailure(why)) parseFail++; const b = bucket(why); (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(file.slice(root.length + 1)); allFails.push({ file: file.slice(root.length + 1), why }); }
  if (++done % 500 === 0) process.stderr.write(`  ${done}/${files.length}\r`);
}

const scored = pass + fail;
if (crashes > 0) console.log(`\n!! ${crashes} case(s) killed the engine with a signal`);
console.log(`\ntest262-sweep: ${pass}/${scored} pass (${((pass / scored) * 100).toFixed(1)}%), ${skip} skipped (module/atomics), of ${files.length} sampled${subDir ? " in " + subDir : " across the whole suite"}`);
console.log(`engine: ${ENGINE}  (default tests run sloppy-only; onlyStrict honored)`);
if (parseFail > 0) {
  console.log(`  of the ${fail} failures, ${parseFail} (${((parseFail / fail) * 100).toFixed(1)}%) are PARSE failures: missing syntax, not a wrong answer.`);
}
console.log();

console.log("by area:");
for (const [a, t] of [...areaTotals.entries()].sort((x, y) => (y[1].p + y[1].f) - (x[1].p + x[1].f)).slice(0, 25)) {
  const tot = t.p + t.f;
  console.log(`  ${((t.p / tot) * 100).toFixed(0).padStart(3)}%  ${String(t.p).padStart(4)}/${String(tot).padEnd(4)}  ${a}`);
}
console.log("\ntop failure buckets:");
for (const [b, cs] of [...buckets.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, verbose ? 999 : 20)) {
  console.log(`  ${String(cs.length).padStart(4)}  ${b}`);
  if (verbose) console.log(`        ${cs.slice(0, 8).join(", ")}${cs.length > 8 ? " …" : ""}`);
}

if (failsPath) {
  writeFileSync(failsPath, allFails.map(f => JSON.stringify(f)).join("\n") + "\n");
  console.log(`wrote ${failsPath} (${allFails.length} failures)`);
}

if (jsonPath) {
  const report = {
    schemaVersion: 1,
    suite: "test262",
    corpus: { path: tilde(T262), revision: revision(T262) },
    milojs: selfRevision(),
    engine: tilde(ENGINE),
    selection: {
      directory: subDir || null,
      available,
      sample: sampleN,
      limit: Number.isFinite(limit) ? limit : null,
      seed: sampleN ? "0x2f6e2b1" : null,
    },
    totals: { pass, fail, parseFail, skip, scored, selected: files.length, crashes },
    passes: passes.sort(),
    areas: [...areaTotals.entries()]
      .map(([area, t]) => ({ area, pass: t.p, fail: t.f, total: t.p + t.f }))
      .sort((a, b) => b.total - a.total || a.area.localeCompare(b.area)),
    failureBuckets: [...buckets.entries()]
      .map(([reason, cases]) => ({ reason, count: cases.length, cases }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
  mkdirSync(jsonPath.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nwrote ${jsonPath}`);
}
