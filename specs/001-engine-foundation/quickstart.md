# Quickstart: Validating the Foundation

Prerequisites: repo checkout, `milo` on PATH, node + bun installed, test262/QuickJS
checkouts where a sweep is being run (revisions per `docs/status.md`).

## 1. The whole loop (US1: real programs correct)

```sh
tools/dev.sh
```

Expect: both binaries build, all suites (fixtures, repl, embed, napi) PASS, byte-exact vs
node. `tools/verify-expected.sh` confirms no committed expectation drifted from node.

## 2. Conformance ratchet (US2)

```sh
bun scripts/test262-sweep.ts            # writes docs/conformance report
bun tools/check-conformance-ratchet.mjs # NEW gate
```

Expect: PASS listing 0 lost cases; "unclaimed wins" advisory if the sweep improved.
Negative check (gate teeth): delete one line's worth of pass from a scratch copy of the
report and re-run; the gate must FAIL naming that case.

## 3. Scaling + plateau (US3)

```sh
tools/bench-scaling.sh                  # runs each workload at N and 10N
bun tools/check-scaling-budget.mjs      # ratio vs declared bound
bun tools/check-memory-plateau.mjs      # constant-live-set footprint plateau
```

Expect: every workload within bound×tolerance; plateau late-window ≤ early-window×1.2.
Negative check: a deliberately quadratic scratch workload declared `linear` must FAIL.

## 4. Embedding (US4)

```sh
tests/run-embed.sh
```

Expect: capability-isolation probe (no fs/net reachable), repeated create/destroy under
the leak oracle, error-crossing case — all PASS with engine-only linkage.

## 5. Gate integrity (FR-008)

```sh
tools/check-gate-teeth.sh
bun tools/check-ci-covers-hook.mjs
```

Expect: every gate (including the three new ones) demonstrably fails on injected
violation and empty input, and runs in both pre-commit and CI.

## Acceptance mapping

| Spec item | Validated by |
|---|---|
| SC-001 | step 1 |
| SC-002 | `tools/check-apps.sh` (target app class stays green) |
| SC-003 | step 2 + published numbers in docs/status.md |
| SC-004, SC-005 | step 3 |
| SC-006 | step 4 + docs/milojs-embedding.md walkthrough |
| SC-007 | steps 1–5 are ≤3 commands each; full loop timed by dev.sh summary |
| SC-008 | step 5 |
