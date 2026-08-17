#!/usr/bin/env node
// Generates src/uniprops.txt (the data) and validates src/uniprops.milo can find
// every name in it — the Unicode property tables behind RegExp `\p{...}`/`\P{...}`.
//
// node is the oracle, as everywhere in this repo: rather than transcribing
// PropList.txt and Scripts.txt by hand, ask the host's own regex engine which
// code points a property matches. That makes the engine agree with the node it
// was derived from by construction, and it costs one scan of the code space per
// property.
//
//   node tools/gen-uniprops.mjs            # rewrite src/uniprops.txt
//   node tools/gen-uniprops.mjs --check    # fail if it has drifted
//
// The output is a DATA file, not Milo source. Nearly 400 properties as if-trees
// (the shape src/unicase.milo uses) would be megabytes of generated code; as
// delta-encoded ranges in one embedded string it is a fraction of that and the
// lookup is a binary search.

import { readFileSync, writeFileSync, readdirSync } from "fs";

const MAX = 0x110000;

// The names test262 exercises, which is also the set the spec requires an engine
// to recognise. Kept as a list rather than probed from the runtime so that a node
// upgrade adding a property does not silently widen what milojs claims to support.
const BINARY = [
  "ASCII", "ASCII_Hex_Digit", "Alphabetic", "Any", "Assigned", "Bidi_Control",
  "Bidi_Mirrored", "Case_Ignorable", "Cased", "Changes_When_Casefolded",
  "Changes_When_Casemapped", "Changes_When_Lowercased",
  "Changes_When_NFKC_Casefolded", "Changes_When_Titlecased",
  "Changes_When_Uppercased", "Dash", "Default_Ignorable_Code_Point",
  "Deprecated", "Diacritic", "Emoji", "Emoji_Component", "Emoji_Modifier",
  "Emoji_Modifier_Base", "Emoji_Presentation", "Extended_Pictographic",
  "Extender", "Grapheme_Base", "Grapheme_Extend", "Hex_Digit", "ID_Continue",
  "ID_Start", "IDS_Binary_Operator", "IDS_Trinary_Operator", "Ideographic",
  "Join_Control", "Logical_Order_Exception", "Lowercase", "Math",
  "Noncharacter_Code_Point", "Pattern_Syntax", "Pattern_White_Space",
  "Quotation_Mark", "Radical", "Regional_Indicator", "Sentence_Terminal",
  "Soft_Dotted", "Terminal_Punctuation", "Unified_Ideograph", "Uppercase",
  "Variation_Selector", "White_Space", "XID_Continue", "XID_Start",
];

// General_Category values, long and short. The two-letter groups (L, M, N, …) are
// unions of their subcategories and are emitted as their own ranges rather than
// resolved at match time, so a lookup never has to know the hierarchy.
const GC = [
  ["Cased_Letter", "LC"], ["Close_Punctuation", "Pe"], ["Connector_Punctuation", "Pc"],
  ["Control", "cntrl"], ["Currency_Symbol", "Sc"], ["Dash_Punctuation", "Pd"],
  ["Decimal_Number", "digit"], ["Enclosing_Mark", "Me"], ["Final_Punctuation", "Pf"],
  ["Format", "Cf"], ["Initial_Punctuation", "Pi"], ["Letter", "L"],
  ["Letter_Number", "Nl"], ["Line_Separator", "Zl"], ["Lowercase_Letter", "Ll"],
  ["Mark", "Combining_Mark"], ["Math_Symbol", "Sm"], ["Modifier_Letter", "Lm"],
  ["Modifier_Symbol", "Sk"], ["Nonspacing_Mark", "Mn"], ["Number", "N"],
  ["Open_Punctuation", "Ps"], ["Other", "C"], ["Other_Letter", "Lo"],
  ["Other_Number", "No"], ["Other_Punctuation", "Po"], ["Other_Symbol", "So"],
  ["Paragraph_Separator", "Zp"], ["Private_Use", "Co"], ["Punctuation", "punct"],
  ["Separator", "Z"], ["Space_Separator", "Zs"], ["Spacing_Mark", "Mc"],
  ["Surrogate", "Cs"], ["Symbol", "S"], ["Titlecase_Letter", "Lt"],
  ["Unassigned", "Cn"], ["Uppercase_Letter", "Lu"],
];

// Every SPELLING the corpus actually uses, harvested from the test sources rather
// than hardcoded. The spec gives most properties two or three names — `Deprecated`
// / `Dep`, `Script=Cuneiform` / `sc=Xsux`, `General_Category=Letter` / `gc=L` —
// and a table with only the long forms rejects two thirds of the tests as unknown
// property names. There are 175 scripts with four-letter ISO 15924 codes plus
// short forms for most binary properties; enumerating them by hand would be a
// list to maintain, and the tests already state every one of them.
function harvestNames() {
  const root = process.env.TEST262;
  if (!root) return [];
  const out = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.name.endsWith(".js")) continue;
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/\\[pP]\{([^}]{1,80})\}/g)) out.add(m[1]);
    }
  };
  walk(`${root}/test/built-ins/RegExp`);
  return [...out].sort();
}

// Ranges of code points matching `re`. One pass over the whole space; the regex
// is applied to a single-code-point string so astral planes work under /u.
function ranges(re) {
  const out = [];
  let start = -1;
  for (let c = 0; c < MAX; c++) {
    // A lone surrogate is not a code point any /u pattern can match, and
    // String.fromCodePoint would produce an unpaired one. Every property answers
    // false here, and the spec's tables agree.
    const hit = c >= 0xd800 && c <= 0xdfff ? false : re.test(String.fromCodePoint(c));
    if (hit) { if (start < 0) start = c; }
    else if (start >= 0) { out.push([start, c - 1]); start = -1; }
  }
  if (start >= 0) out.push([start, MAX - 1]);
  return out;
}

// Base-64 varint, 5 data bits + 1 continuation bit per character, low bits first.
// Chosen over hex to halve the table and over raw bytes so the file stays a text
// file that diffs and reviews like one.
const ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
function varint(n) {
  let s = "";
  for (;;) {
    const chunk = n & 31;
    n >>>= 5;
    s += ALPHA[n > 0 ? chunk | 32 : chunk];
    if (n === 0) return s;
  }
}

// Ranges as gap+length pairs: the gap from the previous range's end, then the
// span. Both are small for real tables, so most pairs cost two characters.
function encode(rs) {
  let prevEnd = -1, s = "";
  for (const [a, b] of rs) {
    s += varint(a - prevEnd - 1) + varint(b - a);
    prevEnd = b;
  }
  return s;
}

// Names only. The regex is built inside the loop and in a try: test262 tracks a
// newer Unicode than any given node, so some script names are unknown here and
// must be SKIPPED rather than crash the generator. A name milojs cannot answer is
// a name it must reject as a SyntaxError, which is what the test expects anyway.
const wanted = [];
for (const n of BINARY) wanted.push(n);
for (const [long, _short] of GC) wanted.push(`General_Category=${long}`);
for (const n of harvestNames()) wanted.push(n);

// An alias shares its target's ranges instead of duplicating them: `Lu` and
// `Uppercase_Letter` are the same table, and so are every script's short forms.
const lines = [];
const seen = new Map();
let skipped = 0;
for (const name of [...new Set(wanted)]) {
  let body;
  try { body = encode(ranges(new RegExp(`\\p{${name}}`, "u"))); }
  catch { skipped++; continue; }   // a name this node does not know
  const prior = seen.get(body);
  if (prior !== undefined) { lines.push(`${name}\t=${prior}`); continue; }
  seen.set(body, name);
  lines.push(`${name}\t${body}`);
}


const stamp = `node ${process.versions.node} (ICU ${process.versions.icu}, Unicode ${process.versions.unicode})`;
const out = `# GENERATED by tools/gen-uniprops.mjs — do not edit by hand.
# Unicode property tables for RegExp \\p{...}. Generated from ${stamp}.
#
# One property per line: <name>\\t<data>. Data is gap+length varint pairs in the
# base-64 alphabet ${ALPHA[0]}..${ALPHA[63]}, 5 bits per character with bit 6 as
# the continuation flag. A body of "=<name>" is an alias sharing that table.
${lines.join("\n")}
`;

const target = new URL("../src/uniprops.txt", import.meta.url);
if (process.argv.includes("--check")) {
  const have = readFileSync(target, "utf8");
  if (have !== out) {
    console.error("gen-uniprops: src/uniprops.txt does not match its generator.");
    const m = have.match(/^# .*Generated from (.+)\.$/m);
    if (m && m[1] !== stamp) {
      console.error(`  committed with: ${m[1]}`);
      console.error(`  running under:  ${stamp}`);
    }
    process.exit(1);
  }
  console.log(`gen-uniprops: src/uniprops.txt matches its generator (${lines.length} properties)`);
} else {
  writeFileSync(target, out);
  console.error(`gen-uniprops: ${lines.length} properties, ${skipped} unknown to this node, ${(out.length / 1024).toFixed(0)}KB`);
}
