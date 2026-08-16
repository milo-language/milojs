<!-- doc-meta
system: conformance-reports
purpose: reproducible procedure and format for checked-in test262 and QuickJS sweep evidence
key-files: scripts/test262-sweep.ts, scripts/quickjs-sweep.ts, docs/status.md
update-when: report flags, schema, corpus policy, or score publication policy changes
last-verified: 2026-08-16 (paths recorded home-relative; the dirty check ignores the report directory so both sweeps can run from one clean checkout)
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
- sample/filter configuration;
- pass, fail, skip, and selected totals;
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
# 1. measure — from a CLEAN checkout, on an unfiltered run
TEST262=~/git/test262 MILOJS_ENGINE=.dev/mj-engine bun scripts/test262-sweep.ts --sample 1500
QUICKJS_TESTS=~/git/quickjs/tests MILOJS_ENGINE=.dev/mj-engine bun scripts/quickjs-sweep.ts
# 2. compile the prose from the evidence
node tools/gen-facts.mjs
# 3. commit the report and the docs together
```

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

A partial or filtered run must not be published at all; `--dir` and `-f` exist for
investigation, and their reports belong under a `--json` scratch path.
