<!-- doc-meta
system: gc-boundary
purpose: the project direction: milojs showcases Milo by making the GC-to-native boundary safe, and the design for roots, finalizers and stale references that does it
key-files: src/engine/eval.milo, src/engine/runtime.milo, src/runtime/napi.milo
update-when: a step below lands, a probe result changes, or the direction is revisited
last-verified: 2026-10-16
-->

# The GC boundary: what milojs is for

milojs exists to show that Milo makes a JavaScript engine and runtime safe and
pleasant to write. This doc narrows that to the one claim worth proving, records
the evidence that picked it, and lays out the design. `docs/status.md` stays the
scoreboard and `docs/backlog.md` the worklist. This file decides what goes on
the worklist.

## Why the direction changes

milojs is three projects at once, each of them years long:

| goal | where it stands | ceiling |
|---|---|---|
| spec-complete engine | test262 82% on a 3% sample; ~2,000 Temporal failures on the full corpus | reachable, slowly |
| fast engine | median 410x behind bun, worst 1,900x (`docs/conformance/bench.json`) | an interpreter tops out near QuickJS, still 20-50x behind a JIT |
| Node-compatible runtime | 17.3% of `test/parallel` | bun, with JSC under it, scores 40.8% on the same sweep |

None of those numbers says anything about Milo. A slow, partial Node clone
reads as "Milo is slow to build in" when the cause is scope. Each further point
of Node conformance proves breadth, not safety.

## The evidence: where memory bugs actually live

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
- `napi_wrap` and `napi_add_finalizer` in `src/runtime/napi.milo` ignore their
  finalizer callback. That avoids the double free by leaking, which is not
  safety.

The common thread across all three codebases: **Milo already wins on ordinary
ownership, and loses at the boundary between the GC heap and everything else.**
That boundary, in both layers, is the showcase.

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
arrays). Those become a `RootedVec`, a wrapper that registers its buffer with
the collector when built and unregisters it in `Drop`. A gate fails on any bare
`Vec<JSValue>` in engine code. So the rule is: a JSValue lives on a stack
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

## What stops

- Bytecode VM coverage and bench budgets: frozen. The interpreter's job is
  correctness.
- Node `test/parallel` percentage as a target: replaced by real workloads
  (Express, Prisma) and the resource-holding modules (fs, net, timers,
  child_process, zlib, Node-API), the ones that exercise mechanism 2.
- Temporal and Intl: dropped from the plan. What exists stays.

test262 and the node oracle stay as regression gates.

## Order

1. ~~Fix the linux-arm64 release crash.~~ Checked 2026-10-16: it no longer
   reproduces (`docs/status.md`, gate 0). Cause never identified, so the
   fuzz campaign in step 6 runs on linux-arm64 too.
2. ~~`Option.take` in Milo.~~ Landed as a compiler builtin, milo `348927e4`:
   `x.take()` lowers to `replace(x, None)` and needs a mutable place.
3. Mechanism 2 for Node-API and one resource module, with its bug-shape
   fixtures.
4. Mechanism 1: port the stack scan, add `RootedVec` and its gate, delete
   `tempRoots`, keep gc-stress green.
5. Mechanism 3 per `docs/milojs-arena-safety.md`.
6. Fuzz campaign and the writeup.

## Open questions

- Whether conservative false retention matters on a long-running server: measure
  retained-but-dead slots under the Express workload once step 4 lands.
- The ChadScript tie-in. Bun's `--aot` branch (2026-10) compiles typed code and
  falls back to JSC for the rest. ChadScript plus milojs is the same split, and
  sharing the collector in step 4 is the first piece of a shared runtime. Not on
  this plan; revisit after step 6.
