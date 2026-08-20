// The process EXIT STATUS, differential against node.
//
// This is not cosmetic. node-compat-sweep scores a case by its exit code: 0 is a
// pass. The runtime dropped the parser's error flag and exited 0, so every node
// test milojs could not PARSE was counted as passing — the conformance number
// was crediting files the runtime never ran. `process.exitCode = N` and an
// unhandled rejection had the same shape: printed, then exit 0.
//
// node is the oracle and is run live, so the expectations cannot drift from it.
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";

// Absolute: the cases run with cwd set to a temp dir, so a relative binary
// path would fail to spawn and every case would report the same wrong status.
const RUNTIME = resolve(process.env.MILOJS_RUNTIME ?? ".dev/mj-runtime");
const CASES = {
  clean: 'console.log("ok");',
  syntax: "if (1) {",
  throwUncaught: 'throw new Error("x");',
  exitExplicit: "process.exit(3);",
  exitCodeProperty: "process.exitCode = 4;",
  rejectUnhandled: 'Promise.reject(new Error("nope"));',
  asyncThrow: '(async () => { throw new Error("a"); })();',
  requireMissing: 'require("./nope-does-not-exist.js");',
  requireSyntax: 'require("./syntax.js");',
};

const dir = mkdtempSync(join(tmpdir(), "exitcodes-"));
for (const [name, src] of Object.entries(CASES)) writeFileSync(join(dir, `${name}.js`), src + "\n");

function status(bin, args, file) {
  try {
    execFileSync(bin, [...args, file], { cwd: dir, stdio: "ignore", timeout: 30_000 });
    return 0;
  } catch (e) {
    if (e.signal) return `signal ${e.signal}`;
    return e.status ?? 1;
  }
}

let bad = 0;
for (const name of Object.keys(CASES)) {
  const file = `${name}.js`;
  const want = status("node", [], file);
  const got = status(RUNTIME, [], file);
  if (want !== got) {
    console.error(`check-exit-codes: ${name} — node exits ${want}, milojs exits ${got}`);
    bad++;
  }
}
rmSync(dir, { recursive: true, force: true });
if (bad) {
  console.error("An exit status the sweep reads as success is a case scored as a pass.");
  process.exit(1);
}
console.log(`check-exit-codes: ${Object.keys(CASES).length} case(s) match node`);
