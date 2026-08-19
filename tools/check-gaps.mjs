// Every "known limit" in docs/status.md, re-probed against the engine.
//
// The list had rotted badly: six of ten entries described gaps that had already
// been closed — BigInt64Array, duplicate declarations, direct eval, Temporal,
// own name/length on functions, and await's microtask ordering were all
// documented as missing while the engine implemented them. Prose about what is
// MISSING rots faster than any other prose in a repo, because closing a gap
// never touches the file that claims it is open.
//
// So the claims are executable. Each one is a probe that returns true while the
// gap is still real. A probe that returns false means the limit was fixed and
// the line has to come out of status.md — this exits non-zero and says so.
//
// Usage: node tools/check-gaps.mjs [--engine <path>]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const argEngine = process.argv.indexOf("--engine");
const ENGINE = argEngine >= 0 ? process.argv[argEngine + 1] : ".dev/mj-engine";

// id must match the <!--gap:id--> marker on the matching bullet in status.md.
// `probe` is JS evaluated in the engine; it returns true while the gap is real.
const GAPS = [
  { id: "float16", probe: `typeof Float16Array === "undefined"` },
  { id: "bigint64-from", probe: `typeof BigInt64Array.from !== "function"` },
  { id: "intl",
    probe: `new Date(0).toLocaleString("de-DE") === new Date(0).toLocaleString("en-US")` },
  { id: "regexp-symbols",
    probe: `(function(){ class R extends RegExp { [Symbol.match](){ return "CUSTOM"; } }
             return "abc".match(new R("b")) !== "CUSTOM"; })()` },
];

const dir = mkdtempSync(join(tmpdir(), "gaps-"));
const file = join(dir, "probe.js");
writeFileSync(file, GAPS.map((g) =>
  `try { console.log(${JSON.stringify(g.id)} + "=" + (!!(${g.probe}))); }\n` +
  `catch (e) { console.log(${JSON.stringify(g.id)} + "=ERR:" + e.message); }`
).join("\n"));

let out;
try {
  out = execFileSync(ENGINE, [file], { encoding: "utf-8" });
} catch (e) {
  console.error(`check-gaps: engine ${ENGINE} failed to run the probe\n${e.stdout || ""}${e.stderr || ""}`);
  process.exit(2);
}

const status = readFileSync("docs/status.md", "utf-8");
const results = new Map(out.trim().split("\n").map((l) => l.split("=")));
let bad = 0;

for (const g of GAPS) {
  const marker = `<!--gap:${g.id}-->`;
  const documented = status.includes(marker);
  const stillReal = results.get(g.id);
  if (stillReal === undefined || String(stillReal).startsWith("ERR:")) {
    console.error(`  BROKEN  ${g.id}: probe did not answer (${stillReal})`);
    bad++;
  } else if (stillReal === "true" && !documented) {
    console.error(`  MISSING ${g.id}: still a real gap but no ${marker} in docs/status.md`);
    bad++;
  } else if (stillReal === "false" && documented) {
    console.error(`  STALE   ${g.id}: FIXED, delete the ${marker} bullet from docs/status.md`);
    bad++;
  } else if (stillReal === "false" && !documented) {
    // The fourth case, and the one that used to fall through silently: the gap is
    // fixed AND its bullet is already gone, so nothing here can ever fire again.
    // That is a DEAD probe, and leaving it made the summary lie, counting it among
    // the limits reported as "still real". Two were sitting here when this landed:
    // `atomics` and `date-utc-only`, both fixed, both already undocumented.
    console.error(`  DEAD    ${g.id}: fixed and no longer documented, delete its entry from tools/check-gaps.mjs`);
    bad++;
  }
}

// a marker in the doc with no probe here is how the list silently grows stale again
for (const m of status.matchAll(/<!--gap:([a-z0-9-]+)-->/g)) {
  if (!GAPS.some((g) => g.id === m[1])) {
    console.error(`  UNCHECKED ${m[1]}: documented as a gap with no probe in tools/check-gaps.mjs`);
    bad++;
  }
}

if (bad > 0) {
  console.error(`\ncheck-gaps: ${bad} problem(s). The limits list is a claim about the engine; keep it true.`);
  process.exit(1);
}
// Count what is actually DOCUMENTED rather than how many probes exist: the two
// differ exactly when a probe has gone dead, which is the case above.
const documentedCount = GAPS.filter((g) => status.includes(`<!--gap:${g.id}-->`)).length;
console.log(`check-gaps: ${documentedCount} documented limits, all still real`);
