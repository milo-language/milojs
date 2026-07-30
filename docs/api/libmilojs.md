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
