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

The bun column is the SAME probe run against the bun on PATH, not a number
quoted from its compatibility page, which is hand-assigned per module. It is
there so our own column has something measured to sit beside it.

Measured against node v25.3.0, sweep at `3fcca363`.

Colour bands the WORSE of the two columns: 🟢 both 90%+, 🟡 both 60%+, 🔴 below
that or does not load. A module with no tests that ran is capped at 🟡 however
complete its surface: exports alone are not evidence that anything works.

| | module | exports | tests | bun exports | notable missing exports |
|---|---|---|---|---|---|
| 🟡 | `punycode` | 6/6 100% | n/a | 6/6 100% | n/a |
| 🟡 | `https` | 5/6 83% | 0/0 (60 skipped) | 6/6 100% | `Server` |
| 🟡 | `test` | 10/15 67% | n/a | 15/15 100% | `assert`, `only`, `skip`, `snapshot`, `todo` |
| 🟡 | `cluster` | 10/16 63% | 48/77 (+4 skipped) | 16/16 100% | `_eventsCount`, `_maxListeners`, `disconnect`, `fork`, `setupMaster`, `setupPrimary` |
| 🟡 | `child_process` | 8/9 89% | 61/98 (+2 skipped) | 8/9 89% | `_forkChild` |
| 🔴 | `domain` | 5/5 100% | 26/46 (+2 skipped) | 2/5 40% | n/a |
| 🔴 | `async_hooks` | 5/7 71% | 21/43 (+2 skipped) | 7/7 100% | `asyncWrapProviders`, `executionAsyncResource` |
| 🔴 | `timers` | 7/7 100% | 23/48 | 7/7 100% | n/a |
| 🔴 | `console` | 19/25 76% | 8/21 | 23/25 92% | `context`, `createTask`, `dirxml`, `profile`, `profileEnd`, `timeStamp` |
| 🔴 | `diagnostics_channel` | 6/6 100% | 17/45 (+19 skipped) | 6/6 100% | n/a |
| 🔴 | `dgram` | 2/2 100% | 22/60 (+4 skipped) | 2/2 100% | n/a |
| 🔴 | `vm` | 10/10 100% | 23/67 | 10/10 100% | n/a |
| 🔴 | `buffer` | 8/13 62% | 19/56 (+1 skipped) | 13/13 100% | `Blob`, `File`, `INSPECT_MAX_BYTES`, `resolveObjectURL`, `transcode` |
| 🔴 | `fs` | 70/104 67% | 74/219 (+8 skipped) | 102/104 98% | `Dir`, `Dirent`, `FileReadStream`, `FileWriteStream`, `ReadStream`, `Stats` +28 more |
| 🔴 | `stream` | 8/23 35% | 54/164 (+1 skipped) | 23/23 100% | `_isArrayBufferView`, `_isUint8Array`, `_uint8ArrayToBuffer`, `addAbortSignal`, `compose`, `destroy` +9 more |
| 🔴 | `url` | 6/14 43% | 4/14 | 12/14 86% | `URLPattern`, `domainToASCII`, `domainToUnicode`, `fileURLToPath`, `fileURLToPathBuffer`, `pathToFileURL` +2 more |
| 🔴 | `process` | 30/83 36% | 21/76 (+5 skipped) | 73/83 88% | `_debugEnd`, `_debugProcess`, `_events`, `_eventsCount`, `_exiting`, `_fatalException` +47 more |
| 🔴 | `events` | 10/17 59% | 1/4 | 17/17 100% | `EventEmitterAsyncResource`, `captureRejections`, `getMaxListeners`, `init`, `kMaxEventTargetListeners`, `kMaxEventTargetListenersWarned` +1 more |
| 🔴 | `perf_hooks` | 11/13 85% | 3/12 | 11/13 85% | `Performance`, `PerformanceResourceTiming` |
| 🔴 | `net` | 13/17 76% | 27/133 (+3 skipped) | 16/17 94% | `BlockList`, `SocketAddress`, `_createServerHandle`, `_normalizeArgs` |
| 🔴 | `readline` | 8/8 100% | 3/15 | 8/8 100% | n/a |
| 🔴 | `http` | 11/20 55% | 71/371 (+6 skipped) | 19/20 95% | `CloseEvent`, `MessageEvent`, `OutgoingMessage`, `WebSocket`, `_connectionListener`, `maxHeaderSize` +3 more |
| 🔴 | `os` | 22/23 96% | 1/6 | 23/23 100% | `loadavg` |
| 🔴 | `assert` | 20/21 95% | 2/13 | 20/21 95% | `Assert` |
| 🔴 | `tls` | 16/18 89% | 1/7 (+181 skipped) | 17/18 94% | `getCACertificates`, `setDefaultCACertificates` |
| 🔴 | `v8` | 10/23 43% | 2/14 (+4 skipped) | 18/23 78% | `DefaultDeserializer`, `DefaultSerializer`, `Deserializer`, `GCProfiler`, `Serializer`, `getCppHeapStatistics` +7 more |
| 🔴 | `zlib` | 29/47 62% | 8/58 (+1 skipped) | 47/47 100% | `BrotliCompress`, `BrotliDecompress`, `Deflate`, `DeflateRaw`, `Gunzip`, `Gzip` +12 more |
| 🔴 | `util` | 12/33 36% | 2/16 (+1 skipped) | 24/33 73% | `MIMEParams`, `MIMEType`, `TextDecoder`, `TextEncoder`, `_errnoException`, `_exceptionWithHostPort` +15 more |
| 🔴 | `module` | 4/33 12% | 3/24 (+3 skipped) | 26/33 79% | `SourceMap`, `_cache`, `_extensions`, `_findPath`, `_initPaths`, `_load` +23 more |
| 🔴 | `worker_threads` | 11/21 52% | 13/118 (+7 skipped) | 15/21 71% | `BroadcastChannel`, `MessageChannel`, `MessagePort`, `SHARE_ENV`, `isInternalThread`, `isMarkedAsUntransferable` +4 more |
| 🔴 | `crypto` | 7/69 10% | 0/0 (121 skipped) | 65/69 94% | `Certificate`, `Cipheriv`, `Decipheriv`, `DiffieHellman`, `DiffieHellmanGroup`, `ECDH` +56 more |
| 🔴 | `path` | 14/17 82% | 1/16 (+1 skipped) | 17/17 100% | `_makeLong`, `matchesGlob`, `win32` |
| 🔴 | `constants` | 0/230 0% | n/a | 211/230 92% | `COPYFILE_EXCL`, `COPYFILE_FICLONE`, `COPYFILE_FICLONE_FORCE`, `DH_CHECK_P_NOT_PRIME`, `DH_CHECK_P_NOT_SAFE_PRIME`, `DH_NOT_SUITABLE_GENERATOR` +224 more |
| 🔴 | `dns` | 16/50 32% | 0/19 | 49/50 98% | `ADDRGETNETWORKPARAMS`, `BADFAMILY`, `BADFLAGS`, `BADHINTS`, `BADNAME`, `BADQUERY` +28 more |
| 🔴 | `http2` **(does not load)** | 0/11 0% | 0/0 (238 skipped) | 10/11 91% | `Http2ServerRequest`, `Http2ServerResponse`, `connect`, `constants`, `createSecureServer`, `createServer` +5 more |
| 🔴 | `inspector` **(does not load)** | 0/8 0% | 1/1 (+54 skipped) | 6/8 75% | `Network`, `NetworkResources`, `Session`, `close`, `console`, `open` +2 more |
| 🔴 | `querystring` | 6/7 86% | 0/4 | 7/7 100% | `unescapeBuffer` |
| 🔴 | `repl` | 0/7 0% | 19/83 (+7 skipped) | 0/7 0% | `REPLServer`, `REPL_MODE_SLOPPY`, `REPL_MODE_STRICT`, `Recoverable`, `isValidSyntax`, `start` +1 more |
| 🔴 | `sqlite` | 3/5 60% | 0/1 (+12 skipped) | 0/5 0% | `Session`, `backup` |
| 🔴 | `string_decoder` | 1/1 100% | 0/3 | 1/1 100% | n/a |
| 🔴 | `trace_events` **(does not load)** | 0/2 0% | n/a | 2/2 100% | `createTracing`, `getEnabledCategories` |
| 🔴 | `tty` | 3/3 100% | 0/2 | 3/3 100% | n/a |
| 🔴 | `wasi` **(does not load)** | 0/1 0% | n/a | 1/1 100% | `WASI` |

Across all 43 modules: **442/1056 exports present (42%)**: 🟢 0, 🟡 5, 🔴 38.

Modules that do not load at all: `http2`, `inspector`, `trace_events`, `wasi`.
