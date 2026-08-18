# milojs

[![CI](https://github.com/milo-language/milojs/actions/workflows/ci.yml/badge.svg)](https://github.com/milo-language/milojs/actions/workflows/ci.yml)

<p align="center">
  <img src="docs/images/repl.png" alt="The milojs REPL evaluating console.log('Woof!')" width="760">
</p>

A JavaScript engine and runtime written in the [Milo](https://github.com/milo-language/milo) programming language. Two binaries:

- **`milojs-engine`** — an embeddable JavaScript engine. Raw JS, no host bindings, links into a native program as a static library.
- **`milojs`** — a full runtime in the same space as Node, Deno and Bun: modules, event loop, filesystem and network, Node-API addons.

Experimental, not yet a drop-in replacement for either.

## Conformance

The two binaries are measured separately, because they are separate claims: the
first two rows test the **engine** (the language itself), the third tests the
**runtime** (modules, event loop, host bindings). A score on one says nothing
about the other.

| suite | what it measures | score |
|---|---|---|
| [test262](https://github.com/tc39/test262) (<!--fact:t262-sample-->1500<!--/fact-->-case deterministic sample) | `milojs-engine` — ECMAScript | <!--fact:t262-pct-->77.5%<!--/fact--> (<!--fact:t262-pass-->1139<!--/fact-->/<!--fact:t262-scored-->1470<!--/fact-->) |
| [QuickJS test suite](https://github.com/quickjs-ng/quickjs) | `milojs-engine` — ECMAScript | <!--fact:qjs-pct-->73.8%<!--/fact--> (<!--fact:qjs-pass-->110<!--/fact-->/<!--fact:qjs-total-->149<!--/fact-->) |
| [Node `test/parallel`](https://github.com/nodejs/node/tree/main/test/parallel) (<!--fact:node-sample-->400<!--/fact-->-case sample of <!--fact:node-available-->3373<!--/fact--> externally runnable) | `milojs` — Node compatibility | <!--fact:node-pct-->42.3%<!--/fact--> (<!--fact:node-pass-->169<!--/fact-->/<!--fact:node-total-->400<!--/fact-->) |

The Node row runs Node's own tests, unmodified, through Node's own `test/common`
harness, invoking each as a plain `<binary> test.js`. <!--fact:node-excluded-->606<!--/fact--> of Node's 3979
parallel tests are excluded as not externally runnable: they declare
`// Flags: --expose-internals` (Node's own runner re-execs with those flags) or
`require("internal/...")`, Node's private module tree. Neither is implementable
by a third party, so counting them scores every other runtime against a
denominator it cannot reach.

The same harness scores any node-compatible binary. On the identical sample:
**node itself 87.5%**, **bun 45.5%**.

Read both comparisons carefully. Node's 87.5% rather than 100% is this harness's
ceiling. And bun's 45.5% is *not* bun's compatibility: Bun
[reports 94-100% per module](https://bun.com/docs/runtime/nodejs-compat), measured
on its own vendored copies of these tests run under `bun test`. This row measures
something narrower — node's unmodified tests, launched as a plain script — which
penalizes bun where its harness differs (it declines `node:test` outside
`bun test`). The two numbers answer different questions.

For more details, see [docs/status.md](docs/status.md).

## Install

Rolling builds from the latest passing commit on `main`, for Linux x64/arm64 and macOS arm64:

```sh
P=$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')
curl -fsSL https://github.com/milo-language/milojs/releases/download/latest/milojs-$P.tar.gz | tar xz
cd milojs-$P
```

## Usage

<!-- exec -->
```sh
printf 'const name = "Milo"; console.log(`hello from ${name}`);\n' > hello.js
./milojs-engine hello.js
```

```text
hello from Milo
```

Run `./milojs` instead for the full runtime — `require`, ESM, timers, `fs`, `http`, `fetch` and Node-API addons. Run either with no arguments for a REPL.

## Embed The Engine

Build the static library, then compile the [C example](examples/embed/hello.c):

```sh
# Linux
milo build-lib src/libmilojs.milo -o libmilojs.a &&
cc -std=c11 -I. -Iinclude examples/embed/hello.c libmilojs.a -lm -lssl -lcrypto -lsqlite3 -ldl -pthread -o hello &&
./hello
```

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

The C ABI is a preview and single-context. API and ownership contract: [docs/milojs-embedding.md](docs/milojs-embedding.md).

## Build From Source

Needs the latest [Milo compiler](https://github.com/milo-language/milo/releases), Clang 16+, and OpenSSL headers.

```sh
tools/dev.sh          # build both binaries and run every suite
tools/precommit.sh    # fast checks before committing
```

## Development

[AGENTS.md](AGENTS.md) is the repository workflow. [docs/status.md](docs/status.md) is the capability dashboard, [docs/backlog.md](docs/backlog.md) is current work.

## License

[MIT](LICENSE).
