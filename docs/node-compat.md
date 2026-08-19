<!-- doc-meta
system: node-compat
purpose: per-module Node compatibility, derived from an export diff against node and from the test sweep
key-files: tools/gen-node-compat.mjs, docs/conformance/node-compat.json, lib/
update-when: generated; run `node tools/gen-node-compat.mjs`, never edit by hand
last-verified: 2026-08-19 (generated from the node-compat sweep at f13cef81)
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

Reference surface: node v25.3.0. Sweep at `f13cef81`.

| | module | tests | exports | missing exports |
|---|---|---|---|---|
| 🟡 | `child_process` | 61/98 62% (+2 skipped) | 8/9 89% | `_forkChild` |
| 🟡 | `cluster` | 48/77 62% (+4 skipped) | 10/16 63% | `_eventsCount`, `_maxListeners`, `disconnect`, `fork`, `setupMaster`, `setupPrimary` |
| 🟠 | `domain` | 26/46 57% (+2 skipped) | 5/5 100% | none |
| 🟠 | `timers` | 26/48 54% | 7/7 100% | none |
| 🟠 | `path` | 9/16 56% (+1 skipped) | 16/17 94% | `_makeLong` |
| 🟠 | `querystring` | 2/4 50% | 6/7 86% | `unescapeBuffer` |
| 🟠 | `async_hooks` | 21/43 49% (+2 skipped) | 5/7 71% | `asyncWrapProviders`, `executionAsyncResource` |
| 🟠 | `buffer` | 25/56 45% (+1 skipped) | 8/13 62% | `Blob`, `File`, `INSPECT_MAX_BYTES`, `resolveObjectURL`, `transcode` |
| 🟠 | `console` | 9/21 43% | 19/25 76% | `context`, `createTask`, `dirxml`, `profile`, `profileEnd`, `timeStamp` |
| 🟠 | `stream` | 60/164 37% (+1 skipped) | 8/23 35% | `_isArrayBufferView`, `_isUint8Array`, `_uint8ArrayToBuffer`, `addAbortSignal`, `compose`, `destroy` +9 more |
| 🟠 | `dgram` | 22/60 37% (+4 skipped) | 2/2 100% | none |
| 🟠 | `fs` | 78/219 36% (+8 skipped) | 70/104 67% | `Dir`, `Dirent`, `FileReadStream`, `FileWriteStream`, `ReadStream`, `Stats` +28 more |
| 🟠 | `vm` | 23/67 34% | 10/10 100% | none |
| 🟠 | `perf_hooks` | 4/12 33% | 11/13 85% | `Performance`, `PerformanceResourceTiming` |
| 🔴 | `url` | 4/14 29% | 8/14 57% | `URLPattern`, `domainToASCII`, `domainToUnicode`, `fileURLToPathBuffer`, `resolveObject`, `urlToHttpOptions` |
| 🟠 | `diagnostics_channel` | 18/45 40% (+19 skipped) | 6/6 100% | none |
| 🔴 | `process` | 22/76 29% (+5 skipped) | 31/83 37% | `_debugEnd`, `_debugProcess`, `_events`, `_eventsCount`, `_exiting`, `_fatalException` +46 more |
| 🔴 | `events` | 1/4 25% | 10/17 59% | `EventEmitterAsyncResource`, `captureRejections`, `getMaxListeners`, `init`, `kMaxEventTargetListeners`, `kMaxEventTargetListenersWarned` +1 more |
| 🔴 | `assert` | 3/13 23% | 20/21 95% | `Assert` |
| 🔴 | `net` | 30/133 23% (+3 skipped) | 13/17 76% | `BlockList`, `SocketAddress`, `_createServerHandle`, `_normalizeArgs` |
| 🔴 | `http` | 81/371 22% (+6 skipped) | 12/20 60% | `CloseEvent`, `MessageEvent`, `WebSocket`, `_connectionListener`, `maxHeaderSize`, `setMaxIdleHTTPParsers` +2 more |
| 🔴 | `repl` | 19/83 23% (+7 skipped) | 0/7 0% | `REPLServer`, `REPL_MODE_SLOPPY`, `REPL_MODE_STRICT`, `Recoverable`, `isValidSyntax`, `start` +1 more |
| 🔴 | `readline` | 3/15 20% | 8/8 100% | none |
| 🔴 | `util` | 3/16 19% (+1 skipped) | 12/33 36% | `MIMEParams`, `MIMEType`, `TextDecoder`, `TextEncoder`, `_errnoException`, `_exceptionWithHostPort` +15 more |
| 🔴 | `os` | 1/6 17% | 22/23 96% | `loadavg` |
| 🔴 | `zlib` | 9/58 16% (+1 skipped) | 29/47 62% | `BrotliCompress`, `BrotliDecompress`, `Deflate`, `DeflateRaw`, `Gunzip`, `Gzip` +12 more |
| 🔴 | `module` | 4/24 17% (+3 skipped) | 4/33 12% | `SourceMap`, `_cache`, `_extensions`, `_findPath`, `_initPaths`, `_load` +23 more |
| 🔴 | `v8` | 2/14 14% (+4 skipped) | 10/23 43% | `DefaultDeserializer`, `DefaultSerializer`, `Deserializer`, `GCProfiler`, `Serializer`, `getCppHeapStatistics` +7 more |
| 🔴 | `worker_threads` | 13/118 11% (+7 skipped) | 11/21 52% | `BroadcastChannel`, `MessageChannel`, `MessagePort`, `SHARE_ENV`, `isInternalThread`, `isMarkedAsUntransferable` +4 more |
| 🟠 | `tls` | 1/1 100% (+187 skipped) | 16/18 89% | `getCACertificates`, `setDefaultCACertificates` |
| 🔴 | `string_decoder` | 0/3 0% | 1/1 100% | none |
| 🔴 | `tty` | 0/2 0% | 3/3 100% | none |
| ⚪ | `https` | 0 ran (60 skipped) | 5/6 83% | `Server` |
| 🔴 | `sqlite` | 0/1 0% (+12 skipped) | 3/5 60% | `Session`, `backup` |
| 🔴 | `dns` | 0/19 0% | 16/50 32% | `ADDRGETNETWORKPARAMS`, `BADFAMILY`, `BADFLAGS`, `BADHINTS`, `BADNAME`, `BADQUERY` +28 more |
| ⚪ | `crypto` | 0 ran (121 skipped) | 7/69 10% | `Certificate`, `Cipheriv`, `Decipheriv`, `DiffieHellman`, `DiffieHellmanGroup`, `ECDH` +56 more |
| ⚪ | `punycode` | no cases | 6/6 100% | none |
| ⚪ | `test` | no cases | 14/15 93% | `snapshot` |
| ⚪ | `constants` | no cases | 0/230 0% | `COPYFILE_EXCL`, `COPYFILE_FICLONE`, `COPYFILE_FICLONE_FORCE`, `DH_CHECK_P_NOT_PRIME`, `DH_CHECK_P_NOT_SAFE_PRIME`, `DH_NOT_SUITABLE_GENERATOR` +224 more |
| 🔴 | `http2` **(does not load)** | 0 ran (238 skipped) | 0/11 0% | `Http2ServerRequest`, `Http2ServerResponse`, `connect`, `constants`, `createSecureServer`, `createServer` +5 more |
| 🔴 | `inspector` **(does not load)** | 1/1 100% (+54 skipped) | 0/8 0% | `Network`, `NetworkResources`, `Session`, `close`, `console`, `open` +2 more |
| 🔴 | `trace_events` **(does not load)** | no cases | 0/2 0% | `createTracing`, `getEnabledCategories` |
| 🔴 | `wasi` **(does not load)** | no cases | 0/1 0% | `WASI` |

Across all 43 modules: **629/1948 node cases pass (32%)**, 🟢 0, 🟡 2, 🟠 14, 🔴 22, ⚪ 5. Surface: 452/1056 exports present (43%).

Whole suite, every selected case counted: **790/3373 (23%)**. This is the number to quote. The per-module column above is scored against what RAN, which forgives whatever an engine declines: milojs skips 936 cases, so that rate rises and falls with how much milojs is able to attempt.

Modules that do not load at all: `http2`, `inspector`, `trace_events`, `wasi`.
