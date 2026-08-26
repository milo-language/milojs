# Contract: Conformance Pass-Set Ratchet

## Files

`docs/conformance/passset-test262.txt`, `passset-quickjs.txt`, `passset-node.txt`.
Header line pins corpus revision (and seed/sample-size for test262); body is sorted
relative case paths, one per line, set semantics.

## Check semantics

Given a sweep report (`docs/conformance/*.json`, revision-attributed, per-case):

- ERROR (not fail): report's corpus revision / seed / sample size differs from the pass
  set header — runs are incommensurable; regenerate on the pinned corpus first.
- FAIL: any case present in the pass set is absent from the report's passing cases. Output
  lists the lost cases by path (diff-by-FILE, per AGENTS.md A/B practice).
- PASS + advisory: cases passing in the report but absent from the pass set are listed as
  "unclaimed wins" — the committer of the improvement rewrites the file to claim them.

## Cadence

The ratchet check runs per-commit (it reads committed files only, O(diff)). Sweeps run
when conformance-relevant work lands or on the nightly/dispatch schedule; a sweep that
regresses the pass set turns into a blocking failure at the next ratchet check, naming
the commit range that lost the cases.

## Non-goals

Percentages are derived display (docs/status.md via gen-facts.mjs), never ratchet input.
The sample is not widened by this contract; widening requires a new header and a
regenerated pass set in one commit.
