## repl

### `banner`

```milo
fn banner(): void
```

Milo the chihuahua beside the wordmark. Each terminal cell packs two vertically
stacked pixels via ▀ (fg=top half, bg=bottom half), so the 18-row sprite fits in
9 rows. Built as ONE string and written with a single raw write(2): print()
buffers through libc stdout, so mixing the two would reorder the output.

### `charRGB`

```milo
fn charRGB(ch: u8, out: &mut [i64; 4]): void
```

Map a palette char to an RGB color; out[3]=0 marks a transparent pixel.

### `csiFinal`

```milo
fn csiFinal(c: u8, num: i64): i64
```

_Undocumented._

### `emit`

```milo
fn emit(buf: &mut string, s: &string): void
```

_Undocumented._

### `escapeEntry`

```milo
fn escapeEntry(s: &string): string
```

One entry per line. A multi-line block would break that, so its newlines are
escaped on the way out and restored on the way in.

### `flattenEntry`

```milo
fn flattenEntry(s: &string): string
```

The line editor is one line, so a recalled multi-line block has its newlines
flattened to spaces. JS only depends on newlines through semicolon insertion,
and a block that already parsed keeps parsing on one line.

### `formatCandidates`

```milo
fn formatCandidates(cands: &Vec<string>, kinds: &Vec<i64>): string
```

Candidate list in fixed-width columns across an assumed 80-col terminal, with a
blank line between kinds (node groups its listing the same way, one group per
object in the prototype chain).

### `historyPath`

```milo
fn historyPath(): string
```

_Undocumented._

### `isSpaceByte`

```milo
fn isSpaceByte(b: u8): bool
```

_Undocumented._

### `isUndefined`

```milo
fn isUndefined(v: &JSValue): bool
```

_Undocumented._

### `loadHistory`

```milo
fn loadHistory(history: &mut Vec<string>)
```

_Undocumented._

### `padTo`

```milo
fn padTo(s: &string, w: i64): string
```

_Undocumented._

### `paintCandidate`

```milo
fn paintCandidate(name: &string, kind: i64, w: i64): string
```

Colour by kind, so a glance separates what this session defined from the ~90
builtins it's buried among. Padding is applied to the bare name first — escape
bytes count toward .len() but occupy no columns.

### `readEscapeKey`

```milo
fn readEscapeKey(): i64
```

Decode the rest of an escape sequence, ESC already consumed. Handles the CSI
forms (`ESC [ … final`, including the `ESC [ 1 ; 5 C` modifier form terminals
send for Ctrl-arrow) and the Alt-<letter> forms readline binds to word motion.

### `readLineEdited`

```milo
fn readLineEdited(prompt: &string, history: &Vec<string>, st: &Interp, builtinCount: i64, inBlock: bool): LineResult
```

Raw-mode line editor. Owns the prompt so it can repaint on history recall.
Raw mode clears ISIG, so Ctrl-C arrives as byte 3 rather than a signal — the
double-tap-to-exit is handled here, no signal handler needed.

### `redraw`

```milo
fn redraw(prompt: &string, line: &string, cur: i64): void
```

Repaint the edited line in place: carriage-return to column 0, redraw prompt +
buffer, then clear to end-of-line so a shrinking line leaves no stale tail.
Finally walk the cursor back from end-of-line to `cur`. Moving relatively (not
to an absolute column) keeps this correct without having to know how wide the
prompt renders — it is full of escape bytes that occupy no columns.

### `repl`

```milo
pub fn repl(st: &mut Interp): i32
```

The read-eval-print loop. `st` must already have globals + Node globals installed.

### `runLine`

```milo
fn runLine(prog: &Prog, top: i64, st: &mut Interp): JSValue
```

Run one already-parsed top block: execute every statement, and if the last one
is a bare expression, return its value for echoing.

### `saveHistory`

```milo
fn saveHistory(history: &Vec<string>)
```

Whole-file rewrite on exit, keeping only the newest HISTORY_MAX entries. Two
REPLs exiting at once means last-writer-wins; node has the same behaviour.

### `setC`

```milo
fn setC(out: &mut [i64; 4], r: i64, g: i64, b: i64): void
```

_Undocumented._

### `sprCharAt`

```milo
fn sprCharAt(row: &string, c: i64): u8
```

name-prefixed: builtins.milo already defines a charAt, and Milo merges all
modules into one namespace

### `spriteRow`

```milo
fn spriteRow(i: i64): string
```

Milo the chihuahua, the mascot — same pixel-art bitmap as examples/graphics/chihuahua.milo.
Legend: space=transparent d=dark-brown b=brown-shadow t=tan l=light-tan
w=cream W=white-highlight k=eye/nose g=eye-glint p=pink

### `strCut`

```milo
fn strCut(s: &string, from: i64, to: i64): string
```

The half-open span [from, to) removed.

### `strInsert`

```milo
fn strInsert(s: &string, at: i64, b: u8): string
```

_Undocumented._

### `unescapeEntry`

```milo
fn unescapeEntry(s: &string): string
```

_Undocumented._

### `wordLeft`

```milo
fn wordLeft(line: &string, cur: i64, bigWord: bool): i64
```

_Undocumented._

### `wordmarkRow`

```milo
fn wordmarkRow(tr: i64): string
```

The wordmark printed to the right of the dog, one entry per sprite row so the
two line up. Sprite is 9 rows tall, wordmark 6 — offset by 1 to sit centered.

### `wordRight`

```milo
fn wordRight(line: &string, cur: i64, bigWord: bool): i64
```

_Undocumented._

### `wordSep`

```milo
fn wordSep(b: u8, bigWord: bool): bool
```

Word motion, readline-style: skip any run of separators, then the word itself.
`bigWord` uses whitespace as the only separator (what Ctrl-W kills in a shell);
otherwise anything non-alphanumeric separates, so `foo.bar` is two words.
