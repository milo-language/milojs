## engine/unicase

### `lowerCp1`

```milo
pub fn lowerCp1(cp: i32): i32
```

Simple lowercase mapping.

### `lowerSpecial`

```milo
pub fn lowerSpecial(cp: i32): string
```

Lowercase mappings that expand to more than one code point. "" means none.

### `upperCp1`

```milo
pub fn upperCp1(cp: i32): i32
```

Simple (one code point in, one out) uppercase mapping.

### `upperSpecial`

```milo
pub fn upperSpecial(cp: i32): string
```

Uppercase mappings that expand to more than one code point. "" means none.
