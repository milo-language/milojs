## host

### `absolutePathOf`

```milo
pub fn absolutePathOf(p: string): string
```

require(spec) — resolved against the directory of the module the call SITE
belongs to, which is not always the module currently running.

`st.modDirStack` is dynamic: it is popped when a module body finishes. A lazy
require inside a closure runs long after that, so it saw whoever triggered it.
body-parser's `Object.defineProperty(exports, 'json', {get: … require('./lib/types/json')})`
is exactly this shape, and express reaching for `bodyParser.json` resolved it
as `node_modules/express/lib/lib/types/json` — express 4 could not load at all.
The lexical `__dirname` binding is per module scope, so looking it up through
the closure's own env chain names the right module.
Make a path absolute against the process working directory. Module paths are
stored relative internally; what escapes to JS must not be.

### `buildChildCommand`

```milo
pub fn buildChildCommand(program: string, args: Vec<string>, envPairs: Vec<string>): Command
```

_Undocumented._

### `doHttpFetch`

```milo
pub fn doHttpFetch(method: &string, url: &string, headersRaw: &string, body: &string): string
```

Invoke a native function/constructor. Error(msg) and new Error(msg) behave the
same (both mint an error object), matching JS.
Synchronous outbound HTTP/HTTPS. Milo has no coroutines and the event loop is
drained in place on await, so a blocking request is consistent with the rest of
the runtime (the server side blocks on accept too). Returns the raw HTTP
response text prefixed with 'O', or 'E' + message on any failure — the JS side
(lib/node-fetch.js) strips the sentinel and parses the response.

### `parseDottedQuad`

```milo
pub fn parseDottedQuad(host: &string): u32
```

A dotted-quad host as the packed u32 TcpStream.connect wants. There is no
resolver here, so a name that is not four numbers falls back to loopback,
which is what "localhost" means and what every test that connects to a server
it just started is asking for.

### `readChildToCompletion`

```milo
pub fn readChildToCompletion(child: Child): string
```

Drain every queued microtask. Microtasks may enqueue more, which is correct:
JS runs the queue to exhaustion before the next timer.
Settle a promise and queue every reaction that was waiting on it. Settling
twice is ignored, as in JS.
Run threadsafe-function calls queued by an addon's own threads, then apply any
promise settlements they made. This is the only place a foreign thread's work
crosses into the interpreter.
Settle any fetch whose worker thread has finished. Called from the event loop
and from a blocked await, the same way node-api work is serviced.
Run a child to completion off the interpreter thread and encode the result as
one string, because that is what the pending-work channel carries. The format
is "<status>|<output>": a status and the combined stdout/stderr, with the
first pipe separating them so output containing pipes survives intact.
Read to EOF then reap. Runs on the worker thread: both halves block, and the
interpreter loop owns the OS main thread and never parks.

### `sqliteDbIdx`

```milo
pub fn sqliteDbIdx(st: &Interp, v: &JSValue): i64
```

A live index into st.sqliteDbs, or -1 when the handle is closed or bogus. Every
sqlite native funnels through this so a use-after-close is a JS-level error
rather than a call on a freed sqlite3*.

### `sqliteStmtIdx`

```milo
pub fn sqliteStmtIdx(st: &Interp, v: &JSValue): i64
```

_Undocumented._
