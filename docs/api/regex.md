## regex

### `regexCompile`

```milo
pub fn regexCompile(source: string, flags: string): Regex
```

_Undocumented._

### `regexExec`

```milo
pub fn regexExec(re: &Regex, s: &string, startPos: i64): Vec<i64>
```

Try to match anywhere at or after `startPos`. Returns a saves vector; saves[0] < 0
(and length 0) means no match. On success, saves has 2*(nGroups+1) entries.
