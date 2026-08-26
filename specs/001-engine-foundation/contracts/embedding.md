# Contract: Engine Embedding (formalizes docs/milojs-embedding.md)

## Surface

C ABI from `libmilojs`; consumer links the engine only (no runtime objects). Lifecycle:

1. create context (ONE per process — recorded limitation, see below)
2. evaluate source → value handle or structured error (message + JS error class)
3. exchange values: JS↔host conversion for primitives, strings, arrays, objects (by copy)
4. register host functions callable from JS
5. destroy context; teardown is leak-free (leak oracle in `tests/run-embed.sh` gates it)

## Guarantees

- No filesystem, network, module-loading, or process capability is reachable from
  evaluated JS unless the host registered a function providing it. Enforced structurally
  by layering (engine cannot import runtime; `tools/check-layering.sh`).
- Errors thrown by JS cross the boundary as values, never host aborts; resource
  exhaustion follows the engine's defined error policy.
- create→evaluate→destroy→create-again works repeatedly in one process without leaks
  (satisfies spec US4 scenario 3 sequentially).

## Recorded limitation

Single live context per process. Revisit-when: an actual embedder needs concurrent
contexts (tracked in docs/decisions.md). Multi-context is NOT promised by this contract.

## Validation

`tests/run-embed.sh` (existing) extended by tasks to cover: capability isolation probe,
repeated create/destroy leak check, error-crossing check.
