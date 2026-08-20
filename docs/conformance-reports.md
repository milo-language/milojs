<!-- doc-meta
system: conformance-reports
purpose: reproducible procedure and format for the checked-in test262, QuickJS and Node sweep evidence
key-files: scripts/test262-sweep.ts, scripts/quickjs-sweep.ts, scripts/node-compat-sweep.ts, docs/status.md
update-when: report flags, schema, corpus policy, or score publication policy changes
last-verified: 2026-08-20 (re-read when the node sweep gained its confirm pass and a totals.hangs field, and when docs/node-compat.md was cut down to the table alone; the procedure and the publication rule are unchanged)
-->

# conformance reports

Conformance scores must identify the engine and upstream corpus that produced
them. Each sweep writes a stable JSON report to `docs/conformance/<suite>.json`
by default — a committed file, not a scratch artifact — containing:

- `schemaVersion` and suite name;
- corpus path and Git revision, with `$HOME` written as `~`: the report is
  committed evidence and must not record the machine it was measured on, which
  is also what the pre-commit home-path check rejects;
- **the milojs revision it was measured at, and whether that tree was dirty**;
- engine path;
- sample/filter configuration, **including `selection.available`: the size of the
  corpus the sample was drawn from.** Without it a reader sees `1169/1470` and
  cannot tell a headline conformance score from a 2.8% spot check, which is what
  the test262 row is. `docs/status.md` publishes the fraction beside the score;
- pass, fail, skip, and selected totals;
- the defect counts that are NOT ordinary failures: `crashes`, `parseFailures`,
  and, for node-compat, `timeouts` and `hangs`. `timeouts` is the raw count at the
  10s per-case limit and moves with how loaded the machine was; `hangs` is the
  subset that timed out AGAIN in the sweep's confirm pass at 45s. Only `hangs`
  reproduces, so it is the one `tools/check-defect-budget.mjs` ratchets;
- complete failure buckets and case names;
- per-area test262 totals.

`--json <path>` still overrides the destination for a throwaway run.

The engine binary itself reports its MiloJS build identity with `--version`.
Record that output in the commit or pull request that updates a score; the report
keeps the invoked path because release and local binary identities use different
formats.

## test262

Use the deterministic 1500-case sample for the frequently updated headline. A
full run is a separate release-quality measurement.

```bash
TEST262=/path/to/test262 \
MILOJS_ENGINE=/tmp/mj-engine \
bun scripts/test262-sweep.ts --sample 1500
```

The sample seed is fixed in the script and included in the report. Module and
Atomics host-mode tests are counted as explicit skips. The current harness runs
ordinary tests in sloppy mode once rather than running both strict and sloppy;
the console summary states this limitation.

`--fails <file>` writes every failing case as one JSON object per line
(`{file, why}`). The console's bucket listing truncates at eight examples per
bucket, which is enough to NAME a cluster and not enough to work one; this is the
full set, and clustering it by directory and by reason is how a session picks its
next target.

**A failure must be detected the same way for every engine.** The sweep used to
decide "did this throw?" by looking for milojs's own `Uncaught …` prefix. Point it
at another engine and that prefix never appears: QuickJS prints a bare
`ReferenceError: …` and exits 1, so every one of its runtime failures scored as a
PASS. It measured **qjs at 100% on Temporal, an API QuickJS does not implement at
all**, and at 90.2% overall against a true 85.9%. Detection is now
`Uncaught …` OR a non-zero exit status OR a leading `SomeError:` line, and the
negative-test check matches the error NAME anywhere in the output rather than only
after `Uncaught`. Correcting it also lowered milojs's own published figure by ~2
points, because milojs parse errors exit non-zero without printing `Uncaught`.

Comparing against another engine is the point of this: `MILOJS_ENGINE=<other>`
scores any binary, and the set difference between two runs' `--fails` dumps is a
prioritized worklist rather than a guess.

`--dir <subpath>` restricts the run to one area and scores it exhaustively rather
than by sample — `--dir built-ins/RegExp/property-escapes` is how the property-escape
tables were measured (0% to 86% in one sitting). Use it to attribute a feature,
and the whole-suite sample for the headline.

## QuickJS

```bash
QUICKJS_TESTS=/path/to/quickjs/tests \
MILOJS_ENGINE=/tmp/mj-engine \
bun scripts/quickjs-sweep.ts
```

QuickJS-only host tests are named in `skippedFiles` rather than disappearing from
the result. The score is per trailing test invocation, not per upstream file.

## Publication rule

**Never type a score into prose.** The numbers in `docs/status.md` and the README
are `<!--fact:t262-pct-->`-style spans compiled from the committed report by
`node tools/gen-facts.mjs`, and `--check` fails in CI if the prose and the report
disagree. Publishing a new score is therefore three steps and no typing:

```sh
# 1. measure — from a CLEAN checkout, on an unfiltered run. MILOJS_ENGINE and
#    MILOJS_RUNTIME both default to what tools/dev.sh builds, and every sweep
#    exits 2 rather than scoring if the binary it was pointed at is missing
#    (tools/check-sweeps.mjs is the gate on that).
TEST262=~/git/test262 MILOJS_ENGINE=.dev/mj-engine bun scripts/test262-sweep.ts --sample 1500
QUICKJS_TESTS=~/git/quickjs/tests MILOJS_ENGINE=.dev/mj-engine bun scripts/quickjs-sweep.ts
NODE_TESTS=~/git/node/test MILOJS_RUNTIME=.dev/mj-runtime bun scripts/node-compat-sweep.ts --sample 400
# 2. compile the prose from the evidence
node tools/gen-facts.mjs
# 3. commit the report and the docs together
```

## The Node sweep measures a different binary

The first two sweeps measure `milojs-engine` — the language. `node-compat-sweep`
measures `milojs`, the runtime: modules, event loop, host bindings. A score on
one says nothing about the other, and the README labels each row with the binary
it tests for that reason.

It runs Node's own `test/parallel` through Node's own `test/common`, so the
oracle is Node's tests rather than anything written here, and it invokes each
case as a plain `<binary> test.js`. Two consequences worth knowing before
quoting the number:

- **606 of Node's 3979 parallel tests are excluded** as not externally runnable:
  they declare `// Flags: --expose-internals` (Node's runner re-execs with those
  flags) or `require("internal/...")`, Node's private module tree. Neither is
  implementable by a third party, so counting them scores every other runtime
  against a denominator it cannot reach. `--all` keeps them, which is what you
  want when measuring Node against itself.
- **Node's own score is the ceiling, not 100%.** The remainder need build flags
  or Node's official runner.

Because it takes a binary rather than a build of this repo, a peer number is
measured rather than quoted: `MILOJS_RUNTIME=$(which bun)`. Read a peer's score
as "passes Node's unmodified tests launched as a plain script", which is
narrower than that project's own compatibility claim — Bun, for instance,
reports 94-100% per module against vendored copies run under `bun test`, and
declines `node:test` outside it. Both numbers are true and they answer different
questions.

Two rules are enforced rather than asked for:

- **A dirty tree is not evidence.** The sweep records `milojs.dirty`, and
  `gen-facts` refuses to publish from a report measured on uncommitted work,
  because nobody, including whoever measured it, can reproduce that number.
  The check ignores `docs/conformance/` itself: the reports land there, so
  writing the first one would otherwise mark the tree dirty for the second and
  make it impossible to produce both from one clean checkout.
- **The score carries its own age.** The report records the milojs revision, and
  `gen-facts` prints how many commits the published score is behind HEAD. That is
  reported, not gated: an unrelated commit should not turn a score red.

A partial or filtered run must not be published at all; `--dir`, `--sample` and
`--files` exist for investigation, and their reports belong under a `--json`
scratch path.
There is no `-f`: unrecognised arguments are ignored, so a mistyped filter runs
the WHOLE corpus rather than failing. An unfiltered run takes about 12 minutes
and is the only way to rank failure causes — the 1500-case sample is too thin to
tell a 700-case defect from a 30-case one.
