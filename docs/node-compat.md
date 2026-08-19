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

**The dot is the test pass rate.** That is the only column that says whether a
module WORKS: node's own `test-<area>-*.js` cases that pass, out of those that
ran. Skipped cases are counted separately and scored neither way.

🟢 90%+ · 🟡 60%+ · 🟠 30%+ · 🔴 below · ⚪ no case ran, so there is no
evidence either way. Two caps: a module that does not load is 🔴 whatever its
cases did, and under 5 cases that ran the best available band is 🟠, because a
handful of cases does not certify a module. Failing all of a small sample still
reads red: the cap is on the good end only.

**Exports do not affect the dot.** A name that exists and does not work is worth
nothing, so the export count is here as the WORKLIST, not as a score: it says how
much of node's surface is missing and the last column names it. Read it after the
dot has told you the module is behind. `vm` exports all 10 of node's names and
fails two thirds of its cases, which is the whole reason this column stopped
voting.

Reference surface: node v25.3.0. Sweep at `3fcca363`.

| | module | tests | exports | missing exports |
|---|---|---|---|---|
| 🟡 | `cluster` | 48/77 62% (+4 skipped) | 10/16 63% | `_eventsCount`, `_maxListeners`, `disconnect`, `fork`, `setupMaster`, `setupPrimary` |
| 🟡 | `child_process` | 61/98 62% (+2 skipped) | 8/9 89% | `_forkChild` |
| 🟠 | `domain` | 26/46 57% (+2 skipped) | 5/5 100% | none |
| 🟠 | `async_hooks` | 21/43 49% (+2 skipped) | 5/7 71% | `asyncWrapProviders`, `executionAsyncResource` |
| 🟠 | `timers` | 23/48 48% | 7/7 100% | none |
| 🟠 | `console` | 8/21 38% | 19/25 76% | `context`, `createTask`, `dirxml`, `profile`, `profileEnd`, `timeStamp` |
| 🟠 | `diagnostics_channel` | 17/45 38% (+19 skipped) | 6/6 100% | none |
| 🟠 | `dgram` | 22/60 37% (+4 skipped) | 2/2 100% | none |
| 🟠 | `vm` | 23/67 34% | 10/10 100% | none |
| 🟠 | `buffer` | 19/56 34% (+1 skipped) | 8/13 62% | `Blob`, `File`, `INSPECT_MAX_BYTES`, `resolveObjectURL`, `transcode` |
| 🟠 | `fs` | 74/219 34% (+8 skipped) | 70/104 67% | `Dir`, `Dirent`, `FileReadStream`, `FileWriteStream`, `ReadStream`, `Stats` +28 more |
| 🟠 | `stream` | 54/164 33% (+1 skipped) | 8/23 35% | `_isArrayBufferView`, `_isUint8Array`, `_uint8ArrayToBuffer`, `addAbortSignal`, `compose`, `destroy` +9 more |
| 🔴 | `url` | 4/14 29% | 8/14 57% | `URLPattern`, `domainToASCII`, `domainToUnicode`, `fileURLToPathBuffer`, `resolveObject`, `urlToHttpOptions` |
| 🔴 | `process` | 21/76 28% (+5 skipped) | 31/83 37% | `_debugEnd`, `_debugProcess`, `_events`, `_eventsCount`, `_exiting`, `_fatalException` +46 more |
| 🔴 | `perf_hooks` | 3/12 25% | 11/13 85% | `Performance`, `PerformanceResourceTiming` |
| 🔴 | `events` | 1/4 25% | 10/17 59% | `EventEmitterAsyncResource`, `captureRejections`, `getMaxListeners`, `init`, `kMaxEventTargetListeners`, `kMaxEventTargetListenersWarned` +1 more |
| 🔴 | `repl` | 19/83 23% (+7 skipped) | 0/7 0% | `REPLServer`, `REPL_MODE_SLOPPY`, `REPL_MODE_STRICT`, `Recoverable`, `isValidSyntax`, `start` +1 more |
| 🔴 | `net` | 27/133 20% (+3 skipped) | 13/17 76% | `BlockList`, `SocketAddress`, `_createServerHandle`, `_normalizeArgs` |
| 🔴 | `readline` | 3/15 20% | 8/8 100% | none |
| 🔴 | `http` | 71/371 19% (+6 skipped) | 11/20 55% | `CloseEvent`, `MessageEvent`, `OutgoingMessage`, `WebSocket`, `_connectionListener`, `maxHeaderSize` +3 more |
| 🔴 | `os` | 1/6 17% | 22/23 96% | `loadavg` |
| 🔴 | `assert` | 2/13 15% | 20/21 95% | `Assert` |
| 🔴 | `tls` | 1/7 14% (+181 skipped) | 16/18 89% | `getCACertificates`, `setDefaultCACertificates` |
| 🔴 | `v8` | 2/14 14% (+4 skipped) | 10/23 43% | `DefaultDeserializer`, `DefaultSerializer`, `Deserializer`, `GCProfiler`, `Serializer`, `getCppHeapStatistics` +7 more |
| 🔴 | `zlib` | 8/58 14% (+1 skipped) | 29/47 62% | `BrotliCompress`, `BrotliDecompress`, `Deflate`, `DeflateRaw`, `Gunzip`, `Gzip` +12 more |
| 🔴 | `util` | 2/16 13% (+1 skipped) | 12/33 36% | `MIMEParams`, `MIMEType`, `TextDecoder`, `TextEncoder`, `_errnoException`, `_exceptionWithHostPort` +15 more |
| 🔴 | `module` | 3/24 13% (+3 skipped) | 4/33 12% | `SourceMap`, `_cache`, `_extensions`, `_findPath`, `_initPaths`, `_load` +23 more |
| 🔴 | `worker_threads` | 13/118 11% (+7 skipped) | 11/21 52% | `BroadcastChannel`, `MessageChannel`, `MessagePort`, `SHARE_ENV`, `isInternalThread`, `isMarkedAsUntransferable` +4 more |
| 🔴 | `path` | 1/16 6% (+1 skipped) | 14/17 82% | `_makeLong`, `matchesGlob`, `win32` |
| 🔴 | `string_decoder` | 0/3 0% | 1/1 100% | none |
| 🔴 | `tty` | 0/2 0% | 3/3 100% | none |
| 🔴 | `querystring` | 0/4 0% | 6/7 86% | `unescapeBuffer` |
| 🔴 | `sqlite` | 0/1 0% (+12 skipped) | 3/5 60% | `Session`, `backup` |
| 🔴 | `dns` | 0/19 0% | 16/50 32% | `ADDRGETNETWORKPARAMS`, `BADFAMILY`, `BADFLAGS`, `BADHINTS`, `BADNAME`, `BADQUERY` +28 more |
| ⚪ | `punycode` | no cases | 6/6 100% | none |
| ⚪ | `test` | no cases | 14/15 93% | `snapshot` |
| ⚪ | `https` | 0 ran (60 skipped) | 5/6 83% | `Server` |
| ⚪ | `crypto` | 0 ran (121 skipped) | 7/69 10% | `Certificate`, `Cipheriv`, `Decipheriv`, `DiffieHellman`, `DiffieHellmanGroup`, `ECDH` +56 more |
| ⚪ | `constants` | no cases | 0/230 0% | `COPYFILE_EXCL`, `COPYFILE_FICLONE`, `COPYFILE_FICLONE_FORCE`, `DH_CHECK_P_NOT_PRIME`, `DH_CHECK_P_NOT_SAFE_PRIME`, `DH_NOT_SUITABLE_GENERATOR` +224 more |
| 🔴 | `http2` **(does not load)** | 0 ran (238 skipped) | 0/11 0% | `Http2ServerRequest`, `Http2ServerResponse`, `connect`, `constants`, `createSecureServer`, `createServer` +5 more |
| 🔴 | `inspector` **(does not load)** | 1/1 100% (+54 skipped) | 0/8 0% | `Network`, `NetworkResources`, `Session`, `close`, `console`, `open` +2 more |
| 🔴 | `trace_events` **(does not load)** | no cases | 0/2 0% | `createTracing`, `getEnabledCategories` |
| 🔴 | `wasi` **(does not load)** | no cases | 0/1 0% | `WASI` |

Across all 43 modules: **579/1954 node cases pass (30%)**, 🟢 0, 🟡 2, 🟠 10, 🔴 26, ⚪ 5. Surface: 449/1056 exports present (43%).

Modules that do not load at all: `http2`, `inspector`, `trace_events`, `wasi`.
