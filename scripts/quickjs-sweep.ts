// QuickJS conformance sweep for milojs-engine.
//
// QuickJS's tests/*.js are each one file of `function test_xxx() { assert(...) }`
// definitions followed by a flat list of `test_xxx();` calls at the bottom. Running
// a whole file gives one pass/fail bit and stops at the first gap, which hides
// everything downstream. So we split: strip the trailing call list, then run the
// file body once per call. That yields a per-testcase pass rate that actually moves
// as gaps get filled, plus an error histogram to rank what to fix next.
//
//   bun scripts/quickjs-sweep.ts            # summary + top error buckets
//   bun scripts/quickjs-sweep.ts -v         # also list every failing case
//   bun scripts/quickjs-sweep.ts -f loop    # only files whose name matches
//   bun scripts/quickjs-sweep.ts                        # writes docs/conformance/quickjs.json
//   bun scripts/quickjs-sweep.ts --json other.json
//
// The report is COMMITTED evidence. After a sweep, run `node tools/gen-facts.mjs`
// so the numbers in status.md/README are recompiled from it, and commit both.
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, copyFileSync, mkdirSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
import { homedir } from "node:os";

// The report is committed evidence, so it must not carry the machine it was
// measured on. An absolute path under $HOME is also what the pre-commit
// home-path check rejects, which made the report uncommittable.
const tilde = (x: string) => (x.startsWith(homedir()) ? "~" + x.slice(homedir().length) : x);
import { tmpdir } from "os";

const QJS = process.env.QUICKJS_TESTS ?? join(process.env.HOME!, "git/quickjs/tests");
const ENGINE = process.env.MILOJS_ENGINE ?? ".dev/mj-engine";
// A missing engine makes every single case "crash", which reads as a catastrophic
// conformance regression instead of as a setup mistake. Say what actually happened.
if (!existsSync(ENGINE)) {
  console.error(`quickjs-sweep: engine not found at ${ENGINE}\n` +
    `  build it first (tools/dev.sh), or set MILOJS_ENGINE.`);
  process.exit(2);
}
const verbose = process.argv.includes("-v");
const filterIdx = process.argv.indexOf("-f");
const filter = filterIdx >= 0 ? process.argv[filterIdx + 1] : null;
const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const jsonPath = arg("--json") ?? "docs/conformance/quickjs.json";


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

// Tests that need host facilities the engine deliberately does not provide
// (std/os modules, workers, bjson) — out of scope, not conformance gaps.
const SKIP_FILES = new Set([
  "assert.js", "microbench.js", "test_std.js", "test_worker.js",
  "test_worker_module.js", "test_bjson.js",
  "fixture_cyclic_import.js", "fixture_string_exports.js", "fixture_throwing_module.js",
]);

// Cases run from a temp dir, but they import siblings ("./assert.js", the
// fixture_*.js modules), so the suite has to sit next to them or every relative
// import fails to resolve.
const tmp = mkdtempSync(join(tmpdir(), "qjs-sweep-"));
for (const f of readdirSync(QJS)) {
  if (f.endsWith(".js")) copyFileSync(join(QJS, f), join(tmp, f));
}

// The trailing invocation list: a bare call at column 0, optionally with a
// `.catch(...)` tail for the async cases.
const CALL_RE = /^([A-Za-z_$][\w$]*)\(\)\s*(\.catch\([^\n]*\))?\s*;?\s*$/;

type Case = { file: string; name: string; src: string };

// A few tests carry test262-style frontmatter declaring that throwing IS the pass
// condition. Scoring those by "did anything throw" marks a correct engine wrong.
//   /*---
//   negative:
//     phase: runtime
//     type: RangeError
//   ---*/
function negativeType(src: string): string | null {
  const m = /negative:\s*\n\s*phase:\s*\w+\s*\n\s*type:\s*(\w+)/.exec(src);
  return m ? m[1]! : null;
}

function casesFor(file: string): Case[] {
  const text = readFileSync(join(QJS, file), "utf-8");
  const lines = text.split("\n");
  const calls: { name: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = CALL_RE.exec(lines[i]!);
    if (m) calls.push({ name: m[1]!, line: i });
  }
  // Only treat as a suite when the calls cluster at the end of the file.
  const tail = calls.filter(c => c.line > lines.length * 0.5);
  if (tail.length < 2) return [{ file, name: "<whole>", src: text }];
  const first = tail[0]!.line;
  const body = lines.slice(0, first).join("\n");
  return tail.map(c => ({ file, name: c.name, src: `${body}\n${lines[c.line]}\n` }));
}

// Classify a failure into a bucket so the histogram ranks causes, not instances.
function bucket(out: string): string {
  const s = (out.trim().split("\n")[0] ?? "").split(tmp).join("");
  return s
    .replace(/\|[^|]*\|/g, "|…|")               // assert payloads
    .replace(/'[^']*'/g, "'…'")
    .replace(/\b\d+\b/g, "N")
    .slice(0, 120);
}

const files = readdirSync(QJS)
  .filter(f => f.endsWith(".js") && !SKIP_FILES.has(f))
  .filter(f => !filter || f.includes(filter))
  .sort();

// A case the engine could not PARSE is not the same result as one that ran and
// answered wrongly, and counting them together makes a missing syntax feature
// read as a pile of unrelated bugs. The parser prefixes its diagnostics with
// "milojs: <file>: " and nothing runs afterwards, which is what identifies them.
function isParseFailure(out: string): boolean {
  if (/^Uncaught /m.test(out)) return false;
  return /^milojs(-engine)?: [^\n]*: /m.test(out);
}

let pass = 0, fail = 0, parseFail = 0;
// Counted apart from `fail`: a crash is the engine dying on input a user could
// write, not one more case scoring zero.
let crashes = 0;
const buckets = new Map<string, string[]>();

for (const file of files) {
  for (const c of casesFor(file)) {
    const path = join(tmp, "case.js");
    writeFileSync(path, c.src);
    const want = negativeType(c.src);
    let out = "", ok = false;
    try {
      out = execFileSync(ENGINE, [path], { encoding: "utf-8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
      // The engine reports uncaught throws on stdout and still exits 0.
      const threw = /^Uncaught /m.exec(out);
      ok = want ? !!threw && threw.input.includes(want) : !threw;
      if (want && !ok) out = threw ? out : `expected uncaught ${want}, nothing thrown`;
    } catch (e: any) {
      // an uncaught JS exception exits 1, which lands here — for a negative
      // test that IS the pass condition when the type matches
      //
      // A signal death is a CRASH and short-circuits that: it is classified
      // before the output is looked at. Ordered the other way, a segfault that
      // had printed one line went into the bucket for that line, and a segfault
      // during a NEGATIVE test could even satisfy the "did it throw" condition.
      // e.killed separates the sweep's own timeout kill from the engine dying.
      if (e.signal && !e.killed) { crashes++; out = `crash(${e.signal})`; ok = false; }
      else if (e.killed) { out = `timeout(${e.signal ?? "?"})`; ok = false; }
      else {
        out = (e.stdout ?? "") + (e.stderr ?? "") || `exit(${e.status})`;
        if (want && new RegExp(`^Uncaught .*${want}`, "m").test(out)) ok = true;
        else if (want) out = `expected uncaught ${want}, got ${out.trim()}`;
      }
    }
    if (ok) pass++;
    else {
      if (isParseFailure(out)) parseFail++;
      else fail++;
      const b = bucket(out);
      (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(`${file}:${c.name}`);
    }
  }
}

const total = pass + fail + parseFail;
if (crashes > 0) console.log(`\n!! ${crashes} case(s) killed the engine with a signal`);
console.log(`quickjs-sweep: ${pass}/${total} cases pass (${((pass / total) * 100).toFixed(1)}%) across ${files.length} files`);
if (parseFail > 0) {
  const ran = pass + fail;
  console.log(
    `  ${parseFail} of those never RAN: the engine could not parse the source. ` +
    `Of the ${ran} that ran, ${pass} pass (${((pass / ran) * 100).toFixed(1)}%).`);
  console.log("  A parse gap is one missing syntax feature taking a whole file with it, not N separate bugs.");
}
console.log();
const ranked = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
console.log("top causes:");
for (const [b, cases] of ranked.slice(0, verbose ? 999 : 25)) {
  console.log(`  ${String(cases.length).padStart(3)}  ${b}`);
  if (verbose) console.log(`       ${cases.join(", ")}`);
}

if (jsonPath) {
  const report = {
    schemaVersion: 1,
    suite: "quickjs",
    corpus: { path: tilde(QJS), revision: revision(QJS) },
    milojs: selfRevision(),
    engine: tilde(ENGINE),
    selection: { filter, skippedFiles: [...SKIP_FILES].sort() },
    totals: { pass, fail, parseFail, total, ran: pass + fail, files: files.length, crashes },
    failureBuckets: ranked.map(([reason, cases]) => ({ reason, count: cases.length, cases })),
  };
  mkdirSync(jsonPath.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nwrote ${jsonPath}`);
}
