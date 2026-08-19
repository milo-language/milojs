## engine/uniprops

### `uniPropExists`

```milo
pub fn uniPropExists(name: &string): bool
```

Is this a property name the tables know? `\p{NotAProperty}` is an early
SyntaxError, not a pattern that matches nothing, so the parser has to ask
before it commits.

### `uniPropRanges`

```milo
pub fn uniPropRanges(name: &string): Vec<i32>
```

Decode one property's ranges into a flat [lo, hi, lo, hi, ...] vector.
Returns an empty vector for an unknown name; the caller distinguishes the two
with uniPropExists, because a property CAN legitimately be empty.
