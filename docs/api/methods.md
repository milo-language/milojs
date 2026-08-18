## methods

### `arrayIterNext`

```milo
pub fn arrayIterNext(st: &mut Interp, it: i64): JSValue
```

_Undocumented._

### `arrayMethod`

```milo
pub fn arrayMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `arrayMethodGeneric`

```milo
pub fn arrayMethodGeneric(prog: &Prog, recv: &JSValue, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

Run an Array.prototype method against a receiver that is not a real array.

### `bytesFromTypedArray`

```milo
pub fn bytesFromTypedArray(st: &Interp, v: &JSValue): string
```

Compression moves BYTES, and a JavaScript string cannot carry them: milojs
strings are UTF-8, so any byte sequence that is not valid UTF-8 decodes to
U+FFFD and the data is destroyed. gzipSync(x) then gunzipSync() failed with
"incorrect header check" for exactly that reason. Both directions therefore
use Uint8Array, whose storage is raw bytes.

### `dataViewMethod`

```milo
pub fn dataViewMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

DataView get/set. Default endianness is BIG-endian (the littleEndian arg
defaults false), unlike typed arrays which store host/little-endian. taLen is
the view's byte length here; taBuf/taOffset locate it in the backing buffer.

### `dataViewProto`

```milo
pub fn dataViewProto(st: &mut Interp): i64
```

_Undocumented._

### `dateMethod`

```milo
pub fn dateMethod(st: &mut Interp, o: i64, name: &string, args: &Vec<JSValue>): JSValue
```

_Undocumented._

### `isArrayMethod`

```milo
pub fn isArrayMethod(name: &string): bool
```

_Undocumented._

### `isDataViewMethodName`

```milo
pub fn isDataViewMethodName(n: &string): bool
```

_Undocumented._

### `isTypedArrayMethodName`

```milo
pub fn isTypedArrayMethodName(n: &string): bool
```

_Undocumented._

### `mapMethod`

```milo
pub fn mapMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

_Undocumented._

### `msFloorSec`

```milo
pub fn msFloorSec(ms: f64): i64
```

Seconds to ADD to a UTC instant to get local wall-clock time at that instant.
Computed by decomposing with the host's localtime and recomposing the fields as
if they were UTC, so it follows the real timezone database including DST: this
machine answers -28800 in winter and -25200 in summer.
Whole seconds of an epoch-millisecond value, rounding toward NEGATIVE infinity
so a pre-epoch fractional value lands in the right second. `(ms / 1000.0) as i64`
truncates toward zero, which is off by one for negative times.

### `taIntegrityBlocked`

```milo
pub fn taIntegrityBlocked(st: &Interp, v: &JSValue): bool
```

[[Construct]] over any value. `new proxy(...)` with no construct trap has to
reach the TARGET's [[Construct]], which may be another proxy's trap, and
Reflect.construct has to be able to pass a newTarget that is not the callee —
neither is expressible as "call the target with a fresh `this`".
Move a freshly built builtin's internal slots onto the instance a subclass
constructor is initialising. `super()` cannot hand the built object back (the
subclass's `this` already exists and carries its own prototype), so the slots
move instead. Only the discriminators and their payloads: ordinary properties
stay where the subclass put them.
True for a typed array that still has elements. Freezing or sealing one is a
TypeError: its integer-indexed properties are non-configurable already and
cannot be made non-writable, so SetIntegrityLevel cannot complete.

### `typedArrayDataPtr`

```milo
pub fn typedArrayDataPtr(st: &Interp, v: JSValue): i64
```

The prototype a freshly created view of this kind links to, or -1 before
setupTypedArrayProtos has run.
True when the prototype chain BELOW the built-in %TypedArray% prototype
supplies `key` itself. A subclass that overrides a typed-array method (node's
Buffer overrides toString, slice, fill, indexOf, …) installs it on its own
prototype, which sits under Uint8Array.prototype in the chain — so the
built-in must only win when nothing down there claims the name. Dispatching
to the built-in unconditionally made every override unreachable through
`buf.toString()` while `Buffer.prototype.toString.call(buf)` still worked.

Deliberately &Interp, not &mut: typedArrayProtoFor needs a mutable lookup, and
threading one into these two dispatch sites made the prover havoc interpreter
state and drop six neighbouring contracts. nativePropsOf answers the same
question without creating anything — by the time an instance exists its
constructor's props bag does too, so the -1 arm is unreachable in practice and
falls back to the built-in, which is the pre-existing behaviour.
Address of a typed array's first byte, or 0 when the value is not one. The
read/write natives fill the CALLER's Buffer in place, which is the whole
contract of fs.read(fd, buffer, ...) — copying would silently drop the data.

### `typedArrayFromBytes`

```milo
pub fn typedArrayFromBytes(st: &mut Interp, src: &string): JSValue
```

Built by hand rather than through makeTypedArray, which needs a &Prog that
callBuiltin does not have.

### `typedArrayMethod`

```milo
pub fn typedArrayMethod(prog: &Prog, o: i64, name: &string, args: &Vec<JSValue>, st: &mut Interp): JSValue
```

Typed-array methods. Views share their buffer, so subarray returns a new view
over the SAME bytes while slice copies — getting that backwards is the classic
typed-array bug.

### `typedArrayOverride`

```milo
pub fn typedArrayOverride(st: &Interp, o: i64, key: &string): bool
```

_Undocumented._
