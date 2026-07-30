<!-- doc-meta
system: arena-safety
purpose: migration from raw integer arena indices to typed, stale-safe handles and frozen program state
key-files: ast.milo, runtime.milo, eval.milo, std/arena
update-when: an arena representation, handle type, mutation phase, or GC safepoint rule changes
last-verified: 2026-07-30
-->

# milojs arena safety

MiloJS predates Milo's generational `std/arena`. Its AST, scope arena, and object
heap use raw `i64` indices into `Vec<T>`. Stable slots avoid pointer invalidation,
but the type system cannot distinguish an expression index from an object or
scope index, absence is usually `-1`, and a stale recycled slot has no generation
check. Reaching Rust-class memory-safety ergonomics requires migrating these
invariants from comments and tests into types.

## Existing primitive

Use `std/arena` rather than building a MiloJS-specific generational arena.
`Handle<T>` contains an arena identity, slot, and generation; the phantom `T`
prevents cross-type use. `get`/`with` return `Option`, mutations and frees reject
stale handles, and callback-scoped `&T`/`&mut T` references cannot escape. Its
`live >= 0` invariant is proved.

The append-only AST has different needs: it never frees or reuses slots, so a
generation check on every expression dispatch buys nothing. Use distinct small
newtypes (`ExprId`, `StmtId`, `BlockId`, `FuncId`, and the remaining arena IDs)
around the index. Constructors validate bounds at the parser boundary; evaluator
APIs accept only the matching ID.

## Migration order

1. **Type the AST indices.** Introduce one ID family at a time, starting with
   `ExprId` and `StmtId`. Remove `-1` from those APIs in favor of `Option<Id>`.
   Acceptance: swapping an expression and statement ID is a compile failure;
   malformed/out-of-range construction is tested at the boundary; fixture speed
   does not regress materially.
2. **Freeze parsed programs.** Parsing owns `BuildingProg` and its allocation
   methods. Successful parse consumes it into `FrozenProg`; evaluation, modules,
   and closures receive only the frozen view. REPL appendability is explicit: it
   opens a build epoch, appends, then publishes a new frozen view without
   invalidating existing IDs.
3. **Move scopes to `Arena<Scope>`.** Replace parent/environment `i64` values
   with `Option<Handle<Scope>>`. GC uses `free`, so a stale closure environment
   becomes a detected invalid handle rather than aliasing a reused scope slot.
4. **Move objects to `Arena<JSObj>`.** Replace `JSValue.Obj(i64)` and object
   side-table indices with typed handles. Do this last: property access is the
   hottest path, and generation-check cost plus `JSObjExtra` ownership must be
   measured against representative engine and runtime workloads.
5. **Type-enforce GC safepoints.** An unrooted transient JS value must prevent
   allocation/collection. Model evaluation phases or an allocation capability so
   operations that may collect require proof that temporaries are rooted. This
   converts the current `pushTemp` discipline from convention into an API rule.

## Required evidence

- Compile-fail fixtures for cross-arena IDs, stale handles, and mutation through
  `FrozenProg`.
- Milo invariant fixtures for free/reuse, closure environments, host roots, and
  collection during nested calls.
- The normal and collect-at-every-safepoint JavaScript suites remain identical.
- Before/after startup, fixture throughput, and peak memory measurements for
  scope and object migrations. Safety checks stay enabled in release builds;
  performance work may change layout or validation placement, not remove stale
  handle detection.

`Option<Handle<T>>` replaces absence sentinels only where a value is a handle.
Numeric protocol states such as promise status remain explicit enums or numbers;
blindly replacing every negative integer would obscure rather than strengthen
the model.
