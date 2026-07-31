// node:sqlite — Node 22's synchronous SQLite API over the runtime's sqlite
// natives (which wrap Milo's std/sqlite, i.e. libsqlite3 directly).
//
// Handles are opaque integers from the native side, not pointers: a closed
// database or finalized statement leaves its slot tombstoned, so a stale handle
// produces a JS error instead of a use-after-free.
"use strict";

// Node exposes the numeric code and a `sqlite`-prefixed message. We only have
// sqlite3_errmsg text, so the code is omitted rather than invented.
function sqliteError(msg) {
  var e = new Error(msg);
  e.code = "ERR_SQLITE_ERROR";
  return e;
}

// Node binds only null, numbers, bigints, strings, and TypedArray blobs; a
// boolean or a plain object is ERR_INVALID_ARG_TYPE rather than a silent
// coercion, and callers rely on that to catch `run(someUndefinedVar)`.
function coerceBindValue(v) {
  if (v === null) { return null; }
  var t = typeof v;
  if (t === "number" || t === "string") { return v; }
  if (t === "bigint") {
    // No 64-bit bind path yet, so anything past the double-safe range would
    // bind a wrong value — refuse instead.
    if (v > 9007199254740991n || v < -9007199254740991n) {
      throw sqliteError("BigInt values outside the safe integer range are not supported by milojs");
    }
    return Number(v);
  }
  var e = new TypeError(
    "The value argument must be of type null, number, bigint, string, or an " +
    "instance of Buffer or Uint8Array. Received type " + t);
  e.code = "ERR_INVALID_ARG_TYPE";
  throw e;
}

function StatementSync(dbHandle, handle, sql) {
  this._db = dbHandle;
  this._h = handle;
  this._sql = sql;
  this._finalized = false;
}

StatementSync.prototype._check = function () {
  if (this._finalized) {
    throw sqliteError("statement has been finalized");
  }
};

// Node accepts either positional args (`run(1, "a")`) or a single object of
// named parameters (`run({ $id: 1 })`). A lone object argument is ambiguous only
// in theory: sqlite has no object type, so treating it as named params matches
// Node and cannot collide with a legitimate positional value.
StatementSync.prototype._bind = function (args) {
  __sqliteReset(this._h);
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object" &&
      !Array.isArray(args[0])) {
    var obj = args[0];
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) { continue; }
      var idx = __sqliteBindIndex(this._h, k);
      if (idx === 0) {
        // bare name: Node's allowBareNamedParameters, on by default. Try each
        // prefix sqlite understands before giving up.
        idx = __sqliteBindIndex(this._h, "$" + k);
        if (idx === 0) { idx = __sqliteBindIndex(this._h, ":" + k); }
        if (idx === 0) { idx = __sqliteBindIndex(this._h, "@" + k); }
      }
      if (idx === 0) {
        throw sqliteError("Unknown named parameter '" + k + "'");
      }
      if (!__sqliteBind(this._h, idx, coerceBindValue(obj[k]))) {
        throw sqliteError("failed to bind parameter '" + k + "'");
      }
    }
    return;
  }
  for (var i = 0; i < args.length; i++) {
    if (!__sqliteBind(this._h, i + 1, coerceBindValue(args[i]))) {
      throw sqliteError("failed to bind parameter at index " + i);
    }
  }
};

var SQLITE_ROW = 100;
var SQLITE_DONE = 101;

// Advance one row. Returns true while rows remain; a code other than ROW/DONE is
// a statement failure (constraint violation, readonly db, ...) that sqlite only
// surfaces here, so it must be turned into a throw rather than a quiet stop.
StatementSync.prototype._step = function () {
  var rc = __sqliteStep(this._h);
  if (rc === SQLITE_ROW) { return true; }
  if (rc === SQLITE_DONE) { return false; }
  var msg = __sqliteErrmsg(this._db) || ("sqlite step failed with code " + rc);
  __sqliteReset(this._h);
  throw sqliteError(msg);
};

StatementSync.prototype._row = function () {
  var n = __sqliteColumnCount(this._h);
  var row = {};
  for (var i = 0; i < n; i++) {
    row[__sqliteColumnName(this._h, i)] = __sqliteColumnValue(this._h, i);
  }
  return row;
};

StatementSync.prototype.run = function () {
  this._check();
  this._bind(Array.prototype.slice.call(arguments));
  // A statement that returns rows still has to be stepped to completion or the
  // write it wraps (e.g. INSERT ... RETURNING) never commits.
  while (this._step()) { /* drain */ }
  // Key order matches Node's, so JSON.stringify of a result is byte-identical.
  var res = {
    lastInsertRowid: __sqliteLastInsertId(this._db),
    changes: __sqliteChanges(this._db),
  };
  __sqliteReset(this._h);
  return res;
};

StatementSync.prototype.get = function () {
  this._check();
  this._bind(Array.prototype.slice.call(arguments));
  var row;
  if (this._step()) {
    row = this._row();
  }
  __sqliteReset(this._h);
  return row;
};

StatementSync.prototype.all = function () {
  this._check();
  this._bind(Array.prototype.slice.call(arguments));
  var rows = [];
  while (this._step()) {
    rows.push(this._row());
  }
  __sqliteReset(this._h);
  return rows;
};

// Node streams rows lazily here. milojs's engine binary has no generators, so
// this materializes first and iterates the array — same observable results,
// but the memory profile of all().
StatementSync.prototype.iterate = function () {
  return this.all.apply(this, arguments)[Symbol.iterator]();
};

StatementSync.prototype.columns = function () {
  this._check();
  var n = __sqliteColumnCount(this._h);
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({ name: __sqliteColumnName(this._h, i), column: null, table: null, database: null, type: null });
  }
  return out;
};

StatementSync.prototype.finalize = function () {
  if (!this._finalized) {
    __sqliteFinalize(this._h);
    this._finalized = true;
  }
};

// Node has no parameter-expansion here without sqlite3_expanded_sql, so the
// source text is reported for both.
Object.defineProperty(StatementSync.prototype, "sourceSQL", {
  get: function () { return this._sql; },
});
Object.defineProperty(StatementSync.prototype, "expandedSQL", {
  get: function () { return this._sql; },
});

// setReadBigInts/setAllowBareNamedParameters exist so feature-detecting callers
// do not crash. Bare named parameters are always allowed; BigInt results are not
// implemented, so asking for them is an error rather than a silent lie.
StatementSync.prototype.setAllowBareNamedParameters = function (_v) { return this; };
StatementSync.prototype.setReadBigInts = function (v) {
  if (v) {
    throw sqliteError("setReadBigInts(true) is not supported by milojs");
  }
  return this;
};

function DatabaseSync(path, options) {
  if (!(this instanceof DatabaseSync)) {
    throw new TypeError("Class constructor DatabaseSync cannot be invoked without 'new'");
  }
  this._path = path;
  this._h = -1;
  this._open = false;
  var opts = options || {};
  if (opts.open === false) {
    return;
  }
  this.open();
  if (opts.enableForeignKeyConstraints !== false) {
    __sqliteExec(this._h, "PRAGMA foreign_keys = ON");
  }
}

DatabaseSync.prototype.open = function () {
  if (this._open) {
    throw sqliteError("database is already open");
  }
  var h = __sqliteOpen(this._path);
  if (h < 0) {
    throw sqliteError("unable to open database file: " + this._path);
  }
  this._h = h;
  this._open = true;
};

DatabaseSync.prototype._check = function () {
  if (!this._open) {
    throw sqliteError("database is not open");
  }
};

DatabaseSync.prototype.exec = function (sql) {
  this._check();
  if (__sqliteExec(this._h, sql) < 0) {
    throw sqliteError(__sqliteErrmsg(this._h) || "exec failed");
  }
};

DatabaseSync.prototype.prepare = function (sql) {
  this._check();
  var h = __sqlitePrepare(this._h, sql);
  if (h < 0) {
    throw sqliteError(__sqliteErrmsg(this._h) || "prepare failed");
  }
  return new StatementSync(this._h, h, sql);
};

DatabaseSync.prototype.close = function () {
  if (this._open) {
    __sqliteClose(this._h);
    this._open = false;
  }
};

Object.defineProperty(DatabaseSync.prototype, "isOpen", {
  get: function () { return this._open; },
});

// Node's location() returns the file the connection is attached to.
DatabaseSync.prototype.location = function (_dbName) {
  this._check();
  // sqlite reports "" for a temporary or in-memory database, which Node maps to
  // null; otherwise this is the resolved path, not the string that was passed.
  var f = __sqliteFilename(this._h);
  return f === "" ? null : f;
};

module.exports = { DatabaseSync: DatabaseSync, StatementSync: StatementSync };
module.exports.constants = {
  SQLITE_CHANGESET_OMIT: 0,
  SQLITE_CHANGESET_REPLACE: 1,
  SQLITE_CHANGESET_ABORT: 2,
};
