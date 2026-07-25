## napi

### `napi_acquire_threadsafe_function`

```milo
fn napi_acquire_threadsafe_function(_func: i64): i32
```

_Undocumented._

### `napi_add_env_cleanup_hook`

```milo
fn napi_add_env_cleanup_hook(_a0: *u8, _a1: *u8, _a2: *u8): i32
```

_Undocumented._

### `napi_call_function`

```milo
fn napi_call_function(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8, _a5: *u8): i32
```

_Undocumented._

### `napi_call_threadsafe_function`

```milo
fn napi_call_threadsafe_function(func: i64, data: i64, _isBlocking: i32): i32
```

_Undocumented._

### `napi_coerce_to_object`

```milo
fn napi_coerce_to_object(_a0: *u8, _a1: *u8, _a2: *u8): i32
```

_Undocumented._

### `napi_coerce_to_string`

```milo
fn napi_coerce_to_string(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_array`

```milo
fn napi_create_array(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_create_array_with_length`

```milo
fn napi_create_array_with_length(_env: *u8, length: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_bigint_words`

```milo
fn napi_create_bigint_words(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8): i32
```

_Undocumented._

### `napi_create_buffer`

```milo
fn napi_create_buffer(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8): i32
```

_Undocumented._

### `napi_create_buffer_copy`

```milo
fn napi_create_buffer_copy(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8): i32
```

_Undocumented._

### `napi_create_double`

```milo
fn napi_create_double(_env: *u8, value: f64, result: *u8): i32
```

_Undocumented._

### `napi_create_error`

```milo
fn napi_create_error(_env: *u8, _code: i64, msg: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_external_buffer`

```milo
fn napi_create_external_buffer(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8, _a5: *u8): i32
```

_Undocumented._

### `napi_create_function`

```milo
fn napi_create_function(_env: *u8, _utf8name: *u8, _length: i64, cb: i64, data: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_int32`

```milo
fn napi_create_int32(_env: *u8, value: i32, result: *u8): i32
```

_Undocumented._

### `napi_create_int64`

```milo
fn napi_create_int64(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_object`

```milo
fn napi_create_object(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_create_promise`

```milo
fn napi_create_promise(_env: *u8, deferred: *u8, promise: *u8): i32
```

_Undocumented._

### `napi_create_reference`

```milo
fn napi_create_reference(_env: *u8, value: i64, _initialRefcount: i32, result: *u8): i32
```

_Undocumented._

### `napi_create_string_utf8`

```milo
fn napi_create_string_utf8(_env: *u8, str: *u8, length: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_threadsafe_function`

```milo
fn napi_create_threadsafe_function(_env: *u8, func: i64, _asyncResource: i64, _asyncResourceName: i64, _maxQueueSize: i64, _initialThreadCount: i64, _threadFinalizeData: i64, _threadFinalizeCb: i64, context: i64, callJsCb: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_uint32`

```milo
fn napi_create_uint32(_env: *u8, value: i32, result: *u8): i32
```

_Undocumented._

### `napi_define_class`

```milo
fn napi_define_class(_env: *u8, _utf8name: *u8, _length: i64, constructor: i64, data: i64, propertyCount: i64, properties: *u8, result: *u8): i32
```

_Undocumented._

### `napi_delete_reference`

```milo
fn napi_delete_reference(_env: *u8, _ref: i64): i32
```

_Undocumented._

### `napi_fatal_error`

```milo
fn napi_fatal_error(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8)
```

_Undocumented._

### `napi_fatal_exception`

```milo
fn napi_fatal_exception(_a0: *u8, _a1: *u8): i32
```

_Undocumented._

### `napi_get_and_clear_last_exception`

```milo
fn napi_get_and_clear_last_exception(_a0: *u8, _a1: *u8): i32
```

_Undocumented._

### `napi_get_array_length`

```milo
fn napi_get_array_length(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_boolean`

```milo
fn napi_get_boolean(_env: *u8, value: bool, result: *u8): i32
```

_Undocumented._

### `napi_get_buffer_info`

```milo
fn napi_get_buffer_info(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8): i32
```

_Undocumented._

### `napi_get_cb_info`

```milo
fn napi_get_cb_info(_env: *u8, cbinfo: i64, argc: *u8, argv: *u8, thisArg: *u8, data: *u8): i32
```

_Undocumented._

### `napi_get_element`

```milo
fn napi_get_element(_env: *u8, object: i64, index32: i32, result: *u8): i32
```

index is uint32_t, NOT size_t. Declaring it i64 reads the undefined upper half
of the 32-bit argument slot on AArch64, so the index came through as garbage and
every element resolved to undefined.

### `napi_get_global`

```milo
fn napi_get_global(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_named_property`

```milo
fn napi_get_named_property(_env: *u8, object: i64, utf8name: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_null`

```milo
fn napi_get_null(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_property`

```milo
fn napi_get_property(_env: *u8, object: i64, key: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_property_names`

```milo
fn napi_get_property_names(_env: *u8, object: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_reference_value`

```milo
fn napi_get_reference_value(_env: *u8, ref: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_threadsafe_function_context`

```milo
fn napi_get_threadsafe_function_context(func: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_undefined`

```milo
fn napi_get_undefined(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_value_bigint_int64`

```milo
fn napi_get_value_bigint_int64(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8): i32
```

_Undocumented._

### `napi_get_value_bigint_uint64`

```milo
fn napi_get_value_bigint_uint64(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8): i32
```

_Undocumented._

### `napi_get_value_bigint_words`

```milo
fn napi_get_value_bigint_words(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8): i32
```

_Undocumented._

### `napi_get_value_bool`

```milo
fn napi_get_value_bool(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_double`

```milo
fn napi_get_value_double(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_int32`

```milo
fn napi_get_value_int32(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_string_utf8`

```milo
fn napi_get_value_string_utf8(_env: *u8, value: i64, buf: *u8, bufsize: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_uint32`

```milo
fn napi_get_value_uint32(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_has_named_property`

```milo
fn napi_has_named_property(_env: *u8, object: i64, utf8name: *u8, result: *u8): i32
```

_Undocumented._

### `napi_is_array`

```milo
fn napi_is_array(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_is_buffer`

```milo
fn napi_is_buffer(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_ref_threadsafe_function`

```milo
fn napi_ref_threadsafe_function(_env: *u8, _func: i64): i32
```

_Undocumented._

### `napi_reference_unref`

```milo
fn napi_reference_unref(_env: *u8, _ref: i64, result: *u8): i32
```

_Undocumented._

### `napi_reject_deferred`

```milo
fn napi_reject_deferred(_env: *u8, deferred: i64, rejection: i64): i32
```

_Undocumented._

### `napi_release_threadsafe_function`

```milo
fn napi_release_threadsafe_function(_func: i64, _mode: i32): i32
```

_Undocumented._

### `napi_resolve_deferred`

```milo
fn napi_resolve_deferred(_env: *u8, deferred: i64, resolution: i64): i32
```

_Undocumented._

### `napi_set_element`

```milo
fn napi_set_element(_env: *u8, object: i64, index32: i32, value: i64): i32
```

_Undocumented._

### `napi_set_named_property`

```milo
fn napi_set_named_property(_env: *u8, object: i64, utf8name: *u8, value: i64): i32
```

_Undocumented._

### `napi_throw`

```milo
fn napi_throw(_env: *u8, error: i64): i32
```

_Undocumented._

### `napi_throw_error`

```milo
fn napi_throw_error(_env: *u8, _code: *u8, msg: *u8): i32
```

_Undocumented._

### `napi_typeof`

```milo
fn napi_typeof(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_unref_threadsafe_function`

```milo
fn napi_unref_threadsafe_function(_env: *u8, _func: i64): i32
```

_Undocumented._

### `napi_unwrap`

```milo
fn napi_unwrap(_env: *u8, jsObject: i64, result: *u8): i32
```

_Undocumented._

### `napi_wrap`

```milo
fn napi_wrap(_env: *u8, jsObject: i64, nativeObject: i64, _finalizeCb: i64, _finalizeHint: i64, _result: *u8): i32
```

_Undocumented._

### `napiEnsurePipe`

```milo
fn napiEnsurePipe()
```

_Undocumented._

### `napiHandle`

```milo
fn napiHandle(v: JSValue): i64
```

Wrap a value in a fresh handle. Handles are never reused within a run: the addon
may hold one indefinitely, and recycling a slot would silently retarget it.

### `napiHandleCount`

```milo
fn napiHandleCount(): i64
```

Number of handles currently live — for tests and diagnostics.

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

### `napiLoadI32`

```milo
fn napiLoadI32(p: *u8): i32
```

_Undocumented._

### `napiLoadI64`

```milo
fn napiLoadI64(p: *u8): i64
```

_Undocumented._

### `napiMakeError`

```milo
fn napiMakeError(msgVal: JSValue): i64
```

_Undocumented._

### `napiMakeFn`

```milo
fn napiMakeFn(cb: i64, data: i64): i64
```

Register a callback and return the milojs object that dispatches to it.

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

### `napiReadHandle`

```milo
fn napiReadHandle(p: *u8): i64
```

_Undocumented._

### `napiReadStr`

```milo
fn napiReadStr(p: *u8, len: i64): string
```

NAPI_AUTO_LENGTH is (size_t)-1: the string is null-terminated instead of counted.

### `napiReset`

```milo
fn napiReset()
```

_Undocumented._

### `napiRunTsfnCall`

```milo
pub fn napiRunTsfnCall(c: &NapiTsfnCall): JSValue
```

Run one queued call on the main thread. When the addon supplied a call_js_cb it
owns the dispatch entirely (that is where it converts `data` into JS values);
otherwise the spec says to invoke the JS function with no arguments.

### `napiSettle`

```milo
fn napiSettle(p: i64, state: i64, value: JSValue)
```

napi_create_promise(env, deferred, promise)

The deferred and the promise are the same underlying object here, handed out as
two handles: milojs settles a promise in place, so there is no separate resolver
state to track.

### `napiTakePending`

```milo
pub fn napiTakePending(): Vec<NapiPending>
```

Drained by the interpreter after any call into an addon.

### `napiValueOf`

```milo
fn napiValueOf(h: i64): JSValue
```

Resolve a handle back to its value. Out-of-range yields Undefined rather than
trapping — a misbehaving addon must not take the process down.

### `napiWaitBriefly`

```milo
pub fn napiWaitBriefly()
```

Yield the CPU while waiting on an addon's worker thread. Polling flat out would
burn a core for the whole duration of a query.

### `napiWriteBool`

```milo
fn napiWriteBool(p: *u8, v: bool)
```

_Undocumented._

### `napiWriteF64`

```milo
fn napiWriteF64(p: *u8, v: f64)
```

_Undocumented._

### `napiWriteHandle`

```milo
fn napiWriteHandle(p: *u8, h: i64)
```

_Undocumented._

### `napiWriteI32`

```milo
fn napiWriteI32(p: *u8, v: i32)
```

Out-params are raw C pointers of varying width, so each write is explicit about
its size: a handle and a double are 8 bytes, napi_status/typeof enums are 4, and
a C bool is 1. Writing the wrong width silently corrupts the addon's stack.
