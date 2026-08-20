// A string read out of the AST by REFERENCE must not be used after the
// interpreter re-enters itself.
//
// Why: `require()` parses new source into the same program store, and the append
// can move the storage a live reference points into. The reference then reads
// whatever is there now. Observed: a `for (const n of ...)` loop whose binding
// name came back as the empty string after ~50 modules had loaded, so the loop
// variable stopped resolving mid-loop; the same corruption further along made
// node's test-global.js die on SIGSEGV instead of failing an assertion.
//
// The rule that fixes it is mechanical, which is why this is a gate and not a
// note: copy the string BEFORE running anything that can re-enter. This finds
// every place that does not.
//
// Two shapes are checked:
//   - `match` arms over Stmt/Expr, whose string fields are bound by reference
//     (field types come from the enum in ast.milo, not from guesswork)
//   - functions taking a `&string` parameter
import { readFileSync } from "fs";

const AST = readFileSync("src/engine/ast.milo", "utf-8");
const EVAL = readFileSync("src/engine/eval.milo", "utf-8");
const ALLOW_PATH = "tools/ast-ref-allow.txt";
// "<label> <count>": the number of sites for that label that are still
// unfixed. A label appears more than once (three Expr.Member arms), so the
// baseline counts them rather than naming lines, which would churn on every
// edit above them.
const allow = new Map(
  readFileSync(ALLOW_PATH, "utf-8").split("\n")
    .map((l) => l.replace(/#.*/, "").trim()).filter(Boolean)
    .map((l) => { const m = /^(.*\S)\s+(\d+)$/.exec(l); return [m[1], Number(m[2])]; }));

// Calls that can run user JS or parse new source. Anything reachable from these
// can require(), which is what moves the store.
const REENTRANT = [
  "evalExpr", "execStmt", "execBlock", "execTry", "execTryBody", "callFunction",
  "callFn", "callValue", "getMember", "getMemberDyn", "setMember", "toStrProg",
  "toNumProg", "toPrimitive", "awaitValue", "runDisposals", "requireModule",
  "runModule", "iterableToArray", "definePropOf", "resolvePromiseValue",
];
const reentrantRe = new RegExp(`\\b(${REENTRANT.join("|")})\\s*\\(`);

// Field types per variant, straight from the enum declarations.
function variantsOf(enumName) {
  const start = AST.indexOf(`pub enum ${enumName} {`);
  if (start < 0) throw new Error(`no enum ${enumName} in ast.milo`);
  let depth = 0, i = AST.indexOf("{", start), end = i;
  for (; i < AST.length; i++) {
    if (AST[i] === "{") depth++;
    else if (AST[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = AST.slice(AST.indexOf("{", start) + 1, end).replace(/\/\/.*/g, "");
  const out = new Map();
  for (const m of body.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    out.set(m[1], m[2].split(",").map((t) => t.trim()));
  }
  return out;
}
const TYPES = { Stmt: variantsOf("Stmt"), Expr: variantsOf("Expr") };

// The body of a `{`-delimited construct starting at `from`.
function braceBody(text, from) {
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return text.slice(open + 1);
}

const lineOf = (idx) => EVAL.slice(0, idx).split("\n").length;
const violations = [];

function checkBinding(label, name, rawBody, atLine) {
  // Comments mention the binding constantly ("a name already emitted must not
  // repeat"); scanning them reports the sites that documented the hazard best.
  const body = rawBody.replace(/\/\/.*/g, "");
  const call = body.search(reentrantRe);
  if (call < 0) return;
  // Scan from the END of that call's argument list, not from its name. Handing
  // the string TO the call is safe — the callee gets it before anything has run
  // — and counting those made the gate report sites that were already correct.
  let depth = 0, from = body.length;
  for (let i = body.indexOf("(", call); i < body.length; i++) {
    if (body[i] === "(") depth++;
    else if (body[i] === ")") { depth--; if (depth === 0) { from = i + 1; break; } }
  }
  const after = body.slice(from);
  // A use is any mention that is not part of a longer identifier.
  const used = new RegExp(`(?<![\\w.])${name}\\b`).test(after);
  if (!used) return;
  violations.push({ label, line: atLine });
}

for (const kind of ["Stmt", "Expr"]) {
  for (const m of EVAL.matchAll(new RegExp(`${kind}\\.(\\w+)\\(([^)]*)\\)\\s*=>\\s*\\{`, "g"))) {
    const [variant, argStr] = [m[1], m[2]];
    const types = TYPES[kind].get(variant);
    if (!types) continue;
    const args = argStr.split(",").map((a) => a.trim());
    const body = braceBody(EVAL, m.index + m[0].length - 1);
    args.forEach((arg, i) => {
      if (types[i] !== "string" || arg.startsWith("_") || !/^\w+$/.test(arg)) return;
      checkBinding(`${kind}.${variant}:${arg}`, arg, body, lineOf(m.index));
    });
  }
}

for (const m of EVAL.matchAll(/fn (\w+)\(([^)]*)\)[^{]*\{/g)) {
  const [fname, params] = [m[1], m[2]];
  for (const p of params.split(",")) {
    const pm = /^\s*(\w+):\s*&string\s*$/.exec(p);
    if (!pm || pm[1].startsWith("_")) continue;
    const body = braceBody(EVAL, m.index + m[0].length - 1);
    checkBinding(`fn ${fname}:${pm[1]}`, pm[1], body, lineOf(m.index));
  }
}

// The baseline may only SHRINK: a count that drops has to be written down, or
// the slot stays open for the next regression to fill for free.
const counts = new Map();
for (const v of violations) counts.set(v.label, (counts.get(v.label) ?? 0) + 1);

let bad = 0;
for (const [label, n] of counts) {
  const budget = allow.get(label) ?? 0;
  if (n > budget) {
    const where = violations.filter((v) => v.label === label).map((v) => v.line).join(", ");
    console.error(`check-ast-refs: ${label} — ${n} site(s) use the AST string after re-entry, baseline ${budget} (eval.milo:${where})`);
    bad++;
  }
}
for (const [label, budget] of allow) {
  const n = counts.get(label) ?? 0;
  if (n < budget) {
    console.error(`check-ast-refs: ${label} is down to ${n} site(s) from ${budget} — lower it in ${ALLOW_PATH}`);
    bad++;
  }
}
if (bad) {
  console.error(`Copy the string with .clone() BEFORE the re-entrant call. ${ALLOW_PATH} tracks what is left.`);
  process.exit(1);
}
const total = [...allow.values()].reduce((a, b) => a + b, 0);
console.log(`check-ast-refs: no new AST-reference sites, ${total} baselined site(s) left to fix`);
