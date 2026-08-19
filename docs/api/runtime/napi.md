## runtime/napi

### `napi_acquire_threadsafe_function`

```milo
pub fn napi_acquire_threadsafe_function(_func: i64): i32
```

_Undocumented._

### `napi_add_env_cleanup_hook`

```milo
pub fn napi_add_env_cleanup_hook(_a0: *u8, _a1: *u8, _a2: *u8): i32
```

_Undocumented._

### `napi_add_finalizer`

```milo
pub fn napi_add_finalizer(_env: *u8, jsObject: i64, nativeObject: i64, _finalizeCb: i64, _finalizeHint: i64, result: *u8): i32
```

_Undocumented._

### `napi_call_threadsafe_function`

```milo
pub fn napi_call_threadsafe_function(func: i64, data: i64, _isBlocking: i32): i32
```

_Undocumented._

### `napi_close_escapable_handle_scope`

```milo
pub fn napi_close_escapable_handle_scope(_env: *u8, _scope: i64): i32
```

_Undocumented._

### `napi_close_handle_scope`

```milo
pub fn napi_close_handle_scope(_env: *u8, _scope: i64): i32
```

_Undocumented._

### `napi_coerce_to_object`

```milo
pub fn napi_coerce_to_object(_a0: *u8, _a1: *u8, _a2: *u8): i32
```

_Undocumented._

### `napi_coerce_to_string`

```milo
pub fn napi_coerce_to_string(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_array`

```milo
pub fn napi_create_array(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_create_array_with_length`

```milo
pub fn napi_create_array_with_length(_env: *u8, length: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_async_work`

```milo
pub fn napi_create_async_work(_env: *u8, _asyncResource: i64, _asyncResourceName: i64, execute: i64, complete: i64, data: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_bigint_words`

```milo
pub fn napi_create_bigint_words(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8): i32
```

_Undocumented._

### `napi_create_buffer`

```milo
pub fn napi_create_buffer(_env: *u8, length: i64, data: *u8, result: *u8): i32
```

_Undocumented._

### `napi_create_buffer_copy`

```milo
pub fn napi_create_buffer_copy(_env: *u8, length: i64, source: *u8, data: *u8, result: *u8): i32
```

_Undocumented._

### `napi_create_double`

```milo
pub fn napi_create_double(_env: *u8, value: f64, result: *u8): i32
```

_Undocumented._

### `napi_create_error`

```milo
pub fn napi_create_error(_env: *u8, _code: i64, msg: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_external`

```milo
pub fn napi_create_external(_env: *u8, data: i64, _finalizeCb: i64, _finalizeHint: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_external_buffer`

```milo
pub fn napi_create_external_buffer(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8, _a5: *u8): i32
```

_Undocumented._

### `napi_create_function`

```milo
pub fn napi_create_function(_env: *u8, _utf8name: *u8, _length: i64, cb: i64, data: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_int32`

```milo
pub fn napi_create_int32(_env: *u8, value: i32, result: *u8): i32
```

_Undocumented._

### `napi_create_int64`

```milo
pub fn napi_create_int64(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_object`

```milo
pub fn napi_create_object(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_create_promise`

```milo
pub fn napi_create_promise(_env: *u8, deferred: *u8, promise: *u8): i32
```

_Undocumented._

### `napi_create_reference`

```milo
pub fn napi_create_reference(_env: *u8, value: i64, _initialRefcount: i32, result: *u8): i32
```

_Undocumented._

### `napi_create_string_latin1`

```milo
pub fn napi_create_string_latin1(_env: *u8, str: *u8, length: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_string_utf8`

```milo
pub fn napi_create_string_utf8(_env: *u8, str: *u8, length: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_threadsafe_function`

```milo
pub fn napi_create_threadsafe_function(_env: *u8, func: i64, _asyncResource: i64, _asyncResourceName: i64, _maxQueueSize: i64, _initialThreadCount: i64, _threadFinalizeData: i64, _threadFinalizeCb: i64, context: i64, callJsCb: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_type_error`

```milo
pub fn napi_create_type_error(_env: *u8, _code: i64, msg: i64, result: *u8): i32
```

_Undocumented._

### `napi_create_uint32`

```milo
pub fn napi_create_uint32(_env: *u8, value: i32, result: *u8): i32
```

_Undocumented._

### `napi_define_class`

```milo
pub fn napi_define_class(_env: *u8, _utf8name: *u8, _length: i64, constructor: i64, data: i64, propertyCount: i64, properties: *u8, result: *u8): i32
```

_Undocumented._

### `napi_define_properties`

```milo
pub fn napi_define_properties(_env: *u8, object: i64, propertyCount: i64, properties: *u8): i32
```

_Undocumented._

### `napi_delete_async_work`

```milo
pub fn napi_delete_async_work(_env: *u8, work: i64): i32
```

_Undocumented._

### `napi_delete_reference`

```milo
pub fn napi_delete_reference(_env: *u8, _ref: i64): i32
```

_Undocumented._

### `napi_escape_handle`

```milo
pub fn napi_escape_handle(_env: *u8, _scope: i64, escapee: i64, result: *u8): i32
```

_Undocumented._

### `napi_fatal_error`

```milo
pub fn napi_fatal_error(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8)
```

_Undocumented._

### `napi_fatal_exception`

```milo
pub fn napi_fatal_exception(_a0: *u8, _a1: *u8): i32
```

_Undocumented._

### `napi_get_and_clear_last_exception`

```milo
pub fn napi_get_and_clear_last_exception(_a0: *u8, _a1: *u8): i32
```

_Undocumented._

### `napi_get_array_length`

```milo
pub fn napi_get_array_length(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_boolean`

```milo
pub fn napi_get_boolean(_env: *u8, value: bool, result: *u8): i32
```

_Undocumented._

### `napi_get_buffer_info`

```milo
pub fn napi_get_buffer_info(_env: *u8, value: i64, data: *u8, length: *u8): i32
```

_Undocumented._

### `napi_get_cb_info`

```milo
pub fn napi_get_cb_info(_env: *u8, cbinfo: i64, argc: *u8, argv: *u8, thisArg: *u8, data: *u8): i32
```

_Undocumented._

### `napi_get_element`

```milo
pub fn napi_get_element(_env: *u8, object: i64, index32: i32, result: *u8): i32
```

index is uint32_t, NOT size_t. Declaring it i64 reads the undefined upper half
of the 32-bit argument slot on AArch64, so the index came through as garbage and
every element resolved to undefined.

### `napi_get_global`

```milo
pub fn napi_get_global(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_last_error_info`

```milo
pub fn napi_get_last_error_info(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_named_property`

```milo
pub fn napi_get_named_property(_env: *u8, object: i64, utf8name: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_null`

```milo
pub fn napi_get_null(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_property`

```milo
pub fn napi_get_property(_env: *u8, object: i64, key: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_property_names`

```milo
pub fn napi_get_property_names(_env: *u8, object: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_reference_value`

```milo
pub fn napi_get_reference_value(_env: *u8, ref: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_threadsafe_function_context`

```milo
pub fn napi_get_threadsafe_function_context(func: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_typedarray_info`

```milo
pub fn napi_get_typedarray_info(_env: *u8, typedarray: i64, ttype: *u8, length: *u8, data: *u8, arraybuffer: *u8, byteOffset: *u8): i32
```

_Undocumented._

### `napi_get_undefined`

```milo
pub fn napi_get_undefined(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_get_value_bigint_int64`

```milo
pub fn napi_get_value_bigint_int64(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8): i32
```

_Undocumented._

### `napi_get_value_bigint_uint64`

```milo
pub fn napi_get_value_bigint_uint64(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8): i32
```

_Undocumented._

### `napi_get_value_bigint_words`

```milo
pub fn napi_get_value_bigint_words(_a0: *u8, _a1: *u8, _a2: *u8, _a3: *u8, _a4: *u8): i32
```

_Undocumented._

### `napi_get_value_bool`

```milo
pub fn napi_get_value_bool(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_double`

```milo
pub fn napi_get_value_double(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_external`

```milo
pub fn napi_get_value_external(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_int32`

```milo
pub fn napi_get_value_int32(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_int64`

```milo
pub fn napi_get_value_int64(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_string_utf8`

```milo
pub fn napi_get_value_string_utf8(_env: *u8, value: i64, buf: *u8, bufsize: i64, result: *u8): i32
```

_Undocumented._

### `napi_get_value_uint32`

```milo
pub fn napi_get_value_uint32(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_has_named_property`

```milo
pub fn napi_has_named_property(_env: *u8, object: i64, utf8name: *u8, result: *u8): i32
```

_Undocumented._

### `napi_has_own_property`

```milo
pub fn napi_has_own_property(_env: *u8, object: i64, key: i64, result: *u8): i32
```

_Undocumented._

### `napi_has_property`

```milo
pub fn napi_has_property(_env: *u8, object: i64, key: i64, result: *u8): i32
```

_Undocumented._

### `napi_is_array`

```milo
pub fn napi_is_array(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_is_buffer`

```milo
pub fn napi_is_buffer(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_is_exception_pending`

```milo
pub fn napi_is_exception_pending(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_open_escapable_handle_scope`

```milo
pub fn napi_open_escapable_handle_scope(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_open_handle_scope`

```milo
pub fn napi_open_handle_scope(_env: *u8, result: *u8): i32
```

_Undocumented._

### `napi_queue_async_work`

```milo
pub fn napi_queue_async_work(_env: *u8, work: i64): i32
```

_Undocumented._

### `napi_ref_threadsafe_function`

```milo
pub fn napi_ref_threadsafe_function(_env: *u8, _func: i64): i32
```

_Undocumented._

### `napi_reference_unref`

```milo
pub fn napi_reference_unref(_env: *u8, _ref: i64, result: *u8): i32
```

_Undocumented._

### `napi_reject_deferred`

```milo
pub fn napi_reject_deferred(_env: *u8, deferred: i64, rejection: i64): i32
```

_Undocumented._

### `napi_release_threadsafe_function`

```milo
pub fn napi_release_threadsafe_function(_func: i64, _mode: i32): i32
```

_Undocumented._

### `napi_resolve_deferred`

```milo
pub fn napi_resolve_deferred(_env: *u8, deferred: i64, resolution: i64): i32
```

_Undocumented._

### `napi_set_element`

```milo
pub fn napi_set_element(_env: *u8, object: i64, index32: i32, value: i64): i32
```

_Undocumented._

### `napi_set_named_property`

```milo
pub fn napi_set_named_property(_env: *u8, object: i64, utf8name: *u8, value: i64): i32
```

_Undocumented._

### `napi_throw`

```milo
pub fn napi_throw(_env: *u8, error: i64): i32
```

_Undocumented._

### `napi_throw_error`

```milo
pub fn napi_throw_error(_env: *u8, _code: *u8, msg: *u8): i32
```

_Undocumented._

### `napi_typeof`

```milo
pub fn napi_typeof(_env: *u8, value: i64, result: *u8): i32
```

_Undocumented._

### `napi_unref_threadsafe_function`

```milo
pub fn napi_unref_threadsafe_function(_env: *u8, _func: i64): i32
```

_Undocumented._

### `napi_unwrap`

```milo
pub fn napi_unwrap(_env: *u8, jsObject: i64, result: *u8): i32
```

_Undocumented._

### `napi_wrap`

```milo
pub fn napi_wrap(_env: *u8, jsObject: i64, nativeObject: i64, _finalizeCb: i64, _finalizeHint: i64, _result: *u8): i32
```

_Undocumented._

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
