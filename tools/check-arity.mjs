#!/usr/bin/env node
// Checks the built-in `length` tables in src/eval.milo against node.
//
//   node tools/check-arity.mjs          # report disagreements, exit 1 on any
//   node tools/check-arity.mjs -v       # also print every name node has no answer for
//
// Three tables in src/eval.milo carry 402 hand-transcribed integers under a
// comment saying "GENERATED from node", but no generator was ever committed, so
// nothing could tell whether they still matched, or ever did. test262 asserts
// every one of them (there is a length.js per method), which makes each wrong
// integer a silent conformance failure that looks like an unrelated gap.
//
// This verifies rather than regenerates, deliberately: the tables are keyed by
// BARE METHOD NAME across every prototype, so a generator would have to invent a
// policy for the names that disagree (Number.prototype.toString is 1, everyone
// else's is 0). Verifying against the same policy the tables already document
// catches wrong values without letting a script silently redefine the contract.
//
// Policy, matching the comment in eval.milo: for a name defined on several
// builtins, the table holds the value the MAJORITY of them use. A name where the
// majority value differs from the table is a finding; a genuine tie is reported
// as ambiguous rather than as a failure.

import { readFileSync } from "node:fs";

const verbose = process.argv.includes("-v");
const src = readFileSync(new URL("../src/eval.milo", import.meta.url), "utf8");

// The three tables are `fn <name>ArityData(): string` returning one
// "name:arity,name:arity,..." literal. They used to be if-chains of
// `if n == "x" { return N }` and this parsed those; the shape changed when the
// chains became data, and an empty result is treated as a hard error rather
// than as "nothing to check" — a silently-empty table is exactly how this
// verifier stopped verifying once before.
function table(fn) {
  const m = src.match(new RegExp(`fn ${fn}\\(\\): string \\{\\n\\s*return "([^"]*)"`));
  if (!m) throw new Error(`${fn} not found in src/eval.milo`);
  const out = new Map(
    m[1].split(",").filter(Boolean).map(e => {
      const i = e.indexOf(":");
      if (i < 0) throw new Error(`${fn}: malformed entry ${JSON.stringify(e)}`);
      return [e.slice(0, i), Number(e.slice(i + 1))];
    })
  );
  if (out.size === 0) throw new Error(`${fn} parsed to an empty table`);
  return out;
}

// Every builtin constructor/namespace the engine models. Anything absent from the
// host is skipped rather than assumed.
const HOSTS = [
  "Object", "Function", "Array", "String", "Number", "Boolean", "Symbol", "BigInt",
  "Math", "JSON", "Date", "RegExp", "Error", "TypeError", "RangeError", "SyntaxError",
  "ReferenceError", "EvalError", "URIError", "AggregateError",
  "Map", "Set", "WeakMap", "WeakSet", "Promise", "Proxy", "Reflect",
  "ArrayBuffer", "SharedArrayBuffer", "DataView",
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array",
  "BigInt64Array", "BigUint64Array",
].filter((n) => typeof globalThis[n] !== "undefined");

// name -> [lengths observed across hosts]
function observe(where) {
  const seen = new Map();
  // %TypedArray% and its prototype hold the methods shared by every typed array
  // (set, subarray, map, ...). They are not reachable by name from globalThis, so
  // without this every one of them looks like a name node does not have.
  const intrinsics = typeof Int8Array !== "undefined"
    ? [["%TypedArray%", Object.getPrototypeOf(Int8Array)]]
    : [];
  for (const [h, explicit] of [...HOSTS.map((n) => [n, null]), ...intrinsics]) {
    const host = explicit ?? globalThis[h];
    const target = where === "static" ? host : host?.prototype;
    if (!target) continue;
    for (const key of Object.getOwnPropertyNames(target)) {
      if (key === "constructor") continue;
      const d = Object.getOwnPropertyDescriptor(target, key);
      // Only data properties holding functions. Reading an accessor here would
      // invoke a getter on the prototype with the wrong receiver and throw.
      if (!d || typeof d.value !== "function") continue;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push({ host: h, len: d.value.length });
    }
  }
  return seen;
}

function majority(entries) {
  const counts = new Map();
  for (const e of entries) counts.set(e.len, (counts.get(e.len) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const tie = ranked.length > 1 && ranked[0][1] === ranked[1][1];
  return { value: ranked[0][0], tie, spread: ranked.length > 1 };
}

// Names where a single table CANNOT be right, because the tables are keyed by
// bare method name and two builtins genuinely disagree. Whichever value the
// TABLE stores, the other receiver would report the wrong length, so these names
// are not resolved from the table at all: eval.milo dispatches them through
// builtinArityOn(host, name), which takes the receiver brand. The table keeps
// the fallback value and this list records which names have moved, so a name
// added here without the matching dispatch still shows up.
const RECEIVER_AWARE = {
  set: {
    table: 1,
    note:
      "Map.prototype.set and WeakMap.prototype.set are 2, %TypedArray%.prototype.set is 1. " +
      "builtinArityOn(host, name) in eval.milo returns 2 for the Map brand and falls back to " +
      "the table (1) for everything else, so both receivers now report node's value.",
  },
};

let bad = 0, checked = 0, unknown = 0, ambiguous = 0, dispatched = 0;

function compare(label, tbl, seen) {
  for (const [name, want] of tbl) {
    const entries = seen.get(name);
    if (!entries) {
      unknown++;
      if (verbose) console.log(`?     ${label}: node has no builtin named "${name}"`);
      continue;
    }
    checked++;
    const { value, tie, spread } = majority(entries);
    if (value === want) continue;
    const known = RECEIVER_AWARE[name];
    if (known && known.table === want) {
      dispatched++;
      if (verbose) console.log(`~     ${label}: "${name}" table holds ${want}, node says ${value}; resolved receiver-aware: ${known.note}`);
      continue;
    }
    if (tie) {
      ambiguous++;
      console.log(`~     ${label}: "${name}" is ${want}; node ties across ${entries.map((e) => `${e.host}=${e.len}`).join(", ")}`);
      continue;
    }
    console.error(
      `WRONG ${label}: "${name}" is ${want}, node says ${value}` +
      (spread ? ` (${entries.map((e) => `${e.host}=${e.len}`).join(", ")})` : "")
    );
    bad++;
  }
}

const protoSeen = observe("proto");
const staticSeen = observe("static");

// builtinArity is a SUPERSET: it also answers for static names (Math.abs,
// Object.assign, Promise.all), because the engine falls back to it when a name
// is not a prototype method. So a name missing from every prototype is looked up
// among the statics rather than written off as unknown.
const protoOrStatic = new Map(protoSeen);
for (const [k, v] of staticSeen) if (!protoOrStatic.has(k)) protoOrStatic.set(k, v);

compare("proto ", table("arityData"), protoOrStatic);
compare("static", table("staticArityData"), staticSeen);

// Constructors are unambiguous — there is exactly one answer per name.
for (const [name, want] of table("ctorArityData")) {
  const ctor = globalThis[name];
  if (typeof ctor !== "function") {
    unknown++;
    if (verbose) console.log(`?     ctor  : node has no constructor named "${name}"`);
    continue;
  }
  checked++;
  if (ctor.length !== want) {
    console.error(`WRONG ctor  : "${name}" is ${want}, node says ${ctor.length}`);
    bad++;
  }
}

console.log(`\ncheck-arity: ${checked} checked, ${bad} wrong, ${dispatched} receiver-aware, ${ambiguous} ambiguous, ${unknown} not in node`);
if (bad) console.error("FAIL: a built-in length disagrees with node — test262 asserts every one of these");
process.exit(bad ? 1 : 0);
