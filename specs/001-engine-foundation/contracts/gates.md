# Contract: Quality Gates

Every gate in this feature follows the repo's gate contract, and the contract itself is
checked by `tools/check-gate-teeth.sh` and `tools/check-ci-covers-hook.mjs`.

## Universal gate contract

1. Exit 0 = pass, nonzero = fail; failure output names the offending item and the fix.
2. Empty input universe = FAILURE ("0 checked" may never exit 0).
3. Registered in `tools/precommit.sh` AND in CI (check-ci-covers-hook enforces the pair).
4. Teeth demonstrated: an injected violation makes the gate fail (recorded in
   check-gate-teeth or by a committed negative test).
5. Ratchet state lives in a committed file; the gate only lets it move the agreed way.

## New gates in this feature

| gate | input | fails when |
|---|---|---|
| `tools/check-conformance-ratchet.mjs` | passset files + sweep report JSON | a pass-set case is not passing in the report; corpus/seed header mismatch; empty pass set or report |
| `tools/check-scaling-budget.mjs` | `bench/scaling/manifest.json` + measured runs | ratio exceeds bound×tolerance; manifest entry with no workload file; empty manifest |
| `tools/check-memory-plateau.mjs` | plateau run footprint series | late-window peak > early-window×1.2; series empty or shorter than expected |

## Update protocol (ratchet files)

Improvement: rewrite state file in the SAME commit as the earning change; gate confirms
new state matches reality. Regression: gate blocks; the change does not land, or the
removal is argued in the commit that shrinks the file (crash-budget style: named entries).
