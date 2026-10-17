<!-- doc-meta
system: gc-boundary
purpose: the project direction (a complete JS engine and Node-compatible runtime in Milo, replacing what bun gets from Zig plus JSC) and the GC design that comes first: roots, finalizers and stale references
key-files: src/engine/eval.milo, src/engine/runtime.milo, src/runtime/napi.milo, lib/fs.js, src/engine/stackscan.milo, src/engine/rooted.milo
update-when: a step below lands, a probe result changes, or the direction is revisited
last-verified: 2026-10-17 (step 4c batch 1 landed: methods, builtins, bytecode, runtime off bare Vec<JSValue>, napiAddonExports now marked; earlier: RootedVec and the bare-Vec ratchet landed, step 4b; earlier: JIT plan corrected, not LLVM; QuickJS decision point; direction restated: full engine and runtime, speed and node compat unfrozen; the 2026-10-16 narrowing to a safety showcase is withdrawn)
-->

# Direction: a whole JS engine and runtime in Milo

milojs is bun's ambition with the engine included. Bun is a runtime in Zig on
top of JSC in C++. milojs is both layers in one memory-safe language: our own
engine in place of JSC, our own runtime in place of bun's, and the chance to
drop decades of cruft from each. Safety is a property of the result, not the
pitch.

The engine started as a port of QuickJS's design. The runtime fills in the OS
and Node APIs on top of it.

**Node compatibility:** required for everything real applications use (fs, net,
http, streams, timers, child_process, crypto, zlib, process, module loading,
Node-API addons). Esoteric corners and deprecated APIs are not targets; a
`test/parallel` case that only exercises one of those is not worth chasing.

## Where it stands, and the bar for each layer

| layer | now | bar |
|---|---|---|
| engine correctness | test262 82% on a 3% sample | test262 at QuickJS's level, Temporal and Intl included |
| engine speed | median 410x behind bun (`docs/conformance/bench.json`); not yet measured against QuickJS | QuickJS parity first (bytecode VM on every body), then a JIT |
| runtime | 17.3% of node `test/parallel` | real apps run unmodified (Express, Prisma, then a Next-sized app); bun's 40.8% on the same sweep |

## Revision: 2026-10-16 narrowing withdrawn

The 2026-10-16 version of this doc froze speed and Node compatibility and
narrowed milojs to proving one safety claim. That was wrong: those gaps are the
work, not a reason to stop. The GC design below survives, for a different
reason: a real engine needs a collector that roots without hand bookkeeping,
for speed (`tempRoots` push and truncate on every call boundary) as much as for
correctness.

## Why the GC comes first: where memory bugs actually live
**Bun's runtime layer.** The bun clone has 533 branches named for a UAF,
double free, leak, segfault or crash fix, in bun's own code, not JSC. Ten were
read in full and classified against Milo's rules (2026-10-16):

| verdict | count | bug class |
|---|---:|---|
| rejected at compile time | 3 | a borrowed slice stored in a struct or collection, outliving its buffer (json-parse log location, fsrouter reload, Blob constructor) |
| caught at runtime | 2 | a stale pool slot, or reentrant JS freeing an object mid-use; a generational handle turns it into a panic |
| not prevented | 5 | three are **a GC finalizer and a native owner both believing they own the object** (subprocess stdin, shell interpreter, setImmediate); two cross threads or need `unsafe` (zlib worker teardown, valkey back-pointer) |

**QuickJS's engine layer.** quickjs-ng has had 19 memory-safety fixes in 2026
(UAF in FinalizationRegistry, Iterator.concat, DisposableStack, a suspended
coroutine, fast array delete; double frees of a CallSite and a detached
ArrayBuffer; refcount bugs in Promise.withResolvers). On 2026-10-11 it stopped
accepting private security reports and stopped issuing CVEs. Nearly every one
is a reference into the GC'd object graph that outlived what kept it alive.

**milojs today.** The same class is open here, just quieter:

- Engine temporaries are rooted by hand: `tempRoots` push and truncate at every
  call boundary in `src/engine/eval.milo`. Strict gc-stress found four missed
  roots in September alone. A missed root is a wrong answer, not a crash, which
  is the C engines' failure mode.
- Objects are `u32` indices into the heap in `src/engine/runtime.milo`. A
  recycled slot is silently a different object.
- `napi_wrap` and `napi_add_finalizer` in `src/runtime/napi.milo` ignored their
  finalizer callback until step 3 below. That avoided the double free by
  leaking, which is not safety.

The common thread across all three codebases: **Milo already wins on ordinary
ownership, and loses at the boundary between the GC heap and everything else.**
That boundary is what the design below closes.

## Design

Three mechanisms, one per surviving bug class. Each states what Milo checks and
what is left to a runtime mechanism, because claiming more than the compiler
checks is how this project's docs have gone wrong before.

### 1. Roots: scan the stack instead of pushing roots by hand

ChadScript's runtime already has a collector written in Milo (`runtime/gc.milo`
and `runtime/gc-stacks.milo` there): conservative roots, precise heap. It spills
registers, scans the running stack and every suspended fiber stack from the SP
saved in its context, and counts a word only if it names a live object. JSC
roots the same way. Adopting that root scan removes the hand-rooting class
outright: a value in a local or a register is a root because it is on a stack,
with no push to forget.

What a stack scan cannot see is a JSValue held in malloc'd memory, and milojs
has 214 `Vec<JSValue>` sites in `src/engine/` (argument vectors, part-built
arrays). Those become a `RootedVec` (`src/engine/rooted.milo`): a pointer to a
heap-allocated record holding the Vec, listed in a module-level registry when built
and removed in `Drop`. The record, not the Vec, is what is registered, because Milo
values move and a Vec's buffer reallocates on push. `tools/check-rooted-vec.mjs`
ratchets bare `Vec<JSValue>` in engine code per file (fields the collector already
traces are registered in `src/.rooted-vec-exempt`). So the rule is: a JSValue lives on a stack
(scanned), in the GC heap (traced), or in a `RootedVec` (registered). The rule
is enforced by gate plus `Drop`, not by the type checker; this doc does not
claim otherwise.

Conservative scanning over `u32` indices means any stack word that equals a
live slot index keeps that object alive. The false retention is bounded by the
number of stack words, a few thousand objects at most per collection, and it
never frees a live object. Scan at 4-byte granularity, since the enum payload
may sit in either half of a word.

Where an accessor can be written as a borrowing closure, Milo does check it.
Probe (2026-10-16): with raw object access exposed only as
`read(heap, id, (o: &Obj) => ...)`, a closure that allocates through
`&mut heap` is rejected at compile time with "'h' is captured by a closure
argument and borrowed in the same call", and a `&Obj` cannot be stored in a
struct. Use this shape for builtins that walk an object while allocating; it is
the typed half of the story. A raw id copied into a local is still unchecked;
that half is the stack scan's job.

### 2. Finalizers: one owner, moved out by whoever runs first

A native resource behind a JS object (fd, socket, zlib stream, a Node-API
`nativeObject`) is a `@noCopy` value held in an `Option` inside the object's
native slot. Explicit close and the GC finalizer both go through one `release`
that moves the value out and leaves `None`. The second caller finds `None`.

Probe (2026-10-16): a second `close(f)` of a `@noCopy` value is rejected with
"use of moved variable", and `release` passed the slot by value closes once
across two calls. This is the class bun's shell interpreter, subprocess stdin
and setImmediate fixes were patching, made unwritable rather than patched.

Milo gap found by the probe: there is no `Option.take(&mut self)`, and moving a
`@noCopy` value out of a field through `&mut` is rejected ("cannot move the
borrowed value out"). The by-value spelling works but is clumsy. `Option.take()`
(milo `348927e4`) closes this: `match o.fd.take() { ... }` through `&mut`.

Node-API finalizers then actually run, through the same `release`.

As landed: the owner types are `NapiFinalizer` and `FdOwner` in
`src/engine/runtime.milo`, each in an `OwnerSlot` chained off the object's
`JSObjExtra.ownerHead`. The sweep only moves a dead object's owners to
`Interp.finalizeQueue`; `drainFinalizers` in `src/engine/eval.milo` empties it
after each turn's microtasks, which is when node's deferred finalizers have run
by. An addon callback's handles stop being roots when it returns, as in node;
without that, every object an addon touched was pinned and nothing could
finalize. A napi owner is disposed by remove_wrap (cancel), the drain, or
`napiTeardown` at exit; an fd owner by `FileHandle.close()` in `lib/fs.js` or
the drain. Each path is a `.take()`.

### 3. Stale references: generational handles where slots recycle

Already planned in `docs/milojs-arena-safety.md`: object and scope slots move to
generational handles, so a recycled slot is a panic, not a different object.
Append-only AST indices stay typed newtypes, as that doc measured. Unchanged by
this direction; it moves up the queue.

## Proof

The writeup has to rest on things that fail when they should:

- **Bug-shape fixtures.** Port each of the ten bun bug shapes and the QuickJS
  2026 UAF repros as milojs fixtures. Each one either joins the Milo
  compile-error fixtures (it must fail to compile, with the expected message) or
  is a JS fixture that must exit cleanly or panic, never corrupt.
- **gc-stress strict with `tempRoots` deleted.** The existing every-allocation
  gate must stay green after the hand-rooting code is gone. That is the
  before/after number for mechanism 1.
- **Crash fuzzer.** `tools/fuzz.sh` against milojs-engine and QuickJS on mutated
  test262 input, reported as CPU-hours and crashes for each.
- **`unsafe` budget.** Count `unsafe` lines; the collector and FFI should hold
  all of them. Publish the number.

## Order

1. ~~Fix the linux-arm64 release crash.~~ Checked 2026-10-16: it no longer
   reproduces (`docs/status.md`, gate 0). Cause never identified, so the fuzz
   work in step 5 runs on linux-arm64 too.
2. ~~`Option.take` in Milo.~~ Landed as a compiler builtin, milo `348927e4`:
   `x.take()` lowers to `replace(x, None)` and needs a mutable place.
3. ~~Mechanism 2 for Node-API and one resource module.~~ Landed: napi_wrap,
   add_finalizer, create_external and remove_wrap, and fs.promises FileHandle,
   through one taken owner each, with the bun-shape fixtures.
4. Mechanism 1: port the stack scan, add `RootedVec` and its gate, delete
   `tempRoots`, keep gc-stress green. Measure the bench before and after; the
   call-boundary rooting it removes is a speed cost too.
   4a landed: `src/engine/stackscan.milo` scans the running stack, every parked task from the SP saved in its ucontext, and the OS stack, as an extra root source in `collect`. `tempRoots` is still in place. Debug knobs `MILOJS_GC_SKIP_TEMPROOTS=1` and `MILOJS_GC_NO_STACKSCAN=1` give the experiment. Strict every-allocation `tools/gc-stress.sh` (362 fixtures, 3 exempt): default 359 pass 0 fail; no tempRoots and no scan 0 pass (the prelude itself fails, every fixture fails); no tempRoots with scan 358 pass 1 fail (`urlSearchParams`, a spread result held in a `Vec<JSValue>` that only step 4b's `RootedVec` can cover). `--quick`: default 0 fail, no tempRoots and no scan 4 fail, no tempRoots with scan 0 fail.
   4b landed: `src/engine/rooted.milo` (`RootedVec`: new/withCapacity/fromVec, push, pop, len, get, set, clear, clone, toVec/cloneToVec as the escape hatch; no index operator in Milo, so `get(i)`), marked by `collect`; pilot is `spreadInto`/`spreadIntoArms`/`spreadBuiltin` and the callers' vectors. `tools/check-rooted-vec.mjs` ratchet starts at 194 bare `Vec<JSValue>` (eval 130, methods 46, builtins 15, runtime 2, bytecode 1) with 20 exempt traced fields. Strict gc-stress with `MILOJS_GC_SKIP_TEMPROOTS=1` (no tempRoots, scan on): 359 pass 0 fail (was 1 fail, `urlSearchParams`); default `tools/gc-stress.sh`: 359 pass 0 fail. Spread microbench within noise.
   4c batch 1 landed: `methods.milo` (46 to 0), `builtins.milo` (15 to 0), `bytecode.milo` (1 to 0, exempt) and `runtime.milo` (2 to 0, exempt) are off bare `Vec<JSValue>`; `eval.milo` fell 130 to 126 from forced signature changes (`coercedStringArgs`, the empty date/iterator arg vectors). Every builtin entry point (`arrayMethod`, `stringMethod`, `mapMethod`, `typedArrayMethod`, `regexMethod`, `dateMethod`, ...) now takes `&RootedVec`; eval call sites wrap with `RootedVec.fromVec` (hot paths, a move) or the new `RootedVec.fromClone` (borrowed `&Vec`), and callbacks leave through `cloneToVec`, all of which batch 2 deletes. Found and fixed an existing bug: `st.napiAddonExports` (the require cache of loaded `.node` addons) was never marked by `collect`; it was kept alive only by the load-time napi handle, which is released when the first `require` runs inside a native callback, after which a second `require` returned a freed exports object (`tests/napi/addonexports.js`, fails on the previous commit). Ratchet baseline is now eval 126, everything else 0, 23 exempt. Strict gc-stress: default 359 pass 0 fail; `MILOJS_GC_SKIP_TEMPROOTS=1` 359 pass 0 fail. Builtin microbench (arrays, strings, Math, Map, callbacks) about +3% from the wrapping at eval call sites, the microbenchmark suite within noise.
5. In parallel from here, three tracks:
   - **Engine speed:** bytecode VM on every function body, then QuickJS bench
     parity. Plan in `docs/milojs-quickjs-plan.md`.
   - **Runtime:** real apps drive the Node API work (Express, Prisma, then a
     Next-sized app). Each failure an app hits is the next ticket.
   - **Hardening:** mechanism 3 per `docs/milojs-arena-safety.md`, and the
     crash fuzzer against milojs and QuickJS on mutated test262 input.
6. The JIT: a baseline tier with its own fast code generator, then an
   optimizing tier (type speculation, inline caches, deopt). Not LLVM: WebKit's
   FTL tier used LLVM and replaced it with B3 in 2016 because LLVM compiles too
   slowly for a JIT. LLVM fits an ahead-of-time path, which is where the
   ChadScript tie-in belongs. Design doc when step 5's engine track reaches
   QuickJS parity.

**Decision point at QuickJS parity.** If milojs is still well behind QuickJS
with the same design (bytecode interpreter, same object model), the cost is in
Milo's generated code or the value representation, not a missing JIT. Fix that
first: a JIT on a slow runtime is still slow.

Rough sizes, for planning rather than promise: step 4 weeks; step 5's engine and
runtime tracks months each, run side by side; the baseline JIT 6+ months; the
optimizing tier years. JSC's four tiers took a dedicated team about 15 years.

test262, the node oracle and the bench budgets are the regression gates
throughout.

## Open questions

- Whether conservative false retention matters on a long-running server: measure
  retained-but-dead slots under the Express workload once step 4 lands.
- The ChadScript tie-in. Bun's `--aot` branch (2026-10) compiles typed code and
  falls back to JSC for the rest. ChadScript plus milojs is the same split, and
  sharing the collector in step 4 is the first piece of a shared runtime.
  Revisit when the JIT design starts.
