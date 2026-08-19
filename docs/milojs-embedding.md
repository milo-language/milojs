<!-- doc-meta
system: milojs-embedding
purpose: design and acceptance contract for the public C embedding API
key-files: src/libmilojs.milo, src/engine/driver.milo, src/engine/runtime.milo, src/engine/eval.milo, src/engine/ast.milo
update-when: an ABI function lands, ownership changes, or multi-context constraints change
last-verified: 2026-07-30
-->

# milojs embedding API

## Goal

Expose `milojs-engine` as a static library that a C, C++, Rust, Go, or Python
host can drive without depending on Milo data layouts. The ABI uses fixed-width
scalars and opaque integer handles; Milo strings, vectors, enums, references,
and structs never cross the boundary.

`milo build-lib src/libmilojs.milo -o libmilojs.a` generates the low-level function
declarations in `libmilojs.h`. Consumers include the checked-in `milojs.h`, which
adds stable status constants and includes that generated file. A C smoke test is
the acceptance gate, not merely successful Milo compilation.

The preview static archive currently requires the host link to include its
transitive system libraries (`libm`, OpenSSL, libsqlite3, dynamic loading, and
pthreads on Linux). Milo adds `-lsqlite3` itself when it links a binary, but an
embedder driving its own link does not inherit that, so the archive carries
undefined `sqlite3_*` symbols until the host names the library. `tests/run-embed.sh` is the executable link recipe and accepts
`MILOJS_EMBED_LIBS` for nonstandard toolchains. Release packaging should replace
this manual list with `pkg-config` metadata.

## What an embedded script can reach

The library exposes the ECMAScript language and nothing else. Script code inside
an embedded context has no filesystem, process, socket, or sqlite access: those
71 capabilities are `__`-prefixed globals installed by `installHostGlobals` in
`src/runtime/host.milo`, which only the `milojs` runtime binary calls.

This was not always true, and it is worth stating plainly because the previous
behaviour was the opposite of what an embedder would assume. `setupGlobals` in
the engine bootstrap installed all 71, so any script run through `libmilojs` or
`milojs-engine` could call `__spawnSync("/bin/sh", ...)` and get a shell. A host
embedding a JS engine to run untrusted or semi-trusted script had no sandbox at
all, and no import edge or type signature revealed it.

`tools/check-layering.sh` now runs both binaries and asserts the split directly:
`typeof __spawnSync` must be `undefined` under `milojs-engine` and `function`
under `milojs`. An embedder that wants a host surface builds it deliberately on
top of the ABI rather than inheriting one by accident.

## Current architectural constraint

The interpreter is not yet multi-context:

- normal evaluator paths take `&mut Interp`;
- async and generator task bodies re-enter through global `gProg` and `gInterp`
  because a spawned task cannot retain references to its creator's stack;
- Node-API callbacks also use `gInterp` because foreign callback stacks carry no
  Milo reference;
- Milo correctly forbids casting a raw pointer into `&mut Interp`.

Consequently the preview ABI supports one live runtime per process. Its context
handle detects stale or incorrect calls but does not imply isolated concurrent
contexts. `milojs_context_new` returns an explicit busy error while another
context is live. This is preferable to an API that appears multi-context and
silently shares globals.

Multi-context support requires replacing the global task/callback re-entry seam
with stable context IDs and a context registry. That refactor must include
`gProg`, async activations, generators, Node-API environment identity, and GC
roots as one change.

## Preview ABI

All handles are nonzero `int64_t` values. Zero is invalid. Status functions
return zero on success and a negative `MILOJS_STATUS_*` code on API misuse or
host failure; a JavaScript exception has its own status.

```c
int32_t milojs_context_new(int64_t *out_context);
void milojs_context_free(int64_t context);

int32_t milojs_eval(int64_t context,
                    const uint8_t *source,
                    int64_t source_length,
                    int64_t *out_value);

int32_t milojs_value_kind(int64_t context, int64_t value);
int32_t milojs_value_bool(int64_t context, int64_t value, bool *out);
int32_t milojs_value_number(int64_t context, int64_t value, double *out);
int64_t milojs_value_string_length(int64_t context, int64_t value);
int64_t milojs_value_string_copy(int64_t context, int64_t value,
                                 uint8_t *out, int64_t capacity);
void milojs_value_release(int64_t context, int64_t value);

int64_t milojs_exception_length(int64_t context);
int64_t milojs_exception_copy(int64_t context,
                              uint8_t *out, int64_t capacity);
```

The generated header is authoritative for function signatures; `milojs.h` is the
public include and owns constants. This sketch fixes semantics and naming while
implementation details are still being added.

## Evaluation semantics

- `milojs_eval` executes a complete script and returns the completion value of
  its final expression statement, or `undefined` when the script has no value.
- Parse and early errors are JavaScript exceptions, not process termination.
- No exception is printed by the library. The host reads it through the
  exception-copy functions.
- The engine prelude is loaded once when the context is created.
- Event-loop draining follows engine behavior. The preview remains single-
  threaded and non-reentrant; a host callback cannot recursively call eval.

The existing CLI path prints uncaught exceptions and discards completion values,
so library evaluation needs a shared lower-level driver result rather than
capturing CLI output or wrapping source text.

## Value ownership

Values returned to C occupy slots in an embedding handle table owned by the
context. Object-valued slots are explicit GC roots. Releasing a handle removes
that root; context destruction releases all remaining handles.

Primitive accessors reject the wrong kind rather than coercing. String copying
uses the standard two-call pattern: query byte length, then copy into a caller-
owned buffer. No pointer into the moving or managed Milo representation escapes.

## Native callbacks

Native-function registration follows after evaluation and primitive exchange
are stable. The callback ABI must carry the context, argument handles, and host
data, return a value handle or exception status, and enforce non-reentrancy
explicitly. Do not reuse Node-API's process-global handle table: embedding value
lifetimes and Node-API environment lifetimes are different contracts.

## Acceptance sequence

1. **Linux done:** build the library and generated header on Linux and macOS.
2. **Done:** C creates and frees a context; a second simultaneous context is rejected.
3. **Done:** C evaluates arithmetic and reads a number.
4. **Done:** C evaluates a string containing an embedded NUL and copies its exact bytes.
5. **Done:** C evaluates a throwing script and reads the exception without library output.
6. **Done:** a retained object survives forced GC; release removes it from the
   host root set and invalidates the handle.
7. Sanitizer or repeated create/eval/free coverage catches teardown leaks and
   stale handles.
8. Register and invoke one C callback from JavaScript.

Each step lands with its C test. Steps 1-6 now form the embedding preview on
Linux; macOS CI and native callbacks remain before the API is broadly useful.
