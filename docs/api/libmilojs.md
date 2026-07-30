## libmilojs

### `milojs_context_free`

```milo
pub fn milojs_context_free(context: i64): i32
```

Destroy `context`. A stale/wrong handle is rejected without affecting the
live context; callers can therefore make cleanup idempotent at their layer.

### `milojs_context_new`

```milo
pub fn milojs_context_new(outContext: *i64): i32
```

Create the process's single live engine context.

### `milojs_eval`

```milo
pub fn milojs_eval(context: i64, source: *u8, sourceLength: i64, outValue: *i64): i32
```

Execute a complete script and retain its completion value for the C host.

### `milojs_exception_copy`

```milo
pub fn milojs_exception_copy(context: i64, out: *u8, capacity: i64): i64
```

_Undocumented._

### `milojs_exception_length`

```milo
pub fn milojs_exception_length(context: i64): i64
```

_Undocumented._

### `milojs_value_bool`

```milo
pub fn milojs_value_bool(context: i64, value: i64, out: *bool): i32
```

_Undocumented._

### `milojs_value_get`

```milo
pub fn milojs_value_get(context: i64, value: i64, key: *u8, keyLength: i64, outValue: *i64): i32
```

Read a property with ordinary JavaScript getter/Proxy/prototype semantics and
retain the result as a new host value.

### `milojs_value_kind`

```milo
pub fn milojs_value_kind(context: i64, value: i64): i32
```

0 undefined, 1 null, 2 bool, 3 number, 4 string, 5 object,
6 function/native, 7 bigint.

### `milojs_value_number`

```milo
pub fn milojs_value_number(context: i64, value: i64, out: *f64): i32
```

_Undocumented._

### `milojs_value_release`

```milo
pub fn milojs_value_release(context: i64, value: i64): i32
```

_Undocumented._

### `milojs_value_string_copy`

```milo
pub fn milojs_value_string_copy(context: i64, value: i64, out: *u8, capacity: i64): i64
```

_Undocumented._

### `milojs_value_string_length`

```milo
pub fn milojs_value_string_length(context: i64, value: i64): i64
```

_Undocumented._
