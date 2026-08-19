## engine/lexer

### `lex`

```milo
pub fn lex(src: &string): Vec<Token>
```

_Undocumented._

### `tokenName`

```milo
pub fn tokenName(kind: i32): string
```

Human-readable name for a token kind, for parse errors. Punctuation tokens
carry no text of their own, so without this a diagnostic can only print the
raw kind number.
