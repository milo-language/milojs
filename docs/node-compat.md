<!-- doc-meta
system: node-compat
purpose: per-module Node compatibility, derived from an export diff against node and from the test sweep
key-files: tools/gen-node-compat.mjs, docs/conformance/node-compat.json, lib/
update-when: generated — run `node tools/gen-node-compat.mjs`; never edit by hand
last-verified: 2026-08-19 (generated from the node-compat sweep at 3fcca363)
-->

# Node module compatibility

**Generated. Do not edit.** `node tools/gen-node-compat.mjs` rewrites this file and
`--check` fails if it is stale; both run in CI.

Two independent measurements per module, because either one alone lies:

- **exports** — how many of the names `node:<module>` exports under node also exist
  under milojs. A high number here means the SURFACE is present, not that it works.
- **tests** — node's own `test-<area>-*.js` cases that pass, out of those that ran.
  Skipped cases are counted separately and scored neither way.

Measured against node v25.3.0, sweep at `3fcca363`.

| module | loads | exports | tests | notable missing exports |
|---|---|---|---|---|
| `http2` | **no** | 0/11 0% | 0/0 (238 skipped) | `Http2ServerRequest`, `Http2ServerResponse`, `connect`, `constants`, `createSecureServer`, `createServer` +5 more |
| `inspector` | **no** | 0/8 0% | 1/1 (+54 skipped) | `Network`, `NetworkResources`, `Session`, `close`, `console`, `open` +2 more |
| `trace_events` | **no** | 0/2 0% | — | `createTracing`, `getEnabledCategories` |
| `wasi` | **no** | 0/1 0% | — | `WASI` |
| `constants` | yes | 0/230 0% | — | `COPYFILE_EXCL`, `COPYFILE_FICLONE`, `COPYFILE_FICLONE_FORCE`, `DH_CHECK_P_NOT_PRIME`, `DH_CHECK_P_NOT_SAFE_PRIME`, `DH_NOT_SUITABLE_GENERATOR` +224 more |
| `crypto` | yes | 7/69 10% | 0/0 (121 skipped) | `Certificate`, `Cipheriv`, `Decipheriv`, `DiffieHellman`, `DiffieHellmanGroup`, `ECDH` +56 more |
| `process` | yes | 30/83 36% | 21/76 (+5 skipped) | `_debugEnd`, `_debugProcess`, `_events`, `_eventsCount`, `_exiting`, `_fatalException` +47 more |
| `dns` | yes | 16/50 32% | 0/19 | `ADDRGETNETWORKPARAMS`, `BADFAMILY`, `BADFLAGS`, `BADHINTS`, `BADNAME`, `BADQUERY` +28 more |
| `fs` | yes | 70/104 67% | 74/219 (+8 skipped) | `Dir`, `Dirent`, `FileReadStream`, `FileWriteStream`, `ReadStream`, `Stats` +28 more |
| `module` | yes | 4/33 12% | 3/24 (+3 skipped) | `SourceMap`, `_cache`, `_extensions`, `_findPath`, `_initPaths`, `_load` +23 more |
| `util` | yes | 12/33 36% | 2/16 (+1 skipped) | `MIMEParams`, `MIMEType`, `TextDecoder`, `TextEncoder`, `_errnoException`, `_exceptionWithHostPort` +15 more |
| `zlib` | yes | 29/47 62% | 8/58 (+1 skipped) | `BrotliCompress`, `BrotliDecompress`, `Deflate`, `DeflateRaw`, `Gunzip`, `Gzip` +12 more |
| `stream` | yes | 8/23 35% | 54/164 (+1 skipped) | `_isArrayBufferView`, `_isUint8Array`, `_uint8ArrayToBuffer`, `addAbortSignal`, `compose`, `destroy` +9 more |
| `v8` | yes | 10/23 43% | 2/14 (+4 skipped) | `DefaultDeserializer`, `DefaultSerializer`, `Deserializer`, `GCProfiler`, `Serializer`, `getCppHeapStatistics` +7 more |
| `worker_threads` | yes | 11/21 52% | 13/118 (+7 skipped) | `BroadcastChannel`, `MessageChannel`, `MessagePort`, `SHARE_ENV`, `isInternalThread`, `isMarkedAsUntransferable` +4 more |
| `http` | yes | 11/20 55% | 71/371 (+6 skipped) | `CloseEvent`, `MessageEvent`, `OutgoingMessage`, `WebSocket`, `_connectionListener`, `maxHeaderSize` +3 more |
| `url` | yes | 6/14 43% | 4/14 | `URLPattern`, `domainToASCII`, `domainToUnicode`, `fileURLToPath`, `fileURLToPathBuffer`, `pathToFileURL` +2 more |
| `events` | yes | 10/17 59% | 1/4 | `EventEmitterAsyncResource`, `captureRejections`, `getMaxListeners`, `init`, `kMaxEventTargetListeners`, `kMaxEventTargetListenersWarned` +1 more |
| `repl` | yes | 0/7 0% | 19/83 (+7 skipped) | `REPLServer`, `REPL_MODE_SLOPPY`, `REPL_MODE_STRICT`, `Recoverable`, `isValidSyntax`, `start` +1 more |
| `cluster` | yes | 10/16 63% | 48/77 (+4 skipped) | `_eventsCount`, `_maxListeners`, `disconnect`, `fork`, `setupMaster`, `setupPrimary` |
| `console` | yes | 19/25 76% | 8/21 | `context`, `createTask`, `dirxml`, `profile`, `profileEnd`, `timeStamp` |
| `buffer` | yes | 8/13 62% | 19/56 (+1 skipped) | `Blob`, `File`, `INSPECT_MAX_BYTES`, `resolveObjectURL`, `transcode` |
| `test` | yes | 10/15 67% | — | `assert`, `only`, `skip`, `snapshot`, `todo` |
| `net` | yes | 13/17 76% | 27/133 (+3 skipped) | `BlockList`, `SocketAddress`, `_createServerHandle`, `_normalizeArgs` |
| `path` | yes | 14/17 82% | 1/16 (+1 skipped) | `_makeLong`, `matchesGlob`, `win32` |
| `async_hooks` | yes | 5/7 71% | 21/43 (+2 skipped) | `asyncWrapProviders`, `executionAsyncResource` |
| `perf_hooks` | yes | 11/13 85% | 3/12 | `Performance`, `PerformanceResourceTiming` |
| `sqlite` | yes | 3/5 60% | 0/1 (+12 skipped) | `Session`, `backup` |
| `tls` | yes | 16/18 89% | 1/7 (+181 skipped) | `getCACertificates`, `setDefaultCACertificates` |
| `assert` | yes | 20/21 95% | 2/13 | `Assert` |
| `child_process` | yes | 8/9 89% | 61/98 (+2 skipped) | `_forkChild` |
| `https` | yes | 5/6 83% | 0/0 (60 skipped) | `Server` |
| `os` | yes | 22/23 96% | 1/6 | `loadavg` |
| `querystring` | yes | 6/7 86% | 0/4 | `unescapeBuffer` |
| `dgram` | yes | 2/2 100% | 22/60 (+4 skipped) | — |
| `diagnostics_channel` | yes | 6/6 100% | 17/45 (+19 skipped) | — |
| `domain` | yes | 5/5 100% | 26/46 (+2 skipped) | — |
| `punycode` | yes | 6/6 100% | — | — |
| `readline` | yes | 8/8 100% | 3/15 | — |
| `string_decoder` | yes | 1/1 100% | 0/3 | — |
| `timers` | yes | 7/7 100% | 23/48 | — |
| `tty` | yes | 3/3 100% | 0/2 | — |
| `vm` | yes | 10/10 100% | 23/67 | — |

Across all 43 modules: **442/1056 exports present (42%)**.

Modules that do not load at all: `http2`, `inspector`, `trace_events`, `wasi`.
