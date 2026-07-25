## lexer

### `hex4At`

```milo
fn hex4At(src: &string, at: i64): i64
```

four hex digits starting at src[at], or -1

### `isDigitByte`

```milo
fn isDigitByte(c: u8): bool
```

_Undocumented._

### `isIdentStart`

```milo
fn isIdentStart(c: u8): bool
```

_Undocumented._

### `isSpace`

```milo
fn isSpace(c: u8): bool
```

_Undocumented._

### `keywordKind`

```milo
fn keywordKind(s: &string): i32
```

_Undocumented._

### `lex`

```milo
pub fn lex(src: &string): Vec<Token>
```

_Undocumented._

### `prevAllowsRegex`

```milo
fn prevAllowsRegex(toks: &Vec<Token>): bool
```

After these tokens a `/` is division; anywhere else it starts a regex literal.
(Standard JS lexer heuristic — the grammar is genuinely context-dependent here.)

### `pushTok`

```milo
fn pushTok(toks: &mut Vec<Token>, kind: i32)
```

_Undocumented._

### `scanEscape`

```milo
fn scanEscape(src: &string, i: i64, out: &mut string): i64
```

Decode the backslash escape at src[i] (caller guarantees src[i]=='\\' and
i+1 < n), appending its expansion to `out`. Returns the position after the
escape. Handles \n \t \r \b \f \v \0 \xHH \uHHHH \u{H..H} and surrogate-pair
\uD8xx\uDCxx combining; a lone surrogate becomes U+FFFD (engine strings are
UTF-8 and cannot hold one). Unrecognized escapes yield the escaped char.

### `scanRegexLit`

```milo
fn scanRegexLit(src: &string, start: i64, toks: &mut Vec<Token>): i64
```

Scan a /pattern/flags literal starting at the opening slash. Returns the new
position; pushes a T_REGEX token holding "pattern\nflags".

### `scanTmplChunk`

```milo
fn scanTmplChunk(src: &string, start: i64, toks: &mut Vec<Token>): ChunkResult
```

Scan a template-literal text chunk from `start` (just after ` or after a hole's
closing }). Pushes a T_TEMPLATE_CHUNK token. Stops at ` (chunk done, whole
template ends) or ${ (a hole follows). isHole distinguishes the two.

### `tokenName`

```milo
pub fn tokenName(kind: i32): string
```

Human-readable name for a token kind, for parse errors. Punctuation tokens
carry no text of their own, so without this a diagnostic can only print the
raw kind number.
