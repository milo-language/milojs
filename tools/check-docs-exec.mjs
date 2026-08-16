#!/usr/bin/env node
// Runs the examples in the docs and diffs them against the output the docs claim.
//
//   MILOJS_ENGINE_BIN=.dev/mj-engine MILOJS_RUNTIME_BIN=.dev/mj-runtime \
//     node tools/check-docs-exec.mjs
//
// A README example is the first thing anyone runs and the last thing anyone
// re-runs. Marking one executable makes it a fixture:
//
//   <!-- exec -->
//   ```sh
//   printf 'console.log(1 + 1)\n' > hello.js
//   ./milojs-engine hello.js
//   ```
//
//   ```text
//   2
//   ```
//
// The ```text block immediately after the command block is the assertion. Blocks
// with no <!-- exec --> marker are ignored: most recipes here download release
// tarballs or drive a full LLVM build, and re-running those in a doc check would
// cost more than the suites that already cover them.
//
// Each block runs in its own temp directory with ./milojs-engine and ./milojs
// symlinked in, so the command line in the doc is the command line that runs —
// no rewriting, or the doc and the test drift apart again, which is the whole
// problem this is here to solve.

import { readFileSync, readdirSync, existsSync, mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const p = (...xs) => join(ROOT, ...xs);

const ENGINE = resolve(ROOT, process.env.MILOJS_ENGINE_BIN ?? ".dev/mj-engine");
const RUNTIME = resolve(ROOT, process.env.MILOJS_RUNTIME_BIN ?? ".dev/mj-runtime");

for (const [name, bin] of [["engine", ENGINE], ["runtime", RUNTIME]]) {
  if (!existsSync(bin)) {
    console.error(`check-docs-exec: no ${name} binary at ${bin} — build first (tools/dev.sh)`);
    process.exit(2);
  }
}

const FILES = ["README.md", "AGENTS.md", ...readdirSync(p("docs")).filter((f) => f.endsWith(".md")).map((f) => join("docs", f))];

// <!-- exec --> then a command fence then the expected-output fence.
const BLOCK = /<!--\s*exec\s*-->\s*\n```(?:sh|bash)\n([\s\S]*?)```\s*\n+```text\n([\s\S]*?)```/g;

let ran = 0, failed = 0;

for (const rel of FILES) {
  const file = p(rel);
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(BLOCK)) {
    const [, script, expected] = m;
    ran++;
    const dir = mkdtempSync(join(tmpdir(), "milojs-doc-"));
    try {
      symlinkSync(ENGINE, join(dir, "milojs-engine"));
      symlinkSync(RUNTIME, join(dir, "milojs"));
      let got;
      try {
        got = execFileSync("bash", ["-eo", "pipefail", "-c", script], {
          cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000,
        });
      } catch (e) {
        got = (e.stdout ?? "") + (e.stderr ?? "");
      }
      const norm = (s) => s.replace(/\s+$/, "");
      if (norm(got) === norm(expected)) {
        console.log(`ok    ${rel}: ${script.trim().split("\n").pop()}`);
      } else {
        console.error(`FAIL  ${rel}\n  ran:\n${script.replace(/^/gm, "    ")}  expected:\n${expected.replace(/^/gm, "    ")}  got:\n${got.replace(/^/gm, "    ")}`);
        failed++;
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

// The embed example's output is asserted for real in tests/run-embed.sh. The
// README prints its own copy of that string, which is a transcription and will
// rot on its own schedule unless something ties the two together.
const readme = readFileSync(p("README.md"), "utf8");
const embedLine = readme.match(/^hello from embedded milo.*$/m)?.[0];
if (embedLine) {
  const suite = readFileSync(p("tests/run-embed.sh"), "utf8");
  if (!suite.includes(embedLine)) {
    console.error(`FAIL  README quotes embed output "${embedLine}", which tests/run-embed.sh does not assert`);
    failed++;
  } else {
    console.log(`ok    README embed output matches the string tests/run-embed.sh asserts`);
  }
}

console.log(`\ncheck-docs-exec: ${ran} executable example(s), ${failed} failing`);
process.exit(failed ? 1 : 0);
