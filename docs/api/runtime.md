## runtime

### `accGetter`

```milo
pub fn accGetter(st: &Interp, acc: Option<Handle<Accessor>>): JSValue
```

Getter of an accessor property (undefined if the property is a data property
or the accessor has no getter).

### `accSetter`

```milo
pub fn accSetter(st: &Interp, acc: Option<Handle<Accessor>>): JSValue
```

_Undocumented._

### `arrGet`

```milo
pub fn arrGet(st: &Interp, obj: i64, idx: i64): JSValue
```

_Undocumented._

### `arrHasIndex`

```milo
pub fn arrHasIndex(st: &Interp, obj: i64, idx: i64): bool
```

HasProperty for an array index: an own element, an own sparse property, or
anything the prototype chain supplies. indexOf/lastIndexOf and the callback
methods are specified over PRESENT indices, and "present" includes inherited
ones — which is why this is not simply !arrIsHole.

### `arrIsHole`

```milo
pub fn arrIsHole(st: &Interp, obj: i64, idx: i64): bool
```

Remove an own property. An array index becomes a hole (undefined) rather than
shifting the remaining elements, matching JS.
Writing array.length truncates or extends with holes; JS treats it as a real
operation, and `arr.length = 0` is the standard way to clear an array.

### `arrLen`

```milo
pub fn arrLen(st: &Interp, obj: i64): i64
```

_Undocumented._

### `arrMarkHole`

```milo
pub fn arrMarkHole(st: &mut Interp, obj: i64, idx: i64)
```

_Undocumented._

### `arrPush`

```milo
pub fn arrPush(st: &mut Interp, obj: i64, value: JSValue)
```

_Undocumented._

### `arrSet`

```milo
pub fn arrSet(st: &mut Interp, obj: i64, idx: i64, value: JSValue)
```

Sequential writes stay dense. Far writes use the ordinary numeric property
bag so a sparse index cannot force allocation of every preceding hole.

### `asArrayIndex`

```milo
pub fn asArrayIndex(key: &string): i64
```

A key names an array element only if it is a canonical non-negative integer
("0", "1", ...); returns that index, or -1 for any other key (which addresses a
string property instead, per JS).

### `bigToRawBits`

```milo
pub fn bigToRawBits(s: &string): i64
```

A BigInt decimal string reduced into the kind's range and returned as the raw
64-bit pattern. i64 arithmetic wraps, so accumulating digits of a value below
2^64 produces exactly the bit pattern wanted for both signed and unsigned.

### `bitsToF32`

```milo
pub fn bitsToF32(bits: i64): f64
```

_Undocumented._

### `bitsToF64`

```milo
pub fn bitsToF64(bits: i64): f64
```

_Undocumented._

### `boxedPrimitive`

```milo
pub fn boxedPrimitive(st: &Interp, h: i64): JSValue
```

A wrapper object's primitive, or Undefined when the object is not a wrapper.
Lives here rather than in eval.milo because builtins.milo needs it too (JSON
serialises a wrapper as its primitive) and cannot import from eval.

### `bufferBytesHandle`

```milo
pub fn bufferBytesHandle(st: &Interp, o: i64): i64
```

If `o` is a milojs Buffer, return the handle of its backing byte array, else
-1. This is what lets buf[i] read and write a byte: node's Buffer is a
Uint8Array, but milojs backs it with a plain object holding a JS array in
`.bytes`, so the numeric property is not otherwise present and buf[i] would be
undefined. Gated on the non-enumerable `__isBuf` marker the Buffer constructor
stamps (buffer.js) — NOT the mere shape — so a user object that happens to
have `{ bytes, length }` is never mis-indexed as a buffer.

### `bufferNativeViewHandle`

```milo
pub fn bufferNativeViewHandle(st: &Interp, o: i64): i64
```

Return the native byte-view object stored in a Buffer's `.bytes`, or -1 for
ordinary JavaScript-backed Buffers and unrelated objects.

### `collect`

```milo
pub fn collect(st: &mut Interp)
```

Mark-sweep over both arenas. SAFE ONLY at execBlock statement boundaries: there
every live value is stored in a scope binding (a root) and no closure/object is
in-flight on the native stack mid-expression, so nothing reachable is missed.

### `defaultExtra`

```milo
pub fn defaultExtra(): JSObjExtra
```

_Undocumented._

### `ensureExtra`

```milo
pub fn ensureExtra(st: &mut Interp, o: i64): i64
```

Give object `o` a PRIVATE JSObjExtra slot (allocating or reusing one) and
return its index, so a rare field can be written. Idempotent: an object that
already owns a slot keeps it. Never returns 0 (the shared default).

### `enumOrder`

```milo
pub fn enumOrder(st: &Interp, o: i64): Vec<i64>
```

_Undocumented._

### `f32ToBits`

```milo
pub fn f32ToBits(x: f64): i64
```

f64 -> 32-bit float, then its 4 IEEE-754 bits. `as f32` does the rounding.

### `f64ToBits`

```milo
pub fn f64ToBits(x: f64): i64
```

f64 <-> raw IEEE-754 bits, via a byte view of the value's own storage. The
language has no bitcast, so this reads/writes the stack slot through a raw
pointer (unsafe, like std's other pointer work). Little-endian host assumed —
the same assumption the integer paths below already make.

### `getFuncProto`

```milo
pub fn getFuncProto(st: &mut Interp, fnIdx: i64): i64
```

_Undocumented._

### `getFuncStatics`

```milo
pub fn getFuncStatics(st: &mut Interp, fnIdx: i64, envIdx: i64): i64
```

_Undocumented._

### `getNativeProps`

```milo
pub fn getNativeProps(st: &mut Interp, n: &Native): i64
```

_Undocumented._

### `isPrivateKey`

```milo
pub fn isPrivateKey(k: &string): bool
```

_Undocumented._

### `isPromise`

```milo
pub fn isPromise(st: &Interp, o: i64): bool
```

_Undocumented._

### `isPromiseCtor`

```milo
pub fn isPromiseCtor(st: &Interp, o: i64): bool
```

_Undocumented._

### `isSymbolKey`

```milo
pub fn isSymbolKey(s: &string): bool
```

JS own-property enumeration order: integer-index keys ascending first, then
the remaining string keys in insertion order. Returns prop indices into
st.objects[o].props in that order. Symbol-keyed props (stored with the
"@@sym:" prefix, including internal ones like Symbol.iterator) are omitted —
string-key enumeration never yields symbols in JS. Enumeration sites
(Object.keys/values/entries, for-in, spread, Object.assign) iterate these
instead of 0..len so `{ 2:a, 1:b, 10:c, x:d }` enumerates 1,2,10,x and a
symbol key never leaks into keys()/for-in/JSON — matching V8/node.
A property key is a symbol iff it carries the "@@sym:" sentinel prefix that
symbol values stringify to (see makeSymbol in eval.milo). Kept here so
runtime.milo stays free of an eval.milo import cycle.

### `isWrapperObj`

```milo
pub fn isWrapperObj(st: &Interp, h: i64): bool
```

_Undocumented._

### `linkProtoConstructor`

```milo
pub fn linkProtoConstructor(st: &mut Interp, proto: i64, fnIdx: i64, envIdx: i64)
```

`Foo.prototype.constructor` — non-enumerable, so it stays out of for-in and
Object.keys on every instance that inherits it. Needs the constructor's
closure env, which getFuncProto doesn't have, so callers pass it in.

### `mapFind`

```milo
pub fn mapFind(st: &Interp, o: i64, key: &JSValue): i64
```

_Undocumented._

### `mapPut`

```milo
pub fn mapPut(st: &mut Interp, o: i64, key: JSValue, value: JSValue)
```

_Undocumented._

### `maybeGc`

```milo
pub fn maybeGc(st: &mut Interp)
```

Run a collection if enough allocations happened since the last one. Called
only from execBlock between statements (the GC safepoint).

### `nativeBufferGet`

```milo
pub fn nativeBufferGet(st: &Interp, o: i64, at: i64): JSValue
```

_Undocumented._

### `nativeBufferLen`

```milo
pub fn nativeBufferLen(st: &Interp, o: i64): i64
```

_Undocumented._

### `nativeBufferPtr`

```milo
pub fn nativeBufferPtr(st: &Interp, o: i64): i64
```

_Undocumented._

### `nativeBufferSet`

```milo
pub fn nativeBufferSet(st: &mut Interp, o: i64, at: i64, value: f64): bool
```

_Undocumented._

### `nativePropsOf`

```milo
pub fn nativePropsOf(st: &Interp, n: &Native): i64
```

The property bag a native already has, or -1. The read-only half of
getNativeProps, for callers that hold an immutable Interp and must not
materialise a bag as a side effect of asking.

### `newArray`

```milo
pub fn newArray(st: &mut Interp): i64
```

_Undocumented._

### `newObject`

```milo
pub fn newObject(st: &mut Interp): i64
```

_Undocumented._

### `newPromise`

```milo
pub fn newPromise(st: &mut Interp, state: i64, value: JSValue): i64
```

Promises settle synchronously — there is no event loop, so `new Promise(cb)`
whose cb resolves later never settles and awaiting it yields undefined.

### `newScope`

```milo
pub fn newScope(st: &mut Interp, parent: i64): i64
```

_Undocumented._

### `objDefineAccessor`

```milo
pub fn objDefineAccessor(st: &mut Interp, obj: i64, key: string, getter: JSValue, setter: JSValue)
```

Define (or replace) an accessor property.

### `objDefineBuiltinAttr`

```milo
pub fn objDefineBuiltinAttr(st: &mut Interp, obj: i64, key: string, value: JSValue)
```

Mark an existing own property non-enumerable, so it stays out of Object.keys,
for-in, spread and JSON.stringify. Used for the error surface (name/message/
stack), which the spec makes non-enumerable — `Object.keys(new TypeError("x"))`
is `[]` in a real engine, and code that spreads or serializes a caught error
otherwise picks up three fields that should not be there.
A built-in's own `name` / `length`: the spec gives both
{ writable: false, enumerable: false, configurable: true }, and test262 has a
name.js and a length.js per method that check exactly that with
verifyProperty — which also deletes the property to prove it is configurable.

### `objDefineFnProtoAttr`

```milo
pub fn objDefineFnProtoAttr(st: &mut Interp, obj: i64, key: string, value: JSValue)
```

An ORDINARY function's `prototype`: { writable: true, enumerable: false,
configurable: false }. Distinct from objDefineProtoAttr below, which is the
non-writable form a built-in constructor and a class use. This engine keeps no
class flag on FuncDef, so a class reports writable:true here — wrong in one
attribute, against the property having been entirely absent before.

### `objDefineProtoAttr`

```milo
pub fn objDefineProtoAttr(st: &mut Interp, obj: i64, key: string, value: JSValue)
```

A built-in constructor's `prototype`: { writable: false, enumerable: false,
configurable: false }. test262 checks this per constructor with
verifyNotWritable / verifyNotConfigurable.

### `objDeleteKey`

```milo
pub fn objDeleteKey(st: &mut Interp, obj: i64, key: &string): bool
```

Delete an own property. Returns whether the delete "succeeded" in JS terms:
true if the key was removed or was absent, false if it is a non-configurable
own property (which stays). `delete` evaluates to this bool.

### `objGet`

```milo
pub fn objGet(st: &Interp, obj: i64, key: &string): JSValue
```

_Undocumented._

### `objHas`

```milo
pub fn objHas(st: &Interp, o: i64, key: &string): bool
```

_Undocumented._

### `objHasInChain`

```milo
pub fn objHasInChain(st: &Interp, o: i64, key: &string): bool
```

objHas over the prototype chain, so a synthesised fallback method never
shadows one a prototype actually defines.

### `objOwnIndex`

```milo
pub fn objOwnIndex(st: &Interp, obj: i64, key: &string): i64
```

Index of `key` on `obj` itself (not its prototype chain), or -1.

### `objSet`

```milo
pub fn objSet(st: &mut Interp, obj: i64, key: string, value: JSValue)
```

_Undocumented._

### `objSetBuiltinAttr`

```milo
pub fn objSetBuiltinAttr(st: &mut Interp, obj: i64, key: string, value: JSValue)
```

A String wrapper's own index and length properties: readable and enumerable
(the indices) but frozen, matching the descriptors node reports. They are
materialised eagerly because the string behind them can never change.
The shape every built-in function's own `name` and `length` carry: readable,
not writable, not enumerable, but CONFIGURABLE — which is what lets a shim
redefine them. objSetFrozenOwn is the wrong shape for these (it also clears
configurable), and a plain objSet leaves them writable.

### `objSetFrozenOwn`

```milo
pub fn objSetFrozenOwn(st: &mut Interp, obj: i64, key: string, value: JSValue, enumerable: bool)
```

_Undocumented._

### `objSetNonConfigurable`

```milo
pub fn objSetNonConfigurable(st: &mut Interp, obj: i64, key: &string)
```

RegExp's lastIndex is the odd one out: writable but NOT configurable.

### `objSetNonEnumerable`

```milo
pub fn objSetNonEnumerable(st: &mut Interp, obj: i64, key: &string)
```

_Undocumented._

### `popActive`

```milo
pub fn popActive(st: &mut Interp)
```

_Undocumented._

### `popTemp`

```milo
pub fn popTemp(st: &mut Interp)
```

_Undocumented._

### `propIsAccessor`

```milo
pub fn propIsAccessor(st: &Interp, obj: i64, idx: i64): bool
```

Whether property `idx` on `obj` is an accessor (the read every property path
used to make against an inline `isAccessor` bool).

### `pushActive`

```milo
pub fn pushActive(st: &mut Interp, scope: i64)
```

Roots pushed/popped around every call and block body. Popping makes a
completed frame collectable at the next GC safepoint.

### `pushTemp`

```milo
pub fn pushTemp(st: &mut Interp, v: JSValue)
```

_Undocumented._

### `rawBitsToBig`

```milo
pub fn rawBitsToBig(bits: i64, signed: bool): string
```

The inverse: a raw 64-bit pattern as a decimal string, read signed or not.

### `restoreExecCtx`

```milo
pub fn restoreExecCtx(st: &mut Interp, ctx: ExecCtx)
```

Put a saved execution back. Whatever was running is discarded, so the caller
must have saved it first.

### `sameValueZero`

```milo
pub fn sameValueZero(a: &JSValue, b: &JSValue): bool
```

Index of `key` in a Map/Set's entry list, or -1. Keys compare by strict
equality, so objects match by identity.
Map/Set key identity is SameValueZero, not strict equality: the one difference
that matters is NaN, which is its own key here even though NaN !== NaN. Without
this a NaN key can be stored but never looked up again.

### `saveExecCtx`

```milo
pub fn saveExecCtx(st: &mut Interp): ExecCtx
```

Lift the running execution out of the Interp, leaving it clean for whoever
runs next. The caller owns the returned context until it restores it.

### `scopeAssign`

```milo
pub fn scopeAssign(st: &mut Interp, scope: i64, name: &string, value: JSValue)
```

Assignment walks the chain; if unbound, creates a global (sloppy JS).
`name` is borrowed, not owned: this runs on every assignment, and taking it by
value made each caller clone the identifier string, a malloc/free pair per
`x = ...`. Only the `value` field is written for the same reason: replacing
the whole Binding dropped the old name string and moved an identical one back
in, when a match on `name` already proves the stored name is correct.
Worth ~5-10% on every bench in bench/ (measured against 5b377bd).

### `scopeDefine`

```milo
pub fn scopeDefine(st: &mut Interp, scope: i64, name: string, value: JSValue)
```

_Undocumented._

### `scopeHas`

```milo
pub fn scopeHas(st: &Interp, scope: i64, name: &string): bool
```

_Undocumented._

### `scopeHasBelowGlobal`

```milo
pub fn scopeHasBelowGlobal(st: &Interp, scope: i64, name: &string): bool
```

Is `name` bound anywhere on the scope chain? Distinguishes an undeclared
identifier from one declared and holding undefined — the two are otherwise
indistinguishable, which silently turns typos into undefined.
Like scopeHas, but stops before the GLOBAL scope. `eval` now has a global
binding (get-intrinsic reads it as a value), and the direct-call form must
still work — it is only a user binding that shadows it that should turn
`eval(x)` into an ordinary call.

### `scopeHasOwn`

```milo
pub fn scopeHasOwn(st: &Interp, scope: i64, name: &string): bool
```

Is `name` bound in this scope itself (not a parent)? Hoisting must not
clobber a binding of the same name from an enclosing scope.

### `scopeLookup`

```milo
pub fn scopeLookup(st: &Interp, scope: i64, name: &string): JSValue
```

_Undocumented._

### `scopeTryLookup`

```milo
pub fn scopeTryLookup(st: &Interp, scope: i64, name: &string): Option<JSValue>
```

Lookup and existence check in one chain walk — the identifier-read hot path
previously walked the whole chain twice (scopeHas, then scopeLookup).

### `setArrayLength`

```milo
pub fn setArrayLength(st: &mut Interp, obj: i64, n: i64)
```

_Undocumented._

### `taIsBigKind`

```milo
pub fn taIsBigKind(kind: i64): bool
```

_Undocumented._

### `taLoad`

```milo
pub fn taLoad(bytes: &Vec<u8>, kind: i64, at: i64): f64
```

Read one element out of a buffer's bytes, little-endian.

### `taLoadBig`

```milo
pub fn taLoadBig(bytes: &Vec<u8>, kind: i64, at: i64): string
```

_Undocumented._

### `taName`

```milo
pub fn taName(kind: i64): string
```

_Undocumented._

### `taStore`

```milo
pub fn taStore(bytes: &mut Vec<u8>, kind: i64, at: i64, v: f64)
```

Store one element, applying the kind's wrapping (or clamping) rules.

### `taStoreBig`

```milo
pub fn taStoreBig(bytes: &mut Vec<u8>, at: i64, s: &string)
```

_Undocumented._

### `taWidth`

```milo
pub fn taWidth(kind: i64): i64
```

_Undocumented._
