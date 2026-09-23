<!-- doc-meta
system: backlog
purpose: the open list. What is broken or missing, why it is not trivial, and what to do next
key-files: src/engine/eval.milo, src/engine/realm.milo, lib/vm.js, lib/engine-prelude.js, bench/ab.sh, src/engine/builtins.milo, src/engine/parser.milo, src/engine/methods.milo, src/engine/runtime.milo, src/engine/driver.milo, src/engine/bytecode.milo, scripts/test262-sweep.ts, scripts/quickjs-sweep.ts, lib/http.js, lib/fs.js, bench/run.sh, bench/arith.js
update-when: an item lands (delete it), or a sweep/probe finds a new gap (add it)
last-verified: 2026-09-22 (re-verified after the realm creation commit: createRealm (src/engine/realm.milo) boots a new realm through the same setupGlobals and the recorded JS preludes (runRealmPrelude), __realmCreate/__realmEval expose it, test262-sweep's $262 gains createRealm/evalScript and the sweep a --files option, and GetPrototypeFromConstructor falls back to newTarget's realm. The embedding ABI stays one context; libmilojs records its prelude through runPreludeSource so a realm made there gets the prelude too. Previous note: re-verified after the call-time realm commit: JSObj gains realm (i32, in existing padding), a call to a function, builtin or builtin method of another realm enters that realm for the call and leaves it on return or throw, a parked activation's ExecCtx carries its realm, an implicit prototype link resolves in the object's own realm, and the instanceof/species shortcuts answer only within one realm. One realm still exists, so no behaviour this doc describes changes. Previous note: re-verified after the global-scope commit: the literal global scope 0 is gone; code names the running realm's Interp.globalScope, a sloppy assignment to an undeclared name creates the global at the root of the assigning code's own scope chain (scopeChainRoot), and a global scope is identified by having no parent rather than by index 0. One realm still exists, so nothing else this doc describes changes. Previous note: re-verified after the Realm struct commit: Interp's intrinsic fields became a cache of Interp.realms[curRealm] (src/engine/realm.milo: RealmIntrinsics, saveRealm/loadRealm/enterRealm), nativeObjs and taProtos moved into the Realm record, the collector roots every realm through markRealms, and tools/check-realm-fields.mjs gates the two hand-written field lists; one realm still exists, so nothing this doc describes changes. Previous note: re-verified after the builtin function-object commit: JSValue.Native carries a second field, the index of a real JSObj that is the builtin's identity and property bag; one canonical object per Builtin and typed-array kind lives in Interp.nativeObjs (nativeValue is the only way to make such a value), a promise's resolve and reject functions get a fresh one each (makeResolver, Native.Resolve/Reject), and Interp.nativeKeys/nativeProps/resolverProps are gone. The Map.hasOwnProperty leftover is fixed and deleted; a new section records four builtin naming gaps the new fixture found. Previous note: added the unranked leftovers the builtin-dispatch work found. Previous note: re-verified after setMember folded its builtin-prototype invalidation into touchedBuiltinProto and the sweeps began refusing unknown arguments; nothing this doc describes changes. Previous note: re-verified after the typed-array dispatch commit: Interp.taProtoObj/taProtos/taProtoPristine guard the direct call over all twelve prototypes, getMember no longer synthesises a bound method per read, typedArrayOverride is gone, %TypedArray%.prototype is rebuilt in node's order with its @@toStringTag getter, and of/from move onto %TypedArray% in the engine prelude. Previous note: re-verified after the DataView dispatch commit: Interp.dataViewProtoObj/dataViewProtoPristine guard the direct call, getMember no longer synthesises a bound method per read, and DataView.prototype gains the BigInt64/BigUint64/Float16 accessors and @@toStringTag in node's order. Previous note: re-verified after the RegExp dispatch commit: Interp.regexProtoPristine guards the direct call, String's regex operations hand themselves to the argument's symbol methods (stringRegexProtocol), RegExp.prototype.test and the symbol methods are generic over objects and run the spec algorithms self-hosted in the engine prelude unless the regex is plain (regexIsPlain), and a RegExp subclass instance keeps its base's own slots. Previous note: re-verified after the Date dispatch commit: Interp.dateProtoPristine guards the direct call as arrayProtoPristine does, getMember no longer synthesises a bound method per date read, Date.prototype[@@toPrimitive] runs OrdinaryToPrimitive through the receiver, toJSON is generic under the internal name __dateToJSON, and the toPrimitive helpers lose their isDate shortcuts. Previous note: re-verified after WeakMap/WeakSet became their own natives: Builtin.WeakMap/WeakSet with BRAND_WEAKMAP/BRAND_WEAKSET, entries in the Map side table under JSObjExtra.weakKind (not isMap/isSet), the prelude class is gone, and buildNativeProto installs constructor first to match node's property order. Previous note: re-verified after the symbol primitive commit: JSValue gains Sym(id), symbols live in Interp.symDescs/symHasDesc/symRegistered plus a Symbol.for registry, well-known symbols are fixed ids WK_* registered first, and a symbol property key is spelled only by symKey/symIdOfKey (0xFF then the decimal id), so no string can collide with one; Symbol.for/keyFor are natives. Entries added for symbols never being collected and for object computed keys ignoring a user toString. Previous note: re-verified after the closure function-object commit: JSValue.Func carries a third field, an index of a real JSObj that is the closure's identity and its property bag, minted only by makeClosure; Interp.funcProtos, Interp.funcStatics and Scope.fnStatKeys/fnStatVals are gone, `.prototype` is an ordinary own property of that object, and JSObj.ctor is replaced by fnIdx/fnEnv; the `f.prototype = 3; class C extends f` leftover is fixed and deleted. Previous note: re-verified after the scoped-temp-root commit; the hand-checked-flag entry records the parallel temp-root discipline and the follow-up it leaves. Previous note: re-verified after the class heritage commit f035b8d (ClassDef.superExpr: any LeftHandSideExpression is evaluated once at class creation, a non-constructor heritage is a TypeError, extends null gives a null-prototype C.prototype) and c8c0c78 (__jsonStringifyFast registered as an engine intrinsic); nothing this doc describes changes. Previous note: re-verified after a91f36c (every imported name listed explicitly for the current milo compiler) and 7b2b447 (ToNumber of a symbol throws at every coerced argument); import lists and coercion helpers, nothing this doc describes changes. Previous note: re-verified after the native JSON.stringify fast path (mjStringifyFast in builtins.milo, __jsonStringifyFast builtin, prelude falls back to ser() for toJSON/accessors/Date/Proxy/wrappers/cycles); entry added below for string concatenation cost: 100k `s += "x"` takes ~0.9 s, QuickJS ropes it. Previous note: re-verified after the import() argument work: the parser desugars import(spec, options,) through __importSpec/__importOptions/__importSettle in the prelude, and the sweep stages _FIXTURE.js siblings; the dynamic-import residue is import.source/import.defer (proposals node lacks) plus module-namespace semantics, neither ranked here yet. Previous note: re-verified after the host-std import ratchet: the only source change is eval.milo losing an unused std/fetch import that host.milo now declares itself; nothing this doc describes changes. Previous note: re-verified after the throwErr unification and the isJsSpace/isJsWs removal: the hand-checked-flag entry now notes the single write-side helper; its read counts and every other entry stand. Previous note: map iterator hang entry deleted: the Map/Set constructor drives the iterator lazily and closes it on an abrupt entry; timers unref entry deleted: Timer.refed is now honoured by runEventLoop. Previous note: re-verified after the explicit &mut call-argument migration: every bare argument bound to a &mut parameter now reads '&mut x', a spelling change only; no behaviour this doc describes changes. Previous note: darwin-cliff entry extended with the load-sensitive readdir case and the claim-commit record correction. Previous note: re-verified after mode B: capturing method-call args now compile with scope-backed declared locals, so the call-arg-capture entry direction in the flush note is resolved; the flush-cost entry stands. Previous note: flush-gap soundness fix recorded: entry added for its bench cost; the capture-reject entry direction is unchanged. Previous note: re-verified after the literals-and-operators batch: prim/unslow/binslow/short-circuit opcodes, with in/instanceof/loose-eq coercion moved into evalBinValues as their single home. Previous note: re-verified after Op.CallMember: method calls in compiled bodies route through callMember with AST-evaluated arguments, capturing arguments are rejected (call-arg-capture) pending scope-backed locals; no entry here changes. Previous note: re-verified after the raw-f64 lane landed in bytecode.milo and its dispatch in eval.milo; no entry here describes the boxed-only VM. Previous note: re-verified after the vm stats witness landed in bytecode.milo: rejection sites now carry reason tags, which does not change any entry here; the coverage residue ranking lives in docs/conformance/vm-coverage.json. Previous note: re-verified for the sweeps emitting per-case pass lists; entries unaffected. Previous note: interpStackBytes added to driver.milo, and the darwin deep-recursion entry below records the half it could not fix; other entries re-checked unchanged. Previous note: re-checked against the evalUnArm change: the unary operator is now decided into a UnOp before the operand is evaluated, which fixes a dangling AST borrow and changes no behaviour this doc describes)
-->

# milojs backlog

## Ranked next, by measured case count

From the whole-corpus test262 sweep (`bun scripts/test262-sweep.ts`, no
`--sample`, ~48.7k cases, ~12 minutes). Re-rank by re-running it, not by
intuition: the 1500-case sample is too thin to rank causes.

1. **Temporal, ~2002 failures.** Largest single area, and node has no Temporal,
   so test262 is the only oracle. Clusters, from the failure list:
   - ISO string parsing rigour, ~208: annotations (calendar, time-zone,
     unknown, critical flags), the U+2212 minus, time separators, UTC offsets
     in date strings, range limits.
   - Option validation, ~115: `options-wrong-type`, `overflow-wrong-type`,
     `roundingmode-wrong-type`, `smallestunit-wrong-type`,
     `overflow-invalid-string`.
   - Observable operation order, ~106: `order-of-operations.js` and
     `options-read-before-algorithmic-validation.js` pin the exact sequence of
     property gets. largestUnit is read before smallestUnit, and that is part of
     the contract.
   - smallestUnit of year/month/week for a date-time difference, 50: needs
     RoundRelativeDuration, the one genuinely hard algorithm left here.
   - `leap-second.js`, 27: `:60` is accepted and clamped to 59.
   - `argument-number.js`, 26: a number argument must be a TypeError, not coerced.

   None of this needs new architecture. Temporal at 90% is worth about 4 points
   of the headline on its own.
2. **`built-ins/AsyncGeneratorFunction`, ~13% passing.** The constructor and its
   prototype/`@@toStringTag` chain are not modelled at all, separately from
   async generator objects working: `(async function*(){}).constructor.name` is
   `"Function"`, node says `"AsyncGeneratorFunction"`.
3. Not engine bugs, do not rank them as such: Atomics/SharedArrayBuffer and
   ShadowRealm (48) are host features, and `built-ins/Iterator`'s remainder is
   mostly stage-2 proposals (`zip`, `zipKeyed`, `concat`, `chunks`, `windows`)
   that node does not have either.

## Engine: a realm is never freed, and the cross-realm residue

`createRealm` (`src/engine/realm.milo`) makes a realm for good: its record stays in
`Interp.realms` and the collector roots every realm's global scope and intrinsics,
so nothing a realm built can be collected even once no value of it is reachable.
Measured on the engine binary, 20 realms in a row: ~3.3 ms, ~1,250 live objects,
~90 scopes and ~1.6 MB of peak RSS per realm (the first realm's own live set is
the same ~1,250 objects). That is fine for test262, which makes one or two per
case, and not fine for a program calling `vm.runInNewContext` in a loop once
`lib/vm.js` is rebuilt on realms, the next step. Freeing one needs the collector to treat a
realm as live only while something it owns is reachable, and `Interp.realms` to
reuse a dead slot, which the `JSObj.realm` index makes a generation problem.

What the 195 `$262.createRealm` cases in the sweep's scope still fail on, by
cause (`bun scripts/test262-sweep.ts --files <list> -v` on the list from
`grep -rl createRealm $TEST262/test`, minus intl402 and staging, reproduces it):

- constructors written in JS (`lib/engine-prelude.js`: AggregateError,
  SuppressedError, Iterator, DisposableStack, AsyncDisposableStack, WeakRef,
  FinalizationRegistry, the async/generator function constructors) do not apply
  GetPrototypeFromConstructor's realm fallback; the native constructors do
  (`newTargetProto` in `src/engine/eval.milo`).
- `Reflect.construct(Function, [], C)` with a non-object `C.prototype`: the
  result is a closure, and the proto fix-up in `constructValue` only reaches an
  `Obj` result.
- ArraySpeciesCreate's non-array receiver cases (`create-proto-from-ctor-realm-non-array`)
  and `Array.from`/`Array.of` with another realm's constructor.
- ShadowRealm (absent), the annex B `RegExp` legacy accessors' cross-realm
  TypeError, the Error.prototype.stack accessor, and private-name brand checks
  across two evaluations of one class in two realms.

## Engine: the outer-slot flush guard costs ~5-11% on property benches

The stale-outer-slot soundness fix (2026-08-26: a getter read/wrote outer names
invisibly to a compiled chunk) flushes dirty outer slots before any slow op that
can run user code and re-seeds when `funcCallTicks` moved. In a hot loop that
stores an outer accumulator and reads properties each iteration, that is a
scope-chain walk per iteration: propFew +11.5%, propMany +5.2% on bench/ab.sh.
Recovery candidates, in order: an accessor-presence bit per object (skip the
flush when the receiver's chain provably has no user code to run), per-slot
dirty tracking, or scope-slot caching for the flush target. The fixture is
`tests/vmOuterSlotFlush.js`; the matrix's fgOuter cases pin both directions.

## Engine: deep recursion on darwin dies ~2.3k frames early

The interpreter task stack is sized per-OS (`interpStackBytes` in
`src/engine/driver.milo`): 128 MB on linux, where glibc faults stack pages
lazily, so the 10k `callDepthLimit` backstop is what bounds recursion on every
path. darwin keeps 16 MB, because Apple's `makecontext` writes through the whole
mapping: a do-nothing context on a 128 MB stack peaks at 135 MB RSS (20-line C
repro, 2026-08-26), so a big stack costs its full size in dirty pages on every
milojs process. Consequence: recursion that needs more than ~2.3k tree-walker
frames (~7 KB each) raises RangeError on darwin where linux and node keep going;
es-get-iterator's last 10 assertions are the measured case, and
node's test-fs-readdir-stack-overflow is the load-sensitive one: it passes
standalone (catchable RangeError at the guard) but under a full parallel sweep
on darwin it fell off the pass set once (2026-08-26, claimed-sweep commit) —
the pass set now excludes it conservatively; re-claim it when a quiet sweep
shows it stable, or when the milo context-switch fix lifts darwin to the same
frame-cap determinism linux has. That commit's message also misnames its wins:
the actual four were console-assign-undefined, http-parser-multiple-execute,
promise-unhandled-default, v8-deserialize-buffer.

Fix lives in milo, not here: replace the system ucontext on darwin with the
scheduler's own context switch (the windows arm already has its own), then
delete the darwin branch of `interpStackBytes`. The alternative that does not
need milo — shrinking the ~7 KB per-frame cost — is the same work the bytecode
VM stage already owns.

## Engine: a global written through globalThis reads back as a var

`globalThis.x = 1` and `var x = 1` both become a scope-0 binding, and the
global object synthesises one descriptor shape for a binding the program made
(writable, enumerable, non-configurable). Node gives the assignment form
`configurable: true`. One bit, but modelling it means the global object
keeping its own property table for assigned names alongside the bindings for
declared ones, with reads consulting both. tests/globalThisBindings.js leaves
the bit out until then.

## Engine: symbols are never collected

A symbol is `JSValue.Sym(id)`, and its description lives in the interpreter's
symbol table (`Interp.symDescs`, `symHasDesc`, `symRegistered` in
src/engine/runtime.milo) for the life of the interpreter. Each `Symbol()` costs
26 bytes of table (a 24-byte string header and two bools) plus its
description's bytes (a heap allocation of its own), and a `Symbol.for` key
adds a registry entry. Measured with allocator and Vec-growth slack: 200k
`Symbol("x")` held in an array peak at 66.4 MB RSS against 54.2 MB for the same
array of numbers, ~61 bytes per symbol that no collection returns. Collecting them needs the marker to reach symbols
(from values AND from property keys, which encode the id) and a free list for
ids, and the id is what a symbol key spells, so a reused id must never meet a
stale key. Nothing real has hit it; build it when something does.

The key encoding (`symKey`: a 0xFF byte then the decimal id) relies on no JS
string containing 0xFF, which valid UTF-8 never does, and WTF-8 would not
either if the string layer moves there (see the lone-surrogate entry). Two
ingress paths break that today because they hand raw host bytes to JS without
decoding: `fs.readFileSync(p, "utf8")` (the fs entry above: the host returns a
Milo string, not bytes) and raw bytes inside a source file's string literal.
A file holding the bytes `FF 33` read that way and used as a key lands on
Symbol.iterator's slot (node decodes it to "\uFFFD3"). Buffer#toString and
TextDecoder already decode to U+FFFD, so the fix is to route both paths through
the same decode once readFileSync returns bytes; before this change the same
aliasing was reachable from any ordinary string spelled `@@sym:...`.

## Engine: WeakMap and WeakSet hold their keys strongly

WeakMap and WeakSet are their own natives (`Builtin.WeakMap`/`WeakSet`, brand
`BRAND_WEAKMAP`/`BRAND_WEAKSET`, entries in the same `mapKeys`/`mapVals` side
table as Map with `JSObjExtra.weakKind` as the discriminator), so everything a
program can observe matches node except collection: the marker in
src/engine/runtime.milo treats a weak collection's keys and values like a Map's,
so an entry whose key is otherwise unreachable is never dropped and its value
stays alive with it. A cache keyed by short-lived objects therefore grows for
the life of the process. Real weakness needs ephemeron marking (mark a value only
once its key is marked, iterate to a fixed point, then clear entries whose key
stayed white), and the same collector support for WeakRef and
FinalizationRegistry, which lib/engine-prelude.js also implements with strong
references. Lookup is also a linear scan, as for Map (`mapFind`).

## Engine: an object used as a computed key ignores its own toString

`o[k]` with an object `k` keys on `toStr(k)`, which is "[object Object]" for
every object: `o[{ toString() { return "x" } }] = 1` defines "[object Object]"
where node defines "x". ToPropertyKey should run ToPrimitive(string hint) and
call user code. Primitive WRAPPERS are already unwrapped (`toPropertyKey` in
src/engine/eval.milo), which is what makes `o[Object(sym)]` the symbol's key;
the general case needs every computed-key site to re-root its base across a
call into user code, which is why it was not folded into the symbol change.

## Engine: string concatenation in a loop is quadratic

`s += "x"` copies the whole string each time: 100k appends take ~0.9 s
(`/tmp`-style repro: `for (i<100000) s += "x"`), and QuickJS's `test_rope`
needs ~13 s here, which flaps between fail and crash(SIGTERM) with machine
load in the quickjs sweep (it never passes: it ends on the lone-surrogate
limit, `got 65533 expected 55296`). QuickJS and V8 use ropes or builders. A
rope JSValue.Str would touch every string consumer; a cheaper first step is an
append-in-place fast path when the left operand is a local `var` whose string
is uniquely owned. Measure with `bench/` before choosing.

## Exceptions propagate on a hand-checked flag, and nothing gates it

`st.throwing`/`st.thrownValue` on `Interp` is how a JS `throw` travels. It is not
a `Result` the type system makes you handle: every call site that can throw has to
remember to test the flag and bail. The count today:

| file | `throwing` reads |
|---|---:|
| `src/engine/eval.milo` | 398 |
| `src/engine/methods.milo` | 82 |
| `src/engine/builtins.milo` | 14 |
| `src/engine/driver.milo` | 7 |
| `src/engine/runtime.milo` | 6 |
| `src/engine/bytecode.milo` | 3 |

Miss one and execution continues in a throwing state. The symptom is a wrong
answer or a hang, never a crash — a Map constructor that spun on an
iterator whose entry read threw was one, and it took a test262 timeout to
surface it. The WRITE side is one spelling now (`throwErr` in eval.milo,
2026-09-20: 107 inline `throwing = true` / `thrownValue = makeError` pairs
folded into it); the read side is what this entry is about and it is unchanged. This is the largest invariant in the engine with
no gate under it, in a repo where shadowed symbols, layering, doc staleness,
arity, exit codes and AST-reference lifetimes all have one.

Not a one-liner because the honest fix is a type: make the throwing operations
return something the checker forces you to inspect, which is a refactor across
510 sites. A cheaper gate that would catch most of it: a lint that flags any
statement calling a known-throwing helper whose result is used without an
intervening `st.throwing` test. Build the lint first and see what it finds before
committing to the refactor — the point of the count above is that nobody knows
today how many of the 510 are missing checks rather than deliberate.

The same discipline problem existed for temp roots: every callMember arm pushed
the receiver, called evalArgs (which popped its own roots), and popped once on
the way out, with several throw paths returning without the pop. As of
2026-09-20 the call boundaries (callMember, evalCall, evalNewArm, callOptional)
record `st.tempRoots.len()` on entry and truncate back to it on exit, evalArgs
leaves its roots pushed, and the arms' own popTemp calls are now redundant but
harmless (they pop an argument root early, which truncation would have dropped
anyway). Deleting those ~27 pops is a follow-up; the throw-path imbalance is gone
because nothing below the boundary can leave the stack deeper than it found it.
`tools/gc-stress.sh` (collect on every allocation, 344/344 on 2026-09-21) is the
dynamic gate for the rooting half; `spreadInto` was the sixth hole it found.

### Where to pick this up: two type-level moves, in this order

Both are expressible in Milo today (it has `Drop` impls and `?` on `Result`);
neither needs a compiler change. What Milo cannot give is a branded lifetime
that forbids holding a raw `i64` handle across an allocating call, so the
strict gate stays the check for that half.

**A. `Roots` guard (~1 day).** A value type whose construction pushes onto
`gInterp.tempRoots` and whose `drop` pops, so every return path unwinds by
construction instead of by a recorded length: `evalArgs` returns the guard
alongside its values, the four boundary functions stop recording `base`, and
the ~27 stray `popTemp`s go. Verify: `tools/gc-stress.sh` stays 344/344, the
bench holds, `tempRoots` is never read except through the guard.

**B. `Result`-typed completions (pilot first).** Convert `methods.milo` (82
reads, the leafiest file) to return `Result<JSValue, Throw>` and propagate with
`?`, keeping `st.throwing` at its boundary with `eval.milo`. Measure lines,
perf, and how many of its 82 reads were missing checks the compiler now
exposes. Decide on `eval.milo` (398) from that number, not from the plan. The
lint in the paragraph above is still the cheaper first probe if the pilot
stalls.

Smaller compat leftovers found alongside, none gated yet:
`class C extends null {}; new C()` must throw (super not a constructor);
`import.source`/`import.defer` parse errors (stage-3 proposals node lacks,
66 test262 files, leave them); `tests/run.sh` wedges in its `wait` after a
SIGKILLed fixture (three orphaned runners seen on 2026-09-20).

## fs: `readFileSync(path)` with no encoding returns a string, not a Buffer

`lib/fs.js` readFileSync returns whatever `__readFileSync` hands back, which is
a Milo string, so `typeof` is `"string"`, `Buffer.isBuffer` is false and any
binary file is decoded as text. Node returns a Buffer whenever no encoding is
given. Found in the closure-identity A/B: `test-fs-promises-file-handle-write.js`
went from pass to fail, and the old pass was false. The base runtime rejected
with `undefined` (the reason was lost, so the harness saw nothing), and the
closure change started reporting the real `AssertionError`. The fix is not a
`Buffer.from(s)` wrapper: the bytes have to come from the host as bytes, or a
non-UTF-8 file is corrupted before JS sees it.

## Found alongside the builtin-dispatch work, not yet ranked

Each was seen while moving Date, RegExp, DataView and typed arrays onto their
real prototypes, and each is outside that change. Repro, then what node does:

- `console.log(5.960464477539063e-8)` prints `5.9604644775390625e-8`: number
  formatting is not shortest round-trip. Node prints the shorter form.
- `Object.prototype.valueOf.call(new Date(0))` returns `0`. Node returns the
  Date object itself (ToObject, not the time value).
- `Array.prototype.map.call(new Uint8Array([1]), x => 300)` runs the
  typed-array `map`, so the result is a `Uint8Array` holding 44. Node returns a
  plain `[300]`.
- `Object.getOwnPropertyNames(/a/)` lists 11 names (flags stored as own
  properties). Node lists only `lastIndex`; the flags are accessors on
  `RegExp.prototype`.
- `new BigInt64Array(1)[0] = 1` stores silently. Node throws TypeError (a
  BigInt typed array accepts only BigInt); only `of`/`from` check today.

## Found alongside the builtin function-object work, not yet ranked

Seen while writing `tests/nativeFunctionObjects.js`; each predates the change
that gave every builtin its own function object. Repro, then what node does:

- `parseInt.name` is `""` and `Object.getOwnPropertyNames(parseInt)` is `[]`:
  the global functions (`parseInt`, `parseFloat`, `isNaN`, `isFinite`, the URI
  pair) are installed with `scopeDefine` and no naming pass reaches them. The
  same holds for `Array.isArray`, `Array.of`, `Array.from`. Node: `"parseInt"`,
  `['length', 'name']`.
- `Object.getOwnPropertyNames(JSON.parse)` includes `prototype`. Node:
  `['length', 'name']`.
- `Function.prototype.toString.call(Math.max)` is `"[object Function]"`: the
  borrowed call reaches callBuiltinByName as a bare `toString` on a native, the
  same arm `Object.prototype.toString.call` takes. Node:
  `function max() { [native code] }`.
- A deleted builtin `name` reads `undefined` on a bound-method built-in
  (`delete Array.prototype.push.name; Array.prototype.push.name`). Node reads
  `""` from `Function.prototype`.

## http: no keep-alive, so every response closes its connection

`Connection: close` goes out on every response and the socket is destroyed after
it, so a client asking for `Connection: keep-alive` does not get it and a second
request on the same connection is never read. Multi-packet request bodies have
the same root cause: `Server.prototype._serveOnce` in `lib/http.js` reads one
request with a single blocking `__tcpRecv`, so one read is one request.

Reproduce: `test-http-keep-alive-max-requests.js`.

**Attempted 2026-08-19 and reverted.** The rewrite is the obvious one: accept,
wrap in the `net.Socket` (that part is already in place and stayed), then
assemble requests out of the socket's data stream, dispatch one at a time, and
keep the connection after `res.end()` when both sides agreed to. It works for
the simple cases and it is measurably worse overall — the http area went 79 to
76 and hangs went 56 to 66. The three that broke were
`test-http-1.0-keep-alive.js`, `test-http-default-encoding.js` and
`test-http-request-large-payload.js`, the last of which is precisely the
multi-packet body the change was meant to fix. The patch is not kept; `git log`
has this entry and the reasoning below.

Two things the attempt did get right and a retry should keep:

- Keep-alive is only possible when the response is SELF-DELIMITING. An HTTP/1.0
  client with a streamed body has neither a length nor chunked framing
  available, so the close is the delimiter and the connection cannot be kept
  alive however politely the client asked. Missing this hangs
  `test-http-wget.js`.
- The connection decision belongs at dispatch, once, read from what the client
  actually said: 1.1 keeps alive unless it says `close`, 1.0 only if it says
  `keep-alive`.

What to work out before retrying: where the extra hangs come from. The suspicion
is the handoff from the blocking `__tcpRecv` to the pump — a request whose bytes
are already buffered when the socket is adopted, versus one that arrives after —
but that was not established, and guessing again is how this attempt went.
Instrument the drain loop first.

## streams: no `_writev` batching, and the Readable state machine is missing

Two separate holes left after the state views landed.

**`_writev` batching.** `test-stream-writev.js` counts write calls and gets one
fewer than node. Corking now buffers for real and calls `_writev` with the held
chunks, but node's split between the first `_write` and the batched `_writev` is
not the one here. Reproduce: `test-stream-writev.js`, which reports `6 === 7`.

**The pull-based Readable state machine.** `_readableState` reports every field
this implementation genuinely maintains and deliberately omits the ones it does
not: `reading`, `needReadable`, `emittedReadable`, `resumeScheduled`,
`awaitDrainWriters`. Those are not properties that can be added to the view —
they are the bookkeeping of node's demand-driven read cycle, which this
implementation does not have (it pushes on `push()` and drains when flowing).
Tests reading them fail with a clear "cannot read property of undefined" rather
than against an invented value, which is the intended outcome until the read
cycle exists.

Reproduce: `test-stream-readable-event.js`, `test-stream-readable-needReadable.js`,
`test-stream-readable-emittedReadable.js`,
`test-stream-readable-resumeScheduled.js`,
`test-stream-readable-reading-readingMore.js`,
`test-stream-pipe-await-drain-manual-resume.js`.

Why it is not a one-line fix: it is the Readable rewrite, not a patch. `read(n)`
has to pull through `_read`, buffer to a high water mark, and emit 'readable'
against demand rather than on arrival.

## process: `kill` does not exist, and an unhandled rejection is not an uncaught exception

**`process.kill` is absent.** Adding a validating wrapper is easy and would be a
lie: there is no signal-sending native under it, so it would accept a pid and a
signal and do nothing. Reproduce: `test-process-kill-pid.js`, which also needs
`internalBinding` interception to observe what was sent, so it is not winnable by
adding the function alone.

**An unhandled promise rejection prints and continues** where node's default
routes it to `uncaughtException` and exits. `process.on('uncaughtException')`
now catches a throw from a timer and from a nextTick callback, but not one from
a promise reaction, which takes the rejection path instead.

Reproduce:
```js
process.on('uncaughtException', (e) => console.log('caught:', e.message));
Promise.resolve().then(() => { throw new Error('x'); });
```
node prints "caught: x", milojs prints "Unhandled promise rejection".

Why it is not a one-line fix: the two paths are separate by design here, and
joining them means deciding when a rejection is finally unhandled — node waits
until the microtask queue drains before declaring it, so an await added later in
the same tick must not trigger it.

## path: win32 device roots, and `join`/`relative`/`basename` corners

`matchesGlob`, `resolve("")`, the UNC device in `win32.resolve`, `extname("..")`,
`win32.normalize("C:")` and both `dirname` implementations are fixed; the area is
9/16 (was 3/16). What is left:

- **`\\.\` and `\\?\` DEVICE roots** are not recognized as roots:
  `win32.resolve("\\\\.\\PHYSICALDRIVE0")` gains a trailing separator, and
  `win32.normalize("\\\\.\\foo\\")` keeps one node drops. Same cause behind
  `test-path-win32-normalize-device-names.js` and `test-path-makelong.js`, which
  also wants forward slashes inside an already-namespaced path left alone.
- `win32.join("/", "..", "..")` answers `\\..\..\` where node answers `/`.
- `win32.relative` between two UNC paths under the same share answers `""`.
- `parse().root` and `parse().dir` normalize the separators they were given;
  node's parse SLICES the input, so `parse("file")` keeps `dir: ""` and the
  round-trip through `format` differs.
- `basename` disagrees on a trailing-separator case.

Reproduce: `test-path-resolve.js`, `test-path-normalize.js`,
`test-path-join.js`, `test-path-relative.js`, `test-path-parse-format.js`,
`test-path-basename.js`.

## Async: `next()` on an async generator drives the body, and can HANG

The only open item that can wedge the process. node returns a *pending* promise
immediately and runs the body afterwards; `genResumeAsync` parks the caller,
drives the body to its next yield, and returns an already-settled promise.
Values always match; interleaving differs whenever two async functions are in
flight. It deadlocks when a caller invokes `next()` WITHOUT awaiting, and the
body then awaits a promise that only settles after `next()` returns. Nothing is
runnable. QuickJS `bug1355.js` is exactly this shape.

```js
let resolve; const p = new Promise(r => resolve = r);
async function* g(){ await p; yield 1; }
const it = g(); const fut = it.next(); resolve(42);   // hangs (verified 2026-08-19)
```

The fix: `next()` registers a pending promise, unparks the body task, and
returns without parking, letting the body settle that promise at its yield.
Needs a per-generator FIFO of pending requests (node queues concurrent `next()`
calls) and `runEventLoop` must count a live async generator body as work.

**Attempted 2026-08-15 and reverted. Read this before retrying.** The queue
worked: `(generator, promise, mode, arg)` in `Interp`, marked by `collect` since
nothing else roots the promise or the send value; `asyncGenRequest` enqueues and
returns pending without parking; `asyncGenYield` settles the served request and
picks up the next or parks; `asyncGenFinish` drains. `bug1355.js` stopped
hanging. Two real fixes fell out and are worth redoing: for-await's IteratorClose
and `yield*` delegation both drove the inner generator with the SYNCHRONOUS
`genResume`, which parks the caller against a queue only that caller can feed.

What killed it was the event loop. Yielding to a runnable generator body before
`runOneTimer` starves the timer that would settle the await the body is parked
on. Moving the yield after timers fixed that livelock and left a
NONDETERMINISTIC hang in ordinary sequential code (the same script produced 2,
16, or all 18 lines across runs), which is worse than the one pathological shape
it set out to fix. The race was never identified. Start by making the body's
runnability EXPLICIT rather than inferring it from "a request is queued": the
event loop cannot distinguish "body is runnable" from "body is parked on a
promise nothing has settled yet", and spins on the difference.

## Async: `await` of an already-settled promise resumes inline

No microtask tick, so an async function whose awaits all settle synchronously
runs to completion before returning. `tests/promises.js` pins the one line this
moves ("then 42", first here and seventh under node); every other line and value
in that fixture matches node exactly. This is why `tests/promises.js` is a
registered DIVERGENCE in `tests/.node-oracle-exempt`.

## Embedding: a dropped rejection returns STATUS_OK and prints to host stderr

All 17 `eprint` sites were swept and driven from a C consumer of `libmilojs.a`.
One is wrong:

| site | embedded behaviour | verdict |
|---|---|---|
| parser diagnostics (7) | silent, `evalSourceValue` sets `quiet: true` | correct |
| uncaught throw | silent, returned as `STATUS_JS_EXCEPTION` | correct |
| `console.error` | writes to host stderr | correct, that is the program writing |
| `[gc]` stats | opt-in flag | correct |
| unhandled promise rejection | **writes to host stderr, returns STATUS_OK** | wrong |

For the CLI this is right: node prints and exits nonzero. For a library the
embedder has no way to learn a rejection was dropped, and suppressing the print
alone makes it worse (silent instead of misdirected).

It is an ABI decision, so it is not being made unilaterally. **Option 1 is the
one to build**; the CLI keeps printing exactly as it does, because it IS the host.

1. **Poll API.** `milojs_unhandled_count` / `milojs_unhandled_copy(index)`,
   drained by the host. Costs public surface, matches how the exception channel
   already works.
2. **Fold into the eval status.** No new surface, but wrong in general: a later
   eval can still attach a handler, so the rejection is not final at that point.
3. **Host callback** at context creation. Most flexible, largest surface, needs
   a rule for what the callback may do re-entrantly.

## Strings: the UTF-16 model is lossy for lone surrogates

milojs strings are UTF-8, which cannot encode an unpaired surrogate, so two
operations lose data silently rather than erroring:

| expression | milojs | node |
|---|---|---|
| `String.fromCharCode(0xD800).charCodeAt(0)` | 65533 (U+FFFD) | 55296 |
| `JSON.parse('"\ud800"').charCodeAt(0)` | 65533 | 55296 |
| `"\u{1F600}".slice(0,1).length` | 2 (whole char) | 1 (the high half) |

A program doing surrogate arithmetic, or round-tripping JSON containing
`\ud800`, gets a different string back and no indication. The fix is a
representation that can hold unpaired surrogates (WTF-8, or UTF-16 units with a
UTF-8 fast path). That is a string-layer decision, not a patch.

`isWellFormed`/`toWellFormed` already SCAN rather than answering `true`
unconditionally. The answers are identical today because nothing can produce an
unpaired surrogate; the point is that the scan keeps working if the
representation changes.

## Proxy: trap COUNTS differ on 22 of 32 operations

Every VALUE in the proxy differential matches node. The sequences do not: node
runs the exact [[Get]]/[[HasProperty]] steps each spec algorithm prescribes and
milojs takes shortcuts (`slice` 6 traps vs node's 9, `reverse` 12 vs 24). Only
observable through a logging handler, which is exactly what a Proxy is for.

## Modules: bindings are snapshots

Verified 2026-08-19 against node. A mutated export does not update an importer
that already read it: after `bump()` sets `n = 2` in the dependency, the importer
still reads 1, and so does a later `import()` namespace of the same module.

## Strict mode: `f.caller` and `arguments.callee`

`f.caller` inside strict code answers `undefined`; node throws TypeError. Needs a
per-function accessor that knows its own strictness. Same family as the strict
rules still unimplemented: assignment to an undeclared name, duplicate parameter
names, octal literals.

## node:test: no `snapshot`, deliberately

`require('node:test').snapshot` is the last missing export of that module (14 of
15 present). Node's is `{setDefaultSnapshotSerializers, setResolveSnapshotPath}`,
two setters that configure `t.assert.snapshot()`. Exporting the pair without the
assertion behind it would raise the export count and do nothing, which is the one
thing this repo's compat table exists to prevent.

Real support means resolving `<testfile>.snapshot`, serializing with the
configured serializers, comparing, and rewriting under
`--test-update-snapshots`. Worth doing when something needs it; note that it
cannot be gated today. The only node test that covers it,
`test-runner-snapshot-tests.js`, requires `internal/test_runner/snapshot` under
`--expose-internals`, so it is unwinnable whatever gets built, and a repo fixture
cannot lock it either: node's TAP output carries per-test durations, so a
`node:test` file is not byte-comparable against node the way every other fixture
is.

## RegExp: three validation gaps left open on purpose

`[\d-z]` under the `u` flag and `[a-]` under `v` are accepted where node throws
(verified 2026-08-19), as are duplicate named groups in one alternative.
Accepting a pattern node rejects is the milder failure than rejecting one it
accepts, so these rank below anything that changes a match result. Found by
generated differential comparison, with both suites green.

## Number: `toString(radix)` digits

`(1.3).toString(7)` is `1.2046204620462046205` here and `1.204620462046204621`
under node: QuickJS/JSC shortest-round-trip digits rather than node's.
`tests/radixToString.js` is a QuickJS capture, the one place in the suite where
node is deliberately not the oracle, and it is a registered DIVERGENCE for that
reason.

## Errors: stack frames are repo-relative and carry no line:column

`console.log(new Error("boom"))` prints the message plus a frame per function,
naming each source file. node prints ABSOLUTE paths with `line:column` and its
own module-loader frames, which milojs has no business inventing. Frames stay
repo-relative on purpose: absolute paths would make `tests/errorInspect.js`
machine-specific and uncommittable. Registered as a DIVERGENCE; the open half is
line:column, not the paths.

## Perf: the two shapes that would actually pay

`bench/run.sh` reads **<!--fact:bench-best-->57.6x<!--/fact--> to <!--fact:bench-worst-->1907.7x<!--/fact-->**
off <!--fact:bench-peer-->bun 1.3.10<!--/fact-->, median <!--fact:bench-median-->410x<!--/fact--> across
<!--fact:bench-count-->13<!--/fact--> benches. Those come from `docs/conformance/bench.json` now
rather than from a range someone remembered — the prose here said "300-2600x", which bracketed
the truth on both sides. Best is `<!--fact:bench-best-name-->arith<!--/fact-->`, worst is
`<!--fact:bench-worst-name-->callFn<!--/fact-->`, and the spread between them is the finding: the
cost is not uniform, so "milojs is ~400x slower" is not a thing to optimise against.

A `sample` profile of `bench/arith.js` (pure arithmetic, no property access, no strings) puts
roughly a third of samples in malloc/free/`drop`/`cloneValue` and only a tenth in scope-lookup
string compares. The gap is per-node dispatch plus allocator traffic on owned values, not one
mechanism — which is consistent with `arith` being the CHEAPEST bench: it is the one that
allocates least.

```sh
tools/dev.sh                                    # build .dev/mj-engine
.dev/mj-engine bench/arith.js & sample $! 6 1 -mayDie
```

Worth building:

- **Intern property keys to an integer id.** With a scalar key there is no string
  to clone, the single struct store in `objSet` stays, and call sites stop
  cloning. The win is the ALLOCATION, not the lookup: `propFew` vs `propMany`
  prices ~27 extra string compares per read at only ~120 ms per million reads.
- **Lexical addressing, or interning scope identity**, to remove the name
  compares from scope lookup entirely.

Do NOT retry these, they were measured and rejected:

- **Borrowing `key` in `objSet`/`setMember`** (the same change that won 5-10% in
  `scopeAssign`): +1.5% on `propWrite`, +3.5% on `propWriteNew`. A borrowed key
  cannot be moved into a struct literal, so the overwrite path assigns four
  fields instead of storing one `Prop`, and `&mut` is second-class in Milo to the
  point of being ungrammatical in a `let` (`let p = &mut h.ps[0]` is a parse
  error), so the element reference cannot be hoisted.
- **Extracting ObjLit/SetMember to their own dispatcher frames.** Reached only
  through the fallback, so extraction adds a real call to a hot node: objChurn
  regressed 3-5%. Extraction pays only where the node is not hot or already made
  the call.
- **A discriminator tag on `Binding`** (`(len << 8) | first byte` to skip the
  `memcmp`): noise, -1.3% to +5.7%, objChurn worst. Milo's string `==` already
  short-circuits on length, so the tag only helps a same-length miss, while the
  `memcmp` samples are mostly HITS.

## Parked: es-get-iterator overflows in tape's nested-test machinery

Stops after 76 assertions with RangeError, with 67 assertions behind it. The
`callDepthLimit`-was-104 fix (now ~10,400, matching node) did not close this one.
Six sittings have each only SUBTRACTED hypotheses, recorded here as state rather
than as progress:

- `object-inspect` does not recurse on any value that section uses (boxed
  symbols, bigints, numbers, functions, regexes), with and without an added
  `Symbol.iterator`.
- `getIterator` answers undefined for all twelve non-iterables it tests.
- tape's nested scheduling is not it: one level of `t.test` in a `forEach` twelve
  times is fine; TWO levels (the shape `fakeIterator` produces) is fine, and a
  stack probe immediately after reports 494 of 500 frames free, so the nesting
  leaks no depth.
- Every value in that section, through spread, `inspect` and `deepEqual`
  individually: correct.

The synchronous phase runs to completion (every marker fires); the overflow is in
the DEFERRED sub-test run, at the value after `{}`. **Next attempt: bisect by
deleting values from `nonIterables` until it passes.** That identifies the value
directly instead of reasoning about which one it might be.

## Probe before implementing

Sweep failures reading `X is not a function` are usually a method on an unusual
RECEIVER, not a missing method: `concat`, `sort`, `apply`, `toString` and
`escape` all work on ordinary receivers. Check whether a method is
prototype-dispatched or whitelisted before adding it to the prelude.

Two more traps worth remembering:

- **`scripts/test262-sweep.ts` has no `-f`.** It parses `--sample`, `--dir`,
  `--limit` and `--json` only, and a stray `-f built-ins/Object` is IGNORED and
  runs the whole corpus.
- **Diff failure SETS between sweeps, not just totals.** Two of four regressions
  in one round were invisible to the sample and to every gate; only the set diff
  found them.
