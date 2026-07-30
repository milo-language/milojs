## napi

### `napiHandle`

```milo
pub fn napiHandle(v: JSValue): i64
```

Wrap a value in a fresh handle. Handles are never reused within a run: the addon
may hold one indefinitely, and recycling a slot would silently retarget it.

### `napiHasPendingWork`

```milo
pub fn napiHasPendingWork(): bool
```

True while an addon owes us a settlement. Keeps the event loop from exiting
before a worker thread replies.

### `napiHasTsfn`

```milo
pub fn napiHasTsfn(): bool
```

_Undocumented._

### `napiInvoke`

```milo
pub fn napiInvoke(fnIdx: i64, args: Vec<JSValue>, thisVal: JSValue): JSValue
```

Invoke an addon-implemented function. Called by callValue when a JS call lands on
an object whose napiFn is set.

### `napiLoadAddon`

```milo
pub fn napiLoadAddon(path: &string): Result<JSValue, string>
```

Load a .node addon and run its registration, returning the exports it produced.

The real entry point is napi_register_module_v1(env, exports): we hand it a fresh
object and it populates it, but it may also return a DIFFERENT value, which then
becomes module.exports. Both shapes are legal and addons use both.

### `napiLoadI64`

```milo
pub fn napiLoadI64(p: *u8): i64
```

_Undocumented._

### `napiMayDeliver`

```milo
pub fn napiMayDeliver(): bool
```

Whether a settlement can still arrive from an addon's own threads. Unlike
napiHasPendingWork this ignores unref'd-ness: napi-rs unrefs its threadsafe
functions (so they must not keep the process alive), yet they are exactly how
a query result comes back, so a blocked await still has to wait on them.
The await's own deadline is the backstop if the addon never answers.

### `napiPollTsfn`

```milo
pub fn napiPollTsfn(): Vec<NapiTsfnCall>
```

Non-blocking drain. Returns the calls that were waiting.

### `napiRunTsfnCall`

```milo
pub fn napiRunTsfnCall(c: &NapiTsfnCall): JSValue
```

Run one queued call on the main thread. When the addon supplied a call_js_cb it
owns the dispatch entirely (that is where it converts `data` into JS values);
otherwise the spec says to invoke the JS function with no arguments.

### `napiTakePending`

```milo
pub fn napiTakePending(): Vec<NapiPending>
```

Drained by the interpreter after any call into an addon.

### `napiValueOf`

```milo
pub fn napiValueOf(h: i64): JSValue
```

Resolve a handle back to its value. Out-of-range yields Undefined rather than
trapping — a misbehaving addon must not take the process down.

### `napiWaitBriefly`

```milo
pub fn napiWaitBriefly()
```

Yield the CPU while waiting on an addon's worker thread. Polling flat out would
burn a core for the whole duration of a query.

### `napiWriteHandle`

```milo
pub fn napiWriteHandle(p: *u8, h: i64)
```

_Undocumented._
