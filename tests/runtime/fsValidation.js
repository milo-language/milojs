// fs argument validation. A third of the fs area's failures were one thing: a
// bad path or a bad callback went through and either succeeded or threw a plain
// assertion, where node throws a TypeError carrying a stable `code`.
const fs = require("fs");
const assert = require("assert");

function show(label, fn) {
  try {
    fn();
    console.log(label + ": no throw");
  } catch (e) {
    console.log(label + ":", e.constructor.name, e.code, "|", e.message);
  }
}

show("path=null", () => fs.statSync(null));
// Not covered: readFileSync(42). Node treats a number as an already-open fd and
// fails with EBADF; milojs rejects it as a bad path. A real gap, not a message
// difference, so it is left out rather than locked to the wrong answer.
show("path={}", () => fs.mkdirSync({}));
show("rename oldPath", () => fs.renameSync(undefined, "b"));
show("rename newPath", () => fs.renameSync("a", 7));
show("fd=null", () => fs.fsyncSync(null));
show("fd=-1", () => fs.fsyncSync(-1));
show("fd=1.5", () => fs.fsyncSync(1.5));
show("async no callback", () => fs.stat("/tmp"));
show("async bad callback", () => fs.stat("/tmp", 5));
show("async null callback", () => fs.unlink("/tmp/x", null));

// existsSync answers rather than throwing, which is why it is deliberately
// absent from the validation table. (Handing it a non-path is not exercised
// here: node emits a deprecation warning on stderr for that, and matching
// node's warning text is not what this fixture is for.)
console.log("existsSync(missing):", fs.existsSync("/definitely/not/here"));

// assert.throws with a RegExp matches String(err), which carries the error's
// type name, not the message alone.
const e = new TypeError("boom");
console.log("String(err):", JSON.stringify(String(e)));
try {
  assert.throws(() => { throw e; }, /TypeError/);
  console.log("regex on type name: matched");
} catch (x) {
  console.log("regex on type name: FAILED");
}
try {
  assert.throws(() => { throw e; }, /boom/);
  console.log("regex on message: matched");
} catch (x) {
  console.log("regex on message: FAILED");
}
try {
  assert.throws(() => { throw e; }, /nope/);
  console.log("regex mismatch: wrongly matched");
} catch (x) {
  console.log("regex mismatch: rejected");
}
