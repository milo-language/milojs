<!-- doc-meta
system: node-compat
purpose: per-module Node compatibility, derived from an export diff against node and from the test sweep
key-files: tools/gen-node-compat.mjs, docs/conformance/node-compat.json, lib/
update-when: generated; run `node tools/gen-node-compat.mjs`, never edit by hand
last-verified: 2026-08-19 (generated from the node-compat sweep at 3fcca363)
-->

# Node module compatibility

**Generated. Do not edit.** `node tools/gen-node-compat.mjs` rewrites this file and
`--check` fails if it is stale; both run in CI.

Two independent measurements per module, because either one alone lies:

- **exports**: how many of the names `node:<module>` exports under node also exist
  under milojs. A high number here means the SURFACE is present, not that it works.
- **tests**: node's own `test-<area>-*.js` cases that pass, out of those that ran.
  Skipped cases are counted separately and scored neither way.

Measured against node v25.3.0, sweep at `3fcca363`.

Row colour bands export coverage: 🟢 90%+, 🟡 60-90%, 🔴 below 60% or does not load.

| | module | exports | tests | notable missing exports |
|---|---|---|---|---|
| 🔴 | `http2` **(does not load)** | 0/11 0% | 0/0 (238 skipped) | `Http2ServerRequest`, `Http2ServerResponse`, `connect`, `constants`, `createSecureServer`, `createServer` +5 more |
| 🔴 | `inspector` **(does not load)** | 0/8 0% | 1/1 (+54 skipped) | `Network`, `NetworkResources`, `Session`, `close`, `console`, `open` +2 more |
| 🔴 | `trace_events` **(does not load)** | 0/2 0% | n/a | `createTracing`, `getEnabledCategories` |
| 🔴 | `wasi` **(does not load)** | 0/1 0% | n/a | `WASI` |
| 🔴 | `constants` | 0/230 0% | n/a | `COPYFILE_EXCL`, `COPYFILE_FICLONE`, `COPYFILE_FICLONE_FORCE`, `DH_CHECK_P_NOT_PRIME`, `DH_CHECK_P_NOT_SAFE_PRIME`, `DH_NOT_SUITABLE_GENERATOR` +224 more |
| 🔴 | `crypto` | 7/69 10% | 0/0 (121 skipped) | `Certificate`, `Cipheriv`, `Decipheriv`, `DiffieHellman`, `DiffieHellmanGroup`, `ECDH` +56 more |
| 🔴 | `process` | 30/83 36% | 21/76 (+5 skipped) | `_debugEnd`, `_debugProcess`, `_events`, `_eventsCount`, `_exiting`, `_fatalException` +47 more |
| 🔴 | `dns` | 16/50 32% | 0/19 | `ADDRGETNETWORKPARAMS`, `BADFAMILY`, `BADFLAGS`, `BADHINTS`, `BADNAME`, `BADQUERY` +28 more |
| 🟡 | `fs` | 70/104 67% | 74/219 (+8 skipped) | `Dir`, `Dirent`, `FileReadStream`, `FileWriteStream`, `ReadStream`, `Stats` +28 more |
| 🔴 | `module` | 4/33 12% | 3/24 (+3 skipped) | `SourceMap`, `_cache`, `_extensions`, `_findPath`, `_initPaths`, `_load` +23 more |
| 🔴 | `util` | 12/33 36% | 2/16 (+1 skipped) | `MIMEParams`, `MIMEType`, `TextDecoder`, `TextEncoder`, `_errnoException`, `_exceptionWithHostPort` +15 more |
| 🟡 | `zlib` | 29/47 62% | 8/58 (+1 skipped) | `BrotliCompress`, `BrotliDecompress`, `Deflate`, `DeflateRaw`, `Gunzip`, `Gzip` +12 more |
| 🔴 | `stream` | 8/23 35% | 54/164 (+1 skipped) | `_isArrayBufferView`, `_isUint8Array`, `_uint8ArrayToBuffer`, `addAbortSignal`, `compose`, `destroy` +9 more |
| 🔴 | `v8` | 10/23 43% | 2/14 (+4 skipped) | `DefaultDeserializer`, `DefaultSerializer`, `Deserializer`, `GCProfiler`, `Serializer`, `getCppHeapStatistics` +7 more |
| 🔴 | `worker_threads` | 11/21 52% | 13/118 (+7 skipped) | `BroadcastChannel`, `MessageChannel`, `MessagePort`, `SHARE_ENV`, `isInternalThread`, `isMarkedAsUntransferable` +4 more |
| 🔴 | `http` | 11/20 55% | 71/371 (+6 skipped) | `CloseEvent`, `MessageEvent`, `OutgoingMessage`, `WebSocket`, `_connectionListener`, `maxHeaderSize` +3 more |
| 🔴 | `url` | 6/14 43% | 4/14 | `URLPattern`, `domainToASCII`, `domainToUnicode`, `fileURLToPath`, `fileURLToPathBuffer`, `pathToFileURL` +2 more |
| 🔴 | `events` | 10/17 59% | 1/4 | `EventEmitterAsyncResource`, `captureRejections`, `getMaxListeners`, `init`, `kMaxEventTargetListeners`, `kMaxEventTargetListenersWarned` +1 more |
| 🔴 | `repl` | 0/7 0% | 19/83 (+7 skipped) | `REPLServer`, `REPL_MODE_SLOPPY`, `REPL_MODE_STRICT`, `Recoverable`, `isValidSyntax`, `start` +1 more |
| 🟡 | `cluster` | 10/16 63% | 48/77 (+4 skipped) | `_eventsCount`, `_maxListeners`, `disconnect`, `fork`, `setupMaster`, `setupPrimary` |
| 🟡 | `console` | 19/25 76% | 8/21 | `context`, `createTask`, `dirxml`, `profile`, `profileEnd`, `timeStamp` |
| 🟡 | `buffer` | 8/13 62% | 19/56 (+1 skipped) | `Blob`, `File`, `INSPECT_MAX_BYTES`, `resolveObjectURL`, `transcode` |
| 🟡 | `test` | 10/15 67% | n/a | `assert`, `only`, `skip`, `snapshot`, `todo` |
| 🟡 | `net` | 13/17 76% | 27/133 (+3 skipped) | `BlockList`, `SocketAddress`, `_createServerHandle`, `_normalizeArgs` |
| 🟡 | `path` | 14/17 82% | 1/16 (+1 skipped) | `_makeLong`, `matchesGlob`, `win32` |
| 🟡 | `async_hooks` | 5/7 71% | 21/43 (+2 skipped) | `asyncWrapProviders`, `executionAsyncResource` |
| 🟡 | `perf_hooks` | 11/13 85% | 3/12 | `Performance`, `PerformanceResourceTiming` |
| 🟡 | `sqlite` | 3/5 60% | 0/1 (+12 skipped) | `Session`, `backup` |
| 🟡 | `tls` | 16/18 89% | 1/7 (+181 skipped) | `getCACertificates`, `setDefaultCACertificates` |
| 🟢 | `assert` | 20/21 95% | 2/13 | `Assert` |
| 🟡 | `child_process` | 8/9 89% | 61/98 (+2 skipped) | `_forkChild` |
| 🟡 | `https` | 5/6 83% | 0/0 (60 skipped) | `Server` |
| 🟢 | `os` | 22/23 96% | 1/6 | `loadavg` |
| 🟡 | `querystring` | 6/7 86% | 0/4 | `unescapeBuffer` |
| 🟢 | `dgram` | 2/2 100% | 22/60 (+4 skipped) | n/a |
| 🟢 | `diagnostics_channel` | 6/6 100% | 17/45 (+19 skipped) | n/a |
| 🟢 | `domain` | 5/5 100% | 26/46 (+2 skipped) | n/a |
| 🟢 | `punycode` | 6/6 100% | n/a | n/a |
| 🟢 | `readline` | 8/8 100% | 3/15 | n/a |
| 🟢 | `string_decoder` | 1/1 100% | 0/3 | n/a |
| 🟢 | `timers` | 7/7 100% | 23/48 | n/a |
| 🟢 | `tty` | 3/3 100% | 0/2 | n/a |
| 🟢 | `vm` | 10/10 100% | 23/67 | n/a |

Across all 43 modules: **442/1056 exports present (42%)**: 🟢 11, 🟡 15, 🔴 17.

Modules that do not load at all: `http2`, `inspector`, `trace_events`, `wasi`.
