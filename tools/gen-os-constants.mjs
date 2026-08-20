// The POSIX and OpenSSL constant tables, harvested from node PER RELEASE TARGET.
//
// node:constants is a flat merge of os.constants (errno, signals, priority,
// dlopen), fs.constants and crypto.constants — 231 names, and the numbers behind
// them are not portable: EAGAIN is 35 on darwin and 11 on linux, every O_* flag
// differs, and each platform has names the other does not (O_SYMLINK is darwin,
// O_NOATIME is linux). Typing them by hand is how this repo got a darwin errno
// table and a linux O_* table in the same runtime, both unverifiable, while the
// binary it ships runs on linux.
//
// Keyed by platform AND arch, because "linux" is not one answer: on aarch64
// O_DIRECTORY is 0o40000, O_NOFOLLOW 0o100000 and O_DIRECT 0o200000, while on
// x86_64 the same three are 0o200000, 0o400000 and 0o40000. A table harvested
// in an arm64 container and filed under "linux" shipped those to x86_64 and CI
// caught it. The keys are the release targets: darwin-arm64, linux-x64,
// linux-arm64.
//
// So they are harvested from the node on PATH and committed per target:
//
//   node tools/gen-os-constants.mjs            # harvest THIS target, merge, write
//   node tools/gen-os-constants.mjs --emit     # print this target's table (for a container/runner)
//   node tools/gen-os-constants.mjs --merge f  # fold an --emit capture from another target in
//   node tools/gen-os-constants.mjs --check    # this target's committed table still matches node,
//                                              # and lib/os-constants.js still matches the JSON
//
// --check is the half that matters: the hook runs it on the dev's target and the
// CI `constants` job runs it on all three release targets, so every table is
// verified against real node on that exact platform+arch rather than trusted.
// A failing --check in CI uploads its own --emit capture, so re-harvesting a
// target you do not own is `gh run download` plus `--merge`.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import os from "os";
import fs from "fs";
import crypto from "crypto";
import { createRequire } from "module";

// require(), not `import ... from "constants"`: CJS is what the runtime serves.
const legacyConstants = createRequire(import.meta.url)("constants");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = join(ROOT, "docs/conformance/os-constants.json");
const JS_OUT = join(ROOT, "lib/os-constants.js");
const argv = process.argv.slice(2);
const arg = (n) => (argv.indexOf(n) >= 0 ? argv[argv.indexOf(n) + 1] : null);
const check = argv.includes("--check");

// Sorted so the output is a diff, not a shuffle: node hands these back in
// whatever order its bindings built them.
const table = (o) => Object.fromEntries(Object.keys(o ?? {}).sort().map((k) => [k, o[k]]));

// The store key and the runtime's own lookup key. process.arch already speaks
// the release-target spelling (x64, arm64), so this is exactly the tarball name.
const targetOf = (platform, arch) => `${platform}-${arch}`;

// crypto.constants carries strings (defaultCipherList, defaultCoreCipherList)
// among the numbers; they are constants like the rest and belong in the table.
function harvest() {
  return {
    target: targetOf(process.platform, process.arch),
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    errno: table(os.constants.errno),
    signals: table(os.constants.signals),
    priority: table(os.constants.priority),
    dlopen: table(os.constants.dlopen),
    fs: table(fs.constants),
    crypto: table(crypto.constants),
    // node:constants is harvested as its own module rather than merged from the
    // three above, because node's copy is not a plain union: it grows
    // defaultCipherList once crypto has been initialised in the process, so a
    // merge rule would have to encode a load-order quirk. This file imports
    // crypto, so what is captured is the fully-populated form.
    legacy: table(legacyConstants),
  };
}

if (argv.includes("--emit")) {
  process.stdout.write(JSON.stringify(harvest(), null, 2) + "\n");
  process.exit(0);
}

const SCHEMA_VERSION = 2;
const store = existsSync(JSON_OUT)
  ? JSON.parse(readFileSync(JSON_OUT, "utf-8"))
  : { schemaVersion: SCHEMA_VERSION, targets: {} };

// schema 1 keyed by bare platform. Those entries cannot be migrated by renaming
// them: the arch they were harvested on is exactly the fact they failed to
// record. Drop them and re-harvest, rather than guess an arch onto numbers.
if (store.schemaVersion !== SCHEMA_VERSION) {
  store.schemaVersion = SCHEMA_VERSION;
  store.targets = {};
  delete store.platforms;
}
store.targets ??= {};

const mergeFile = arg("--merge");
if (mergeFile) {
  const incoming = JSON.parse(readFileSync(mergeFile, "utf-8"));
  if (!incoming.target || !incoming.platform || !incoming.arch) {
    console.error(`gen-os-constants: ${mergeFile} has no "target" field — produce it with --emit`);
    process.exit(2);
  }
  store.targets[incoming.target] = incoming;
  writeFileSync(JSON_OUT, JSON.stringify(store, null, 2) + "\n");
  console.log(`gen-os-constants: merged ${incoming.target} (node ${incoming.node}) into ${JSON_OUT}`);
}

const here = harvest();
const committed = store.targets[here.target];

// The generated module. Every target's table ships in the binary and the running
// process picks: a runtime cross-compiled on one and run on another would
// otherwise carry the builder's numbers, which is the bug this file exists to
// end. Falls back to linux-x64 for a target no table covers, because a missing
// table would fail at require() rather than at the one constant that is wrong.
function emitJs() {
  const names = Object.keys(store.targets).sort();
  const lines = [];
  lines.push("// GENERATED by tools/gen-os-constants.mjs. Do not edit.");
  lines.push("//");
  lines.push("// The POSIX and OpenSSL constant tables for every target this runtime ships");
  lines.push("// to, harvested from node on each one. `--check` gates the table for whichever");
  lines.push("// platform+arch it runs on, so every table is verified against real node rather");
  lines.push("// than transcribed. linux-x64 and linux-arm64 are separate tables because the");
  lines.push("// O_* flags genuinely differ between them.");
  lines.push("//");
  for (const p of names) {
    lines.push(`//   ${p}: node ${store.targets[p].node}`);
  }
  lines.push("");
  lines.push("var TABLES = {");
  for (const p of names) {
    const t = store.targets[p];
    lines.push(`  ${JSON.stringify(p)}: {`);
    for (const group of ["errno", "signals", "priority", "dlopen", "fs", "crypto", "legacy"]) {
      const entries = Object.entries(t[group] ?? {});
      lines.push(`    ${group}: {`);
      for (const [k, v] of entries) {
        lines.push(`      ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
      }
      lines.push("    },");
    }
    lines.push("  },");
  }
  lines.push("};");
  lines.push("");
  lines.push("// `typeof process` rather than process.platform: the ENGINE binary runs");
  lines.push("// lib/crypto.js with no process global at all, and a bare reference here");
  lines.push("// threw ReferenceError before crypto could load. Falls back to linux-x64,");
  lines.push("// which is right for the OpenSSL half (identical everywhere) and irrelevant");
  lines.push("// for the POSIX half, since the engine has no filesystem or signals to name.");
  lines.push("var P = typeof process !== \"undefined\" && process.platform;");
  lines.push("var T = (P && TABLES[P + \"-\" + process.arch]) || TABLES[\"linux-x64\"];");
  lines.push("");
  lines.push("exports.errno = T.errno;");
  lines.push("exports.signals = T.signals;");
  lines.push("exports.priority = T.priority;");
  lines.push("exports.dlopen = T.dlopen;");
  lines.push("exports.fs = T.fs;");
  lines.push("exports.crypto = T.crypto;");
  lines.push("");
  lines.push("// os.constants is the nested shape; node's tests index the groups directly.");
  lines.push("exports.os = {");
  lines.push("  errno: T.errno,");
  lines.push("  signals: T.signals,");
  lines.push("  priority: T.priority,");
  lines.push("  dlopen: T.dlopen,");
  lines.push("};");
  lines.push("");
  lines.push("// node:constants, as node itself exports it once crypto is loaded. Harvested");
  lines.push("// as a module rather than merged from the tables above: node's copy grows");
  lines.push("// defaultCipherList only after crypto initialises, and a merge rule would have");
  lines.push("// to encode that load-order quirk.");
  lines.push("exports.flat = T.legacy;");
  lines.push("");
  return lines.join("\n");
}

const js = emitJs();

if (check) {
  if (!committed) {
    console.error(`gen-os-constants: ${JSON_OUT} has no table for ${here.target} — run \`node tools/gen-os-constants.mjs\` on it`);
    process.exit(1);
  }
  let bad = 0;
  for (const group of ["errno", "signals", "priority", "dlopen", "fs", "crypto", "legacy"]) {
    const a = committed[group] ?? {}, b = here[group];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (a[k] !== b[k]) {
        console.error(`gen-os-constants: ${here.target} ${group}.${k}: committed ${JSON.stringify(a[k])}, node ${JSON.stringify(b[k])}`);
        if (++bad >= 8) break;
      }
    }
    if (bad >= 8) break;
  }
  if (bad) {
    console.error(`gen-os-constants: the ${here.target} table no longer matches node ${here.node} — re-run \`node tools/gen-os-constants.mjs\` on ${here.target}`);
    process.exit(1);
  }
  const current = existsSync(JS_OUT) ? readFileSync(JS_OUT, "utf-8") : "";
  if (current !== js) {
    console.error("gen-os-constants: lib/os-constants.js is stale against docs/conformance/os-constants.json — re-run `node tools/gen-os-constants.mjs`");
    process.exit(1);
  }
  const others = Object.keys(store.targets).filter((p) => p !== here.target);
  console.log(`gen-os-constants: ${here.target} table matches node ${here.node} ` +
    `(${Object.keys(here.errno).length} errno, ${Object.keys(here.signals).length} signals, ` +
    `${Object.keys(here.fs).length} fs, ${Object.keys(here.crypto).length} crypto); ` +
    `${others.length ? `${others.join(", ")} carried from a harvest there` : "no other target recorded"}`);
} else {
  if (!mergeFile) {
    store.targets[here.target] = here;
    writeFileSync(JSON_OUT, JSON.stringify(store, null, 2) + "\n");
  }
  writeFileSync(JS_OUT, emitJs());
  console.log(`gen-os-constants: wrote ${JSON_OUT} and lib/os-constants.js ` +
    `(${Object.keys(store.targets).sort().join(", ")})`);
}
