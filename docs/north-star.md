<!-- doc-meta
system: north-star
purpose: target design for the engine core and the Node runtime, what is kept from the current tree, and the order of work with its gates
key-files: src/engine/eval.milo, src/engine/value.milo, src/engine/runtime.milo, src/engine/bytecode.milo, src/engine/methods.milo, src/engine/builtins.milo, src/engine/lexer.milo, src/engine/parser.milo, src/engine/ast.milo, src/engine/regex.milo, src/engine/unicase.milo, src/engine/bigint.milo, src/runtime/napi.milo, lib/engine-prelude.js, lib/temporal.js, lib/http.js, bench/run.sh
update-when: a design rule here is changed or reopened, a phase lands, or the kept/replaced list changes
last-verified: 2026-11-09 (written; design only, no code follows it yet)
-->

# North star: engine and runtime design

Status: design. No code follows it yet. Where this file and
`docs/milojs-gc-boundary.md` or `docs/decisions.md` disagree, this file is newer.

## Goal

A JavaScript engine and a Node-compatible runtime, both written in Milo.

- **Engine:** an interpreter in the class of QuickJS. Full test262 (Intl and Temporal
  included), speed within 2x of QuickJS, small binary, fast start.
- **Runtime:** runs unmodified Node programs. The JavaScript half is Node's own `lib/`,
  vendored. The native half (Node's internal bindings) is written in Milo on top of
  vendored C libraries.
- **What is different from other runtimes:** the engine and the bindings are in a
  memory-safe language. The C libraries underneath are the trusted base, and they are
  listed.

The closest existing product is AWS LLRT (a Node-style runtime on QuickJS, built for fast
start), with the engine in a memory-safe language instead of C.

## Non-goals

- A JIT. Hot loops will be QuickJS-class, far behind V8, JavaScriptCore and Bun.
- Hand-written copies of Node's JavaScript library.
- A line-by-line port of QuickJS. Its data model (atoms, shapes, variable references,
  bytecode for every function) is adopted on purpose. Its code is not.

## Why the core is rebuilt

The current core was grown from a tree walker, and its data model is the reason for the
speed gap:

| part | current | cost |
|---|---|---|
| scope | a `Vec` of name/value bindings, searched by string compare | every variable access outside the bytecode slots |
| object | a `Vec` of properties with string keys, and about thirty `bool` fields per object | every property access |
| value | an owned enum that holds Milo strings | every copy is a clone and every discard a drop |
| execution | bytecode for most bodies, tree walker for the rest | every rule exists in two places |
| GC roots | hand bookkeeping, then a conservative stack scan | a missed root is found by a test timeout |
| exceptions | a flag on the interpreter, read at about 500 call sites | a missed check continues in a throwing state |

One measurement, taken once on 2026-11-09 (darwin-arm64, tree at `2c45d2a`, quickjs-ng
built from source, best of 5, start-up subtracted, the benches in `bench/`): numeric loops
and local reads 1.6x to 2.0x slower than QuickJS, property reads and writes 14x to 27x,
function calls 21x to 48x, median 6.4x over 16 benches. `bench/run.sh` measures against
bun only, which has a JIT, so its ratios say nothing about which mechanism is slow. This
number is not gated. The first task below makes it a committed report.

Conformance work landed before these representations were fixed, so each of them is now
used by every builtin. That is why this is a rebuild of the core and not a series of
optimizations.

## Design rules

Each rule is an invariant. A change that breaks one needs this file changed first.

### 1. A value is a small copyable handle

```milo
enum Value {
    Undefined,
    Null,
    Bool(bool),
    Int(i32),
    Number(f64),
    Str(StrId),
    Sym(SymId),
    BigInt(BigIntId),
    Obj(ObjId),
}
```

Sixteen bytes, no owned data, no drop. Strings, objects, big integers and symbols live
in the heap and a value holds an index. Copying a value out of the heap before calling
back into the interpreter costs nothing, which is what Milo's borrowing rules need.
NaN-boxing to eight bytes is a later, measured step.

### 2. Names are atoms

Every identifier and property name is interned once to a `u32`. Comparing two names is
comparing two integers. No string is cloned to read or write a property.

### 3. Variables are resolved when the function is compiled

A local is a slot in the frame. A captured variable is a heap cell shared by the closures
that capture it. A global is a property of the global object. Dynamic scope objects exist
only where the source uses `with` or a direct sloppy `eval`.

### 4. Objects have shapes

An object is a shape id and a slot array. The shape maps an atom to a slot index and a
flag set, and shapes form a transition tree, so objects built the same way share one.
Array elements are a separate dense array. The kind of object (array, date, map, proxy,
typed array) is one class id, and per-class data lives in a side table for that class.
No inline caches at first: a lookup is a hash probe in the shape, as in QuickJS.

### 5. One execution engine

Every function body compiles to bytecode. There is no tree walker. Frames are allocated
in the heap, not on the native stack, so:

- a generator or an async function is a saved frame, not a green task with its own stack;
- recursion depth is a counter, the same on every platform;
- a JS-to-JS call does not recurse in Milo.

### 6. The collector runs only at VM safepoints

Safepoints are loop back-edges, calls and returns in the bytecode loop. A native function
written in Milo is a leaf: it does not call back into JavaScript, so no safepoint happens
while it holds values in locals, and it needs no rooting. A builtin that must call
JavaScript (a callback, a getter, `valueOf`) is written in JavaScript on top of leaf
intrinsics, the way `lib/engine-prelude.js` already does for part of the library.

Roots are then exact and few: the VM stack, the frames, the realms, the atom table, and
the handle table for embedders and Node-API. There is no temporary root list and no
stack scan.

If a measured workload is bound by a self-hosted builtin, the second step is a native
frame with declared value slots that the collector reads. Not before.

### 7. A throw is a `Result`

Every operation that can throw returns `Result<Value, Thrown>` and callers use `?`. The
compiler then rejects a call site that ignores a throw. In bytecode, a function has a
handler table and a throw unwinds to the nearest handler.

### 8. Flat data

Strings, objects, shapes, frames and cells each live in a typed arena and are named by a
`u32` index. Mark and sweep, no moving. Debug builds carry a generation in each handle,
so a stale handle is a trap at the point of use, never a read of another object.
Weak maps (as ephemerons), weak references and finalization registries are part of the
first collector, because Node's library uses them.

### 9. Strings

Immutable, stored as Latin-1 or UTF-16, which keeps lone surrogates. Concatenation
builds a rope that is flattened on first read, so appending in a loop is linear.

### 10. Realms from the start

Intrinsics hang off a realm record and every function knows its realm. The first
milestone runs one realm, but nothing assumes there is only one.

## Runtime

Node is mostly vendored code: its own JavaScript library plus C libraries. The runtime
here is built the same way.

| piece | source |
|---|---|
| `fs`, `http`, `stream`, `net`, `events`, module loading and the rest of the JavaScript API | Node's `lib/` from one pinned release, unmodified where possible |
| `fetch` | undici, as Node does |
| crypto and TLS | OpenSSL |
| compression | zlib, brotli |
| HTTP parsing, DNS, HTTP/2 | llhttp, c-ares, nghttp2 |
| `Intl` | ICU |
| test suites | test262 and Node `test/parallel`, pinned and vendored |

What is written here, in Milo:

- **The internal bindings.** Node's library reaches the native side through about 70
  `internalBinding(name)` modules. Each one is a Milo module with the same exports. They
  are implemented in the order that unlocks the most `test/parallel` cases.
- **The bootstrap.** Node's library expects `primordials`, `process`, the binding
  loaders and a few V8-specific APIs (`Error.captureStackTrace`,
  `Error.prepareStackTrace`, stack trace limits) to exist before its first line runs.
- **The event loop**, on Milo's tasks and I/O, with the microtask queue the spec
  describes.
- **Node-API**, carried over from `src/runtime/napi.milo` onto the handle table.

The hand-written modules in `lib/` (for example `lib/http.js`) are deleted as the
vendored module that replaces each one passes more of its tests.

Node's library uses nearly all of the language, so it will not boot until the engine is
close to complete. The engine comes first for that reason.

## Kept and replaced

Line counts are from 2026-11-09 and are here only for scale.

| kept | why |
|---|---|
| `src/engine/lexer.milo`, `src/engine/parser.milo`, `src/engine/ast.milo` | the front end is independent of how code runs |
| `src/engine/regex.milo`, `src/engine/unicase.milo` | self-contained; take atoms and string ids at the boundary |
| `src/engine/bigint.milo` | correct; its decimal-string storage is replaced later |
| `lib/engine-prelude.js`, `lib/temporal.js` | already JavaScript on top of intrinsics |
| every fixture, sweep, report, pass set and gate | this is the oracle for the new core |

About 11k of 53k lines of Milo.

| replaced | by |
|---|---|
| `src/engine/eval.milo` (the tree walker, 19k lines) | nothing; the bytecode compiler covers every body |
| `src/engine/value.milo`, `src/engine/runtime.milo` | rules 1, 2, 4, 8 and 9 |
| `src/engine/bytecode.milo` | a compiler and loop for the whole language, rules 3, 5 and 7 |
| `src/engine/methods.milo`, `src/engine/builtins.milo` | the same behavior, as leaf natives plus self-hosted JavaScript (rule 6) |
| the hand-written Node modules in `lib/` | Node's `lib/` |

The old core is not deleted first. It stays in the tree and keeps answering, and the new
core is checked against it and against QuickJS case by case. It is deleted when the new
core passes every case in the old pass sets (`docs/conformance/passset-*.txt`).

## Order of work

Each phase has one number that says whether it is done.

1. **Measure against the right peer.** `bench/run.sh` takes QuickJS as a second peer and
   writes the ratio into the committed bench report, with a ceiling per bench.
2. **Spike the call path.** Rules 1, 2 and 3 for plain functions only, in a new
   directory beside the old core. Gate: the function-call benches within 5x of QuickJS.
   If Milo itself is what prevents that, the finding goes to the Milo backlog and this
   plan stops here.
3. **New core.** Rules 1 to 10, bytecode for every body, builtins ported area by area in
   the order of the test262 failure table. Gates: full test262 (not a sample), a superset
   of the old pass sets, byte-identical output against QuickJS on the fixtures, median
   within 2x of QuickJS and no bench worse than 4x.
4. **Delete the old core** in the commit where the pass sets are a superset.
5. **Boot Node's library.** Gate: `console.log` and `require('fs')` run through the
   vendored bootstrap with no hand-written module on the path.
6. **Bindings**, ranked by `test/parallel` cases unlocked. Gate: the Node sweep, same
   denominator as today.

No Node compatibility work is done on the current core.

## Open questions

- Stack bytecode (as QuickJS and the current VM) or registers. Default: stack, and
  measure in the spike.
- How much of the builtin library can be self-hosted before speed suffers. Rule 6 names
  the fallback; the spike on `Array.prototype` methods should give the first number.
- Whether ICU is linked whole or as a reduced data set. It decides the binary size.
- Whether regular expressions stay on `src/engine/regex.milo` or move to a vendored C
  engine. Default: stay, since a regex engine in C would be the largest unsafe surface
  that handles untrusted input.
