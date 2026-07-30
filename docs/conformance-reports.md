<!-- doc-meta
system: conformance-reports
purpose: reproducible procedure and format for checked-in test262 and QuickJS sweep evidence
key-files: scripts/test262-sweep.ts, scripts/quickjs-sweep.ts, docs/status.md
update-when: report flags, schema, corpus policy, or score publication policy changes
last-verified: 2026-07-30
-->

# conformance reports

Conformance scores must identify the engine and upstream corpus that produced
them. Both sweep scripts accept `--json <path>` and write a stable JSON report
containing:

- `schemaVersion` and suite name;
- corpus path and Git revision;
- engine path;
- sample/filter configuration;
- pass, fail, skip, and selected totals;
- complete failure buckets and case names;
- per-area test262 totals.

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
bun scripts/test262-sweep.ts --sample 1500 --json test262-status.json
```

The sample seed is fixed in the script and included in the report. Module and
Atomics host-mode tests are counted as explicit skips. The current harness runs
ordinary tests in sloppy mode once rather than running both strict and sloppy;
the console summary states this limitation.

## QuickJS

```bash
QUICKJS_TESTS=/path/to/quickjs/tests \
MILOJS_ENGINE=/tmp/mj-engine \
bun scripts/quickjs-sweep.ts --json quickjs-status.json
```

QuickJS-only host tests are named in `skippedFiles` rather than disappearing from
the result. The score is per trailing test invocation, not per upstream file.

## Publication rule

Do not edit a score by hand from a partial or filtered run. Check the JSON report
in with the status update once the corpora are pinned in this repository or CI.
Until then, keep reports as review artifacts and copy only totals from an
unfiltered run into `docs/status.md`, including the date.
