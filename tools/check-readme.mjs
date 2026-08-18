// The README is the front door, and prose accretes there faster than anywhere
// else in the repo: every measurement gains a paragraph explaining itself, and
// within a few commits the thing a reader came for (what this is, the scores,
// how to run it, how to embed it) is buried.
//
// This gates the SHAPE, not the wording. Two rules:
//
//   1. Only the sections below may exist, in this order. A new section is a
//      deliberate decision, not something that lands with a measurement.
//   2. Each section has a prose budget. Tables, code fences, lists and links are
//      not prose and are not counted — the budget is on paragraphs of English,
//      which is the thing that grows without anyone deciding it should.
//
// Both numbers are deliberately tight. If a change needs more room, the
// explanation belongs in docs/status.md and the README should link to it.
import { readFileSync } from "node:fs";

const ALLOWED = [
  { title: "Engine Conformance", prose: 2 },
  { title: "Node Conformance", prose: 5 },
  { title: "Install", prose: 2 },
  { title: "Usage", prose: 2 },
  { title: "Embed The Engine", prose: 3 },
  { title: "Build From Source", prose: 2 },
  { title: "Development", prose: 2 },
  { title: "License", prose: 1 },
];
// The preamble above the first `##` gets its own budget: it is the pitch.
const PREAMBLE_PROSE = 6;

const text = readFileSync("README.md", "utf8");
const lines = text.split("\n");

const problems = [];
const sections = [];
let current = { title: null, lines: [] };
for (const line of lines) {
  const m = /^##\s+(.+?)\s*$/.exec(line);
  if (m) {
    sections.push(current);
    current = { title: m[1], lines: [] };
  } else {
    current.lines.push(line);
  }
}
sections.push(current);

// Prose = a non-empty line that is not a table row, code fence or fenced body,
// list item, heading, image, badge or HTML comment.
function proseCount(sectionLines) {
  let count = 0;
  let inFence = false;
  for (const raw of sectionLines) {
    const line = raw.trim();
    if (line.startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (line === "") continue;
    if (line.startsWith("|")) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("-") || line.startsWith("*")) continue;
    if (line.startsWith("<")) continue;
    if (line.startsWith("[![") || line.startsWith("![")) continue;
    count++;
  }
  return count;
}

const preamble = sections[0];
const preambleProse = proseCount(preamble.lines);
if (preambleProse > PREAMBLE_PROSE) {
  problems.push(
    `preamble: ${preambleProse} prose lines, budget ${PREAMBLE_PROSE} — say what milojs is, not how it is measured`,
  );
}

const found = sections.slice(1).map((s) => s.title);
const expected = ALLOWED.map((a) => a.title);
for (const title of found) {
  if (!expected.includes(title)) {
    problems.push(`unexpected section "## ${title}" — add it to tools/check-readme.mjs if it truly belongs`);
  }
}
const ordered = found.filter((t) => expected.includes(t));
const inOrder = expected.filter((t) => ordered.includes(t));
if (ordered.join("|") !== inOrder.join("|")) {
  problems.push(`sections out of order: ${ordered.join(", ")} (expected ${inOrder.join(", ")})`);
}

for (const section of sections.slice(1)) {
  const rule = ALLOWED.find((a) => a.title === section.title);
  if (!rule) continue;
  const n = proseCount(section.lines);
  if (n > rule.prose) {
    problems.push(
      `"## ${section.title}": ${n} prose lines, budget ${rule.prose} — move the explanation to docs/status.md and link to it`,
    );
  }
}

if (problems.length > 0) {
  console.error("check-readme: the README grew past its budget\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error("\n  The README answers four questions: what it is, how it scores, how to run");
  console.error("  it, how to embed it. Anything else belongs in docs/.");
  process.exit(1);
}

const total = sections.slice(1).reduce((n, s) => n + proseCount(s.lines), preambleProse);
console.log(`check-readme: ${found.length} sections, ${total} prose lines, all within budget`);
