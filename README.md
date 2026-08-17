# milojs

[![CI](https://github.com/milo-language/milojs/actions/workflows/ci.yml/badge.svg)](https://github.com/milo-language/milojs/actions/workflows/ci.yml)

<p align="center">
  <img src="docs/images/repl.png" alt="The milojs REPL evaluating console.log('Woof!')" width="760">
</p>

A JavaScript engine and runtime written in the [Milo](https://github.com/milo-language/milo) programming language.

MiloJS owns its parser, tree-walking evaluator, garbage collector, regular expression engine, BigInt implementation, module loader, and event loop. It has no V8, JavaScriptCore, or C JavaScript engine underneath it — about <!--fact:loc-milo-->40.3k<!--/fact--> lines of Milo from source text to running program, plus a <!--fact:loc-js-->7.5k<!--/fact-->-line JavaScript specification layer for the builtins that read better written in JavaScript. It starts in a few milliseconds and embeds into a C program as a static library.

This is an experimental implementation, not yet a drop-in replacement for QuickJS or Node. It passes <!--fact:t262-pct-->69.0%<!--/fact--> of a deterministic <!--fact:t262-sample-->1500<!--/fact-->-case test262 sample and <!--fact:qjs-pct-->69.8%<!--/fact--> of the QuickJS test suite. See [the current status](docs/status.md) for shipped capabilities, measured evidence, known gaps, and product gates.

There are two command-line binaries:

- `milojs-engine` runs raw JavaScript with no host bindings. Its target is a small embeddable engine in the same problem space as QuickJS.
- `milojs` adds CommonJS loading, parse-time ESM compatibility lowering, an event loop, filesystem/network access, Node-compatible modules, and Node-API addon loading. Node compatibility is the API target; Deno and Bun are comparisons rather than additional contracts.

The tree walker keeps the implementation understandable but is substantially slower than a production bytecode VM or JIT.

## Install

Rolling builds from the latest passing commit on `main` are available for Linux x64/arm64 and macOS arm64:

```sh
P=$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
curl -fsSL https://github.com/milo-language/milojs/releases/download/latest/milojs-$P.tar.gz | tar xz
cd milojs-$P
```

Verify the downloaded binaries:

```sh
./milojs --version
./milojs-engine --version
```

## Quick Example

<!-- exec -->
```sh
printf 'const name = "Milo"; console.log(`hello from ${name}`);\n' > hello.js
./milojs-engine hello.js
```

```text
hello from Milo
```

Use the `milojs-engine` CLI to evaluate raw JavaScript without built-in host APIs. Embedders can provide their own host through the preview `libmilojs` C ABI. The `milojs` runtime is one such host: it adds modules, timers, filesystem and network APIs, and Node-API addons.

## Build And Test

Building from source requires the latest released [Milo compiler](https://github.com/milo-language/milo/releases), Clang 16 or newer, and OpenSSL development libraries. The complete test suite also uses Z3 for static contract verification.

```sh
milo build src/milojs-engine.milo -o /tmp/mj-engine
milo build src/milojs.milo -o /tmp/mj-runtime
MILOJS_ENGINE_BIN=/tmp/mj-engine MILOJS_RUNTIME_BIN=/tmp/mj-runtime ./tests/run.sh
./tests/run-milo.sh
MILOJS_RUNTIME_BIN=/tmp/mj-runtime ./tests/run-repl.sh
./tests/run-embed.sh
MILOJS_RUNTIME_BIN=/tmp/mj-runtime ./tests/run-napi.sh
```

Run the fast symbol and generated-document checks before committing:

```sh
./tools/precommit.sh
```

## Embed The Engine

The preview C ABI is single-context while async/generator re-entry remains process-global. It supports evaluation, primitive values, property reads, exceptions, explicit value release, and GC-rooted object handles. `milo build-lib` must finish successfully because it generates both `libmilojs.a` and `libmilojs.h`.

Build the library, then compile and run the [C embedding example](examples/embed/hello.c).

On Linux:

```sh
# Linux
milo build-lib src/libmilojs.milo -o libmilojs.a &&
cc -std=c11 -I. -Iinclude examples/embed/hello.c libmilojs.a -lm -lssl -lcrypto -lsqlite3 -ldl -pthread -o hello &&
./hello
```

On macOS (drop `-lm`/`-ldl`; point at Homebrew's OpenSSL):

```sh
# macOS
milo build-lib src/libmilojs.milo -o libmilojs.a &&
cc -std=c11 -I. -Iinclude \
  -I"$(brew --prefix openssl)/include" -L"$(brew --prefix openssl)/lib" \
  examples/embed/hello.c libmilojs.a -lssl -lcrypto -lsqlite3 -pthread -o hello &&
./hello
```

```text
hello from embedded milo, woof! the answer is 42
```

Include `include/milojs.h` together with the generated `libmilojs.h`. The tested link recipe and transitive system libraries are in `tests/run-embed.sh`; the API and ownership contract are documented in [docs/milojs-embedding.md](docs/milojs-embedding.md).

## Node-API Addons

The runtime loads real `.node` shared libraries. Promise, reference, class, wrapping, threadsafe-function, and synchronous JavaScript-callback paths are implemented and exercised with a compiled differential addon. Some entry points remain explicit compatibility stubs; the maintained count and important gaps are listed in [the current status](docs/status.md).

## Development

Start with [AGENTS.md](AGENTS.md) for the repository workflow and Milo-specific hazards. The [status](docs/status.md) is the canonical capability dashboard, the [backlog](docs/backlog.md) carries current work, and the [roadmap](docs/milojs-roadmap.md) records product gates and design direction.

Milo contracts statically prove selected invariants. CI ratchets proved, unknown, and refuted counts so a proof cannot silently disappear. An `unknown` contract remains documentation, not runtime enforcement or a correctness proof.

## License

MiloJS is available under the [MIT License](LICENSE).
