# Quickstart: Validating VM Work

Inner loop for one increment:

```sh
tools/dev.sh <pattern>                 # fixture(s) near the construct
tools/vm-differential.sh               # matrix + 300 seeds, VM vs walker
tools/dev.sh                           # full suites
bun scripts/test262-sweep.ts && bun scripts/quickjs-sweep.ts
node tools/check-conformance-ratchet.mjs   # per-case: nothing lost
bun tools/vm-coverage.mjs              # coverage number moved up
./benchmarks? -> bench/ab.sh           # before/after on affected benches
```

Stress modes when touching allocation/rooting: `MILOJS_GC_THRESHOLD=1 tests/run.sh`.
Fallback oracle: `MILOJS_NO_BYTECODE=1 tests/run.sh`.
Witness a compile decision: `MILOJS_VM_STATS=1 .dev/mj-engine prog.js` (stderr summary).

Acceptance mapping: SC-001 = equivalence contract gates; SC-002 = coverage report ≥90%;
SC-003 = bench budget re-tightened; SC-004 = recursion probe fixture on 3 platforms;
SC-005 = GC_THRESHOLD suite; SC-006 = NO_BYTECODE CI job; SC-007 = decision entry date
precedes the coverage report crossing 60%.
