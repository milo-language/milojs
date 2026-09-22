## engine/bootstrap

### `registerWellKnownSymbols`

```milo
pub fn registerWellKnownSymbols(st: &mut Interp)
```

Register the well-known symbols as ids 0..WK_COUNT, before anything else can
mint a symbol, so JSValue.Sym(WK_ITERATOR) and friends name the right entry.

### `setupGlobals`

```milo
pub fn setupGlobals(st: &mut Interp)
```

_Undocumented._

### `symConcatSpreadableKey`

```milo
pub fn symConcatSpreadableKey(): string
```

_Undocumented._

### `symSpeciesKey`

```milo
pub fn symSpeciesKey(): string
```

_Undocumented._
