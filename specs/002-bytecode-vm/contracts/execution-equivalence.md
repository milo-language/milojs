# Contract: Execution Equivalence (what "identical behavior" means, executably)

A coverage increment may land only when all of these hold, same commit:

1. `tools/dev.sh` — fixture corpus byte-exact vs node, all suites.
2. `tools/vm-differential.sh` — VM vs walker on the operator matrix + generated seeds;
   any operator/shape the increment newly compiles gets matrix entries in the same
   commit. Any output difference at all is a bug (same binary both sides, no noise).
3. Both engine sweeps + package gate + `tools/check-conformance-ratchet.mjs` — every
   previously passing case still passes (per case, not aggregate).
4. `MILOJS_GC_THRESHOLD=1` fixture suite — required when the increment touches
   allocation, rooting, or re-entry into the evaluator.
5. `MILOJS_NO_BYTECODE=1` fixture suite (CI job) — the fallback stays a complete engine;
   it is the differential oracle that localizes compiled-path bugs.

Fallback rule (spec FR-001): admission is decided per unit before execution. Mid-unit
semantic escapes happen only through the shared semantic core calls (`evalBinValues`,
`memberOfValue`, `setMemberOfValue`, `callPlainValue`, and kin) — never by duplicating
their logic in an opcode (spec FR-002). A fast path in an opcode must be total on the
cases it claims and hand every other case to the core.
