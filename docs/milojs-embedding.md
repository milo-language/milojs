<!-- doc-meta
system: milojs-embedding
purpose: how to link libmilojs.a into a C program — inputs, build, and where the callable API is listed
key-files: src/libmilojs.milo, include/milojs.h, examples/embed/hello.c, tests/run-embed.sh
update-when: an ABI function lands or the build inputs change
last-verified: 2026-08-19
-->

# Embedding milojs in C

## Inputs

Three, and `milo build-lib` produces two of them:

| input | where it comes from |
|---|---|
| `libmilojs.a` | `milo build-lib src/libmilojs.milo -o <dir>/libmilojs.a` |
| `libmilojs.h` | written by that same command, next to the `.a` |
| `milojs.h` | checked in at `include/milojs.h` — copy it next to the other two |

`milojs.h` includes `libmilojs.h`, so both must be on the include path. Include
`milojs.h`; it is the one with the status and value-kind enums.

## Build

```sh
milo build-lib src/libmilojs.milo -o /tmp/embed/libmilojs.a
cp include/milojs.h /tmp/embed/

cc -std=c11 -I/tmp/embed your.c /tmp/embed/libmilojs.a \
   -lm -lssl -lcrypto -lsqlite3 -ldl -pthread -o your-program
```

On macOS drop `-lm -ldl`, and add `-I$(brew --prefix openssl@3)/include
-L$(brew --prefix openssl@3)/lib` — Homebrew's OpenSSL is keg-only.

The extra libraries are not optional: the archive has undefined `sqlite3_*` and
`SSL_*` symbols because `node:sqlite` and TLS call them directly. Milo adds
these flags itself when it links a binary; an embedder linking the archive with
its own compiler does not get them.

## What you can call

`libmilojs.h` is the list. It is generated from the `pub fn` exports in
`src/libmilojs.milo` on every build, so it cannot go stale.

From a built archive:

```sh
nm -g /tmp/embed/libmilojs.a | grep ' T _\?milojs_'
```

The `milojs_*` functions are the embedding API. `libmilojs.h` also declares
~90 `napi_*` functions; those exist so compiled Node-API addons resolve their
imports at link time and are not an embedding surface.

## API

Every function returns `int32_t` status (`MILOJS_STATUS_OK` is 0) unless noted.
`context` and `value` are opaque `int64_t` handles.

| function | does |
|---|---|
| `milojs_context_new(int64_t *out)` | create a context |
| `milojs_context_free(int64_t ctx)` | destroy it, releasing every live handle |
| `milojs_eval(ctx, uint8_t *src, int64_t len, int64_t *out)` | evaluate source, produce a value handle |
| `milojs_value_kind(ctx, val)` | returns a `milojs_value_kind`, not a status |
| `milojs_value_bool(ctx, val, bool *out)` | read a boolean |
| `milojs_value_number(ctx, val, double *out)` | read a number |
| `milojs_value_string_length(ctx, val)` | byte length, or negative on error |
| `milojs_value_string_copy(ctx, val, uint8_t *out, int64_t cap)` | bytes written, or negative |
| `milojs_value_get(ctx, val, uint8_t *key, int64_t keyLen, int64_t *out)` | read a property |
| `milojs_value_release(ctx, val)` | release one handle |
| `milojs_exception_length(ctx)` | pending exception's message length |
| `milojs_exception_copy(ctx, uint8_t *out, int64_t cap)` | copy it out |

Strings are UTF-8 and not NUL-terminated: call the `_length` function, allocate,
then call the `_copy` function.

A handle is valid until `milojs_value_release` or `milojs_context_free`. Using a
released handle returns `MILOJS_STATUS_INVALID_ARGUMENT` rather than reading
freed memory.

## Constraints

- **One context per process.** Async, generator, and Node-API re-entry use
  process-global interpreter state. A second `milojs_context_new` while one is
  live returns `MILOJS_STATUS_BUSY`.
- **No native function registration.** C cannot install a callback that JS
  calls; the traffic is one-way.

## Working example

`examples/embed/hello.c`, built and run by `tests/run-embed.sh` on every
`tools/dev.sh`. That script is also the reference for the exact compiler and
linker flags per platform.
