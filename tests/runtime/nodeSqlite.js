// node:sqlite — the DatabaseSync/StatementSync surface, including a file-backed
// database, so the natives are exercised against real libsqlite3 rather than
// only the in-memory path. Output is captured from Node 22+ for parity.
const { DatabaseSync, StatementSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, score REAL, bio TEXT)");

const ins = db.prepare("INSERT INTO users (name, score, bio) VALUES (?, ?, ?)");
console.log("insert", JSON.stringify(ins.run("alice", 9.5, null)));
console.log("insert", JSON.stringify(ins.run("bob", 3, "hi")));

console.log("all", JSON.stringify(db.prepare("SELECT * FROM users ORDER BY id").all()));
console.log("get", JSON.stringify(db.prepare("SELECT name FROM users WHERE id = ?").get(2)));
console.log("miss", db.prepare("SELECT name FROM users WHERE id = ?").get(99));

// named parameters, bare and prefixed
console.log("bare", JSON.stringify(db.prepare("SELECT name FROM users WHERE name = $n").all({ n: "bob" })));
console.log("prefixed", JSON.stringify(db.prepare("SELECT name FROM users WHERE name = :n").all({ ":n": "bob" })));

console.log("columns", JSON.stringify(db.prepare("SELECT id, name FROM users").columns().map((c) => c.name)));

const row = db.prepare("SELECT id, score, bio FROM users WHERE id = 1").get();
console.log("types", typeof row.id, typeof row.score, row.bio);

console.log("update", JSON.stringify(db.prepare("UPDATE users SET score = score + 1").run()));

let sum = 0;
for (const r of db.prepare("SELECT id FROM users").iterate()) { sum += r.id; }
console.log("iterate", sum);

// booleans are not bindable in Node. An object is not rejected either: a lone
// object argument is the named-parameter form, so an empty one binds nothing and
// the positional `?` stays NULL.
db.exec("CREATE TABLE flags (v INTEGER)");
const flag = db.prepare("INSERT INTO flags VALUES (?)");
try { flag.run(true); } catch (e) { console.log("bool bind", e.code); }
flag.run({});
flag.run(1n);
console.log("unbound then bigint", JSON.stringify(db.prepare("SELECT v FROM flags").all()));

// errors carry a code and the sqlite message
try { db.prepare("SELECT * FROM nope"); } catch (e) { console.log("prepare err", e.code, e.message); }
try { db.exec("NOT SQL"); } catch (e) { console.log("exec err", e.code); }

console.log("isOpen", db.isOpen, "location", db.location());
db.close();
console.log("closed", db.isOpen);
try { db.exec("SELECT 1"); } catch (e) { console.log("after close", e.message); }

// a real file on disk: open, write, close, reopen, read back
const file = path.join(process.env.TMPDIR || "/tmp", "milojs-sqlite-fixture.db");
try { fs.unlinkSync(file); } catch (e) { /* first run */ }

const disk = new DatabaseSync(file);
disk.exec("CREATE TABLE t (k TEXT PRIMARY KEY, v INTEGER)");
disk.prepare("INSERT INTO t VALUES (?, ?)").run("a", 1);
disk.prepare("INSERT INTO t VALUES (?, ?)").run("b", 2);
// Compare the basename, not the whole path: sqlite reports the resolved path,
// and macOS TMPDIR is a symlink (/var -> /private/var) while Linux /tmp is not,
// so an equality check against `file` is true on one platform and false on the
// other.
console.log("disk location", disk.location().endsWith("milojs-sqlite-fixture.db"));
disk.close();

const again = new DatabaseSync(file);
console.log("reopened", JSON.stringify(again.prepare("SELECT k, v FROM t ORDER BY k").all()));

// foreign keys are on by default, as in Node
again.exec("CREATE TABLE parent (id INTEGER PRIMARY KEY)");
again.exec("CREATE TABLE child (id INTEGER PRIMARY KEY, p INTEGER REFERENCES parent(id))");
try {
  again.prepare("INSERT INTO child VALUES (1, 42)").run();
  console.log("fk not enforced");
} catch (e) {
  console.log("fk enforced", e.code);
}
again.close();
fs.unlinkSync(file);

console.log("ctor", typeof DatabaseSync, typeof StatementSync);
