# Data Model: Scalable Engine and Runtime Foundation

All state is committed files; there is no database. Formats follow the repo's existing
committed-report conventions (`docs/conformance/*.json`, plain-text baselines in `tools/`).

## Conformance pass set (NEW)

One file per suite: `docs/conformance/passset-{test262,quickjs,node}.txt`.

| Field | Form | Rule |
|---|---|---|
| header | `# corpus <rev> sample <seed>/<n>` (test262) or `# corpus <rev>` | Must match the sweep report it is compared against; mismatch = gate error, not pass/fail. |
| case lines | one relative case path per line, sorted | Set semantics. A line may only disappear in a commit whose sweep shows the case passing was lost deliberately (argued in the commit); the gate treats any disappearance vs the current sweep as failure. |

Transitions: grow (new passes, rewrite in same commit as the earning change); shrink only
with an explicit argued removal. Compared against sweep report JSON per-case results.

## Scaling benchmark manifest (NEW)

`bench/scaling/manifest.json`: one entry per workload.

| Field | Form | Rule |
|---|---|---|
| name | string, matches `bench/scaling/<name>.js` | file takes N via argv |
| dimension | `parse` \| `execute` \| `allocate` | what axis N scales |
| n | integer | base size; run at n and 10n |
| bound | `linear` \| `linearithmic` \| `quadratic` | expected exponent; `quadratic` requires an `argument` field (written justification) |
| metric | `time` \| `peakMemory` \| both | what the bound constrains |

Gate math: ratio = cost(10n)/cost(n); allowed = 10x (linear) / ~13x (linearithmic) /
100x (quadratic), each × 2 noise tolerance. Violation = failure naming workload + ratio.

## Memory plateau workload (NEW)

`bench/scaling/plateau.js` + sampled footprint series (ephemeral, not committed).
Rule: max(footprint in last third of run) ≤ max(first third) × tolerance (1.2). Ops-count
driven, guarded, constant live set by construction.

## Existing entities (unchanged, referenced by gates)

- **Sweep report** (`docs/conformance/*.json`): revision-attributed per-case results;
  source of truth the pass set is checked against.
- **Defect budget** (`docs/conformance/defect-budget.json`): crashes exact-match (named),
  hangs/parseFailures ceilings.
- **Bench budget** (`tools/check-bench-budget.mjs` ceilings): absolute per-workload
  ceilings vs peer; only tightens.
- **Divergence registries**: `tests/.node-oracle-exempt` (node divergences),
  `src/.layering-exempt` (engine→runtime edges), `tools/docs-staleness.txt` (stale docs),
  `tools/packages-baseline.txt` (package-suite assertions). All shrink-only or argued.

## Decision record (NEW)

`docs/decisions.md`, doc-meta + one section per decision.

| Field | Rule |
|---|---|
| decision | one sentence, present tense |
| rationale | why, including rejected alternatives |
| revisit-when | the measurement that would justify reopening (not a date) |
| detail | link to the subsystem doc that owns the depth |

Initial entries: value representation (incl. open bytecode-VM value model question with
its criteria), memory management, execution strategy, event model, single-context
embedding, priority policy (hybrid: conformance ranking default, target-app-class
blockers jump the queue, per clarification 2026-08-25).
