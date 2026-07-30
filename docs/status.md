<!-- doc-meta
system: status
purpose: canonical current capability, evidence, and next-milestone dashboard for milojs
key-files: milojs-engine.milo, milojs.milo, tests/run.sh, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts
update-when: a product gate lands, a conformance sweep is rerun, or the supported host surface changes
last-verified: 2026-07-30
-->

# milojs status

This is the canonical current-state dashboard. The roadmap preserves design and
implementation history; the backlog carries detailed work items. When an older
narrative conflicts with this page, verify the source and tests, then update this
page.

## Product status

MiloJS is an experimental JavaScript engine and Node-compatible runtime. It is
not yet a drop-in replacement for QuickJS, Node, Deno, or Bun.

The project deliberately has two deliverables:

- `milojs-engine`: raw JavaScript with no Node host bindings. The target is a
  small, embeddable QuickJS-class engine with published conformance results.
- `milojs`: the engine plus a module loader, event loop, filesystem/network host
  bindings, Node-compatible JavaScript modules, and Node-API addon loading. The
  compatibility target is Node; Deno and Bun are useful comparisons, not
  additional API contracts.

Engine maturity comes first. Runtime compatibility cannot be credible while the
language engine and embedding contract are unstable.

## Evidence

Last full conformance sweep: 2026-07-24.

| measure | result | interpretation |
|---|---:|---|
| deterministic test262 sample | 473/1476 (32.0%) | broad language and builtin coverage is still early |
| QuickJS `tests/` cases | 93/149 (62.4%) | useful subset, with a substantial semantic long tail |
| locked engine fixtures | 140 | byte-exact differential output |
| locked runtime fixtures | 27 | module, async, fetch, HTTP, and host behavior |
| Milo invariant fixtures | 3 | scheduler/context and GC-root invariants |

The conformance corpora are local rather than vendored, so the two sweep numbers
are informative but not yet a reproducible release artifact. Fixture counts are
not conformance percentages.

## Shipped engine surface

- Tree-walking evaluator with lexical closures, classes, generators on the
  runtime, async functions, promises, exceptions, modules, and common modern
  syntax.
- Stable-handle mark-sweep GC for scopes and objects, including suspended async
  and generator activation roots.
- Objects, arrays, prototype chains, Proxy, symbols, Map/Set, Date, RegExp,
  ArrayBuffer/DataView, integer typed arrays, and arbitrary-precision BigInt.
- Common builtins implemented partly in Milo and partly in the embedded
  `lib/engine-prelude.js` specification layer.

Important limits include incomplete test262 behavior, runtime-only generators,
no direct `eval`, incomplete typed-array methods, and remaining whitelist-based
builtin prototype dispatch. See `docs/backlog.md` for the maintained detail.

## Shipped runtime surface

- CommonJS loading and a parse-time ESM compatibility lowering.
- Event loop, microtasks, timers, async suspension, HTTP serving, outbound
  `fetch`, filesystem APIs, Buffer, streams, and a growing set of Node modules.
- Node-API addon loading with promises, references, wrapping, classes, and
  threadsafe functions.

This is an application-oriented compatibility slice, not general Node
compatibility. Client `http.request`/`http.get`, TLS serving, child processes,
computed module discovery, and significant package-facing edges remain. Fourteen
of 64 Node-API entry points are honest stubs; callback invocation and Buffer
interop are the highest-impact missing groups.

## Product gates

### Gate 0: green and measurable

- Both binaries build against the released Milo compiler.
- All engine, runtime, Milo invariant, symbol, docs, and contract guards pass.
- Compiler compatibility is recorded rather than inferred from a rolling tag.

### Gate 1: embeddable engine preview

- A real `libmilojs` C ABI exists with opaque runtime/context/value handles.
- An embedder can evaluate source, inspect exceptions, exchange primitive
  values, retain/release handles, and register a native function.
- A C example and ABI-level tests build outside the MiloJS implementation.
- Pinned test262 and QuickJS reports are checked in and reproducible.

### Gate 2: credible QuickJS alternative

- Core `language/` and non-Intl builtins have explicit conformance targets and
  a regression ratchet.
- Remaining fake prototype dispatch is removed before bytecode freezes it into
  a second execution engine.
- Memory limits, interruption, stack limits, and deterministic teardown are
  exposed through the embedding API.
- Benchmarks publish startup, execution, allocation, and peak-memory results.

### Gate 3: Node runtime preview

- A real Express application serves routes end to end without application-
  specific package stubs.
- HTTP client/server, TLS, subprocesses, filesystem, streams, module resolution,
  errors, and shutdown behavior have integration coverage.
- Node-API callback and Buffer families are implemented, and unsupported entry
  points return errors rather than false success.
- A checked-in module and package compatibility matrix defines the supported
  surface.

### Gate 4: performance architecture

Decide on bytecode from measurements, not chronology. A bytecode VM is justified
when tree-walker dispatch, native stack depth, or suspension complexity blocks a
published gate. Keep the tree walker as a differential oracle if the VM lands.

## Immediate order

1. Restore Gate 0 whenever Milo's released standard library changes.
2. Replace the stale conformance summaries with generated, checked-in reports.
3. Implement the smallest complete C embedding vertical slice.
4. Finish real builtin prototype dispatch, starting with String.
5. Grow conformance and runtime application gates in separate, measured lanes.
