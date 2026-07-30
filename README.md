# milojs

<p align="center">
  <img src="docs/images/repl.png" alt="The milojs REPL evaluating console.log('Woof!')" width="760">
</p>

A JavaScript engine and runtime written in the
[Milo](https://github.com/milo-language/milo) programming language.

MiloJS owns its parser, tree-walking evaluator, garbage collector, regular
expression engine, BigInt implementation, module loader, and event loop. It has
no V8, JavaScriptCore, or C JavaScript engine underneath it.

This is an experimental implementation, not yet a drop-in replacement for
QuickJS or Node. The last measured deterministic test262 sample passed 32.0%,
and the QuickJS test sweep passed 62.4%. See [the current status](docs/status.md)
for shipped capabilities, measured evidence, known gaps, and product gates.

There are two command-line binaries:

- `milojs-engine` runs raw JavaScript with no host bindings. Its target is a
  small embeddable engine in the same problem space as QuickJS.
- `milojs` adds CommonJS/ESM loading, an event loop, filesystem/network access,
  Node-compatible modules, and Node-API addon loading. Node compatibility is the
  API target; Deno and Bun are comparisons rather than additional contracts.

The tree walker keeps the implementation understandable but is substantially
slower than a production bytecode VM or JIT.

## Contracts

Milo contracts statically prove selected invariants. CI ratchets proved,
unknown, and refuted counts so a proof cannot silently disappear. An `unknown`
contract remains documentation, not runtime enforcement or a correctness proof.

## Install

```sh
P=$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
curl -fsSL https://github.com/milo-language/milojs/releases/download/latest/milojs-$P.tar.gz | tar xz
cd milojs-$P
```

Run it:

```sh
./milojs --version
./milojs script.js
```

Or run the engine without Node host bindings:

```sh
./milojs-engine --version
./milojs-engine script.js
```

## Build And Test

```sh
milo build milojs-engine.milo -o /tmp/mj-engine
milo build milojs.milo -o /tmp/mj-runtime
MILOJS_ENGINE_BIN=/tmp/mj-engine MILOJS_RUNTIME_BIN=/tmp/mj-runtime ./tests/run.sh
./tests/run-milo.sh
./tests/run-embed.sh
MILOJS_RUNTIME_BIN=/tmp/mj-runtime ./tests/run-napi.sh
```

## Embed The Engine

The preview C ABI is single-context while async/generator re-entry remains
process-global. It supports evaluation, primitive values, property reads,
exceptions, explicit value release, and GC-rooted object handles.

```sh
milo build-lib libmilojs.milo -o libmilojs.a
```

Include `include/milojs.h` together with the generated `libmilojs.h`. The tested
link recipe and transitive system libraries are in `tests/run-embed.sh`; the API
and ownership contract are documented in
[docs/milojs-embedding.md](docs/milojs-embedding.md).

## Node-API Addons

The runtime loads real `.node` shared libraries. Promise, reference, class,
wrapping, threadsafe-function, and synchronous JavaScript-callback paths are
implemented and exercised with a compiled differential addon. Thirteen of 64
entry points remain explicit compatibility stubs; Buffer interop is the most
important missing group.
