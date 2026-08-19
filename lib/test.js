// node:test — the test runner.
//
// 171 of node's own parallel tests are written against this module, and every
// one of them failed at `require` before this existed: the assertions inside
// them had never run. The runner only has to do three things for those to be
// meaningful — register tests, run them in order (awaiting async ones), and exit
// non-zero if any failed, because the exit code is all the harness reads.
"use strict";

var assert = require('assert');
var _err = require('_errors');

var rootTests = [];
var suiteStack = [];
var scheduled = false;
var failures = 0;
var passes = 0;
var skipped = 0;

function currentCollection() {
  return suiteStack.length > 0 ? suiteStack[suiteStack.length - 1].children : rootTests;
}

function normalizeArgs(name, options, fn) {
  if (typeof name === 'function') { fn = name; options = {}; name = fn.name || '<anonymous>'; }
  else if (typeof options === 'function') { fn = options; options = {}; }
  return { name: String(name), options: options || {}, fn: fn };
}

// --- mock -------------------------------------------------------------------
// Enough of the mock surface for the calls these tests make: a spy that records
// its calls, and method replacement that can be restored.

function makeMockFn(original, implementation) {
  var impl = implementation || original || function () {};
  var calls = [];
  var fn = function () {
    var args = [];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    var record = { arguments: args, this: this, error: undefined, result: undefined };
    calls.push(record);
    try {
      record.result = impl.apply(this, args);
      return record.result;
    } catch (e) {
      record.error = e;
      throw e;
    }
  };
  fn.mock = {
    calls: calls,
    callCount: function () { return calls.length; },
    resetCalls: function () { calls.length = 0; },
    mockImplementation: function (next) { impl = next; },
    mockImplementationOnce: function (next) {
      var prior = impl;
      var used = false;
      impl = function () {
        if (!used) { used = true; var r = next.apply(this, arguments); impl = prior; return r; }
        return prior.apply(this, arguments);
      };
    },
    restore: function () {},
  };
  return fn;
}

function MockTracker() {
  this._restores = [];
}
MockTracker.prototype.fn = function (original, implementation) {
  return makeMockFn(original, implementation);
};
MockTracker.prototype.method = function (object, name, implementation) {
  var original = object[name];
  var mocked = makeMockFn(original, implementation || original);
  mocked.mock.restore = function () { object[name] = original; };
  object[name] = mocked;
  this._restores.push(function () { object[name] = original; });
  return mocked;
};
MockTracker.prototype.getter = function (object, name, implementation) {
  var desc = Object.getOwnPropertyDescriptor(object, name);
  var mocked = makeMockFn(desc && desc.get, implementation);
  Object.defineProperty(object, name, { get: mocked, configurable: true });
  this._restores.push(function () {
    if (desc) Object.defineProperty(object, name, desc); else delete object[name];
  });
  return mocked;
};
MockTracker.prototype.setter = function (object, name, implementation) {
  var desc = Object.getOwnPropertyDescriptor(object, name);
  var mocked = makeMockFn(desc && desc.set, implementation);
  Object.defineProperty(object, name, { set: mocked, configurable: true });
  this._restores.push(function () {
    if (desc) Object.defineProperty(object, name, desc); else delete object[name];
  });
  return mocked;
};
MockTracker.prototype.reset = function () { this.restoreAll(); };
MockTracker.prototype.restoreAll = function () {
  for (var i = this._restores.length - 1; i >= 0; i--) this._restores[i]();
  this._restores.length = 0;
};

var mock = new MockTracker();

// --- test context -----------------------------------------------------------

// Custom assertions, registered at module scope through the exported
// `assert.register` and materialized onto every TestContext built afterwards.
// Registration is global in node too: a file registers once at the top and every
// test in it sees the name.
var customAssertions = Object.create(null);

var testAssert = {
  register: function (name, fn) {
    if (typeof name !== 'string') throw _err.ERR_INVALID_ARG_TYPE('name', 'string', name);
    if (typeof fn !== 'function') throw _err.ERR_INVALID_ARG_TYPE('fn', 'function', fn);
    customAssertions[name] = fn;
  },
};

function TestContext(node) {
  this.name = node.name;
  this.fullName = node.fullName;
  this.filePath = process.argv[1];
  this._node = node;
  this._plan = null;
  this._count = 0;
  var ctx = this;
  // Every assertion is wrapped so `t.plan(n)` has something to count. The
  // wrapper forwards `this`, which is what makes a registered assertion see the
  // TestContext rather than the assert object.
  var counted = function (fn) {
    return function () {
      ctx._count++;
      return fn.apply(ctx, arguments);
    };
  };
  // t.assert is node:assert plus the bare-callable form, so `t.assert.ok(x)` and
  // `t.assert(x)` both work the way the tests use them.
  var a = counted(function (value, message) { return assert.ok(value, message); });
  var keys = Object.keys(assert);
  for (var i = 0; i < keys.length; i++) a[keys[i]] = counted(assert[keys[i]]);
  // Custom ones go on LAST: node lets a registration override a built-in
  // assertion, and its own test registers `ok` and `deepStrictEqual` to check
  // exactly that.
  var custom = Object.keys(customAssertions);
  for (var j = 0; j < custom.length; j++) a[custom[j]] = counted(customAssertions[custom[j]]);
  this.assert = a;
  this.mock = mock;
  this.signal = undefined;
}
// node counts assertions AND subtests against the plan, and checks it once the
// test body and its children have finished.
TestContext.prototype.plan = function (count) {
  if (typeof count !== 'number' || !isFinite(count) || count < 0 || Math.floor(count) !== count) {
    throw _err.ERR_INVALID_ARG_TYPE('count', 'number', count);
  }
  this._plan = count;
};
TestContext.prototype._checkPlan = function () {
  if (this._plan === null) return;
  var n = this._count + this._node.children.length;
  if (n !== this._plan) {
    var e = new Error('plan expected ' + this._plan + ' assertions but ' + n + ' ran');
    e.code = 'ERR_TEST_FAILURE';
    throw e;
  }
};
TestContext.prototype.diagnostic = function (msg) { console.log('# ' + msg); };
TestContext.prototype.skip = function (msg) { this._node.skipped = true; if (msg) this.diagnostic(msg); };
TestContext.prototype.todo = function (msg) { this._node.todo = true; if (msg) this.diagnostic(msg); };
TestContext.prototype.runOnly = function () {};
TestContext.prototype.after = function (fn) { this._node.afterHooks.push(fn); };
TestContext.prototype.beforeEach = function (fn) { this._node.beforeEachHooks.push(fn); };
TestContext.prototype.afterEach = function (fn) { this._node.afterEachHooks.push(fn); };
TestContext.prototype.test = function (name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  var child = makeNode(a.name, a.options, a.fn, this._node);
  this._node.children.push(child);
  return Promise.resolve();
};
// Poll a condition until it holds, which is how these tests wait on state that
// no event reports.
TestContext.prototype.waitFor = function (condition, options) {
  var timeout = (options && options.timeout) || 1000;
  var interval = (options && options.interval) || 10;
  var started = Date.now();
  return new Promise(function (resolve, reject) {
    function attempt() {
      var result;
      try { result = condition(); } catch (e) {
        if (Date.now() - started >= timeout) { reject(e); return; }
        setTimeout(attempt, interval);
        return;
      }
      Promise.resolve(result).then(resolve, function (e) {
        if (Date.now() - started >= timeout) { reject(e); return; }
        setTimeout(attempt, interval);
      });
    }
    attempt();
  });
};

function makeNode(name, options, fn, parent) {
  return {
    name: name,
    fullName: parent && parent.fullName ? parent.fullName + ' > ' + name : name,
    options: options || {},
    fn: fn,
    children: [],
    afterHooks: [],
    beforeEachHooks: [],
    afterEachHooks: [],
    skipped: !!(options && (options.skip || options.todo)),
    todo: !!(options && options.todo),
    only: !!(options && options.only),
    isSuite: false,
  };
}

// --- registration -----------------------------------------------------------

function test(name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  var parent = suiteStack.length > 0 ? suiteStack[suiteStack.length - 1] : null;
  var node = makeNode(a.name, a.options, a.fn, parent);
  currentCollection().push(node);
  schedule();
  // node's test() returns a promise that settles when the test does; returning a
  // resolved one keeps `await test(...)` from hanging.
  return Promise.resolve();
}

function describe(name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  var parent = suiteStack.length > 0 ? suiteStack[suiteStack.length - 1] : null;
  var node = makeNode(a.name, a.options, a.fn, parent);
  node.isSuite = true;
  currentCollection().push(node);
  // The body runs NOW, so nested describe/it register into this suite; only the
  // tests themselves are deferred.
  suiteStack.push(node);
  try {
    if (typeof a.fn === 'function') a.fn.call(node);
  } finally {
    suiteStack.pop();
  }
  schedule();
  return Promise.resolve();
}

var hooks = { before: [], after: [], beforeEach: [], afterEach: [] };
function addHook(kind) {
  return function (fn) {
    var target = suiteStack.length > 0 ? suiteStack[suiteStack.length - 1] : null;
    if (!target) { hooks[kind].push(fn); return; }
    if (kind === 'before') { target.beforeHooks = target.beforeHooks || []; target.beforeHooks.push(fn); }
    else if (kind === 'after') target.afterHooks.push(fn);
    else if (kind === 'beforeEach') target.beforeEachHooks.push(fn);
    else target.afterEachHooks.push(fn);
  };
}

// --- execution --------------------------------------------------------------

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // Deferred a turn so the whole file finishes registering first; running as
  // each test() is called would execute them before their siblings exist.
  setTimeout(runAll, 0);
}

function runHooks(list, arg) {
  var chain = Promise.resolve();
  (list || []).forEach(function (h) {
    chain = chain.then(function () { return h(arg); });
  });
  return chain;
}

function runNode(node, inheritedEach) {
  if (node.skipped && !node.isSuite) {
    skipped++;
    console.log('ok - ' + node.fullName + ' # SKIP');
    return Promise.resolve();
  }
  var ctx = new TestContext(node);
  var eachBefore = (inheritedEach.before || []).concat(node.beforeEachHooks || []);
  var eachAfter = (inheritedEach.after || []).concat(node.afterEachHooks || []);

  var start = node.isSuite
    ? runHooks(node.beforeHooks, ctx)
    : runHooks(eachBefore, ctx).then(function () {
        return typeof node.fn === 'function' ? node.fn(ctx) : undefined;
      });

  return start.then(function () {
    // Children run after the body, so subtests registered by t.test() are picked
    // up in the same pass.
    var chain = Promise.resolve();
    node.children.forEach(function (child) {
      chain = chain.then(function () {
        return runNode(child, node.isSuite ? { before: eachBefore, after: eachAfter } : inheritedEach);
      });
    });
    return chain;
  }).then(function () {
    if (!node.isSuite) { ctx._checkPlan(); passes++; console.log('ok - ' + node.fullName); }
    return runHooks(node.isSuite ? node.afterHooks : eachAfter.concat(node.afterHooks), ctx);
  }, function (err) {
    failures++;
    console.log('not ok - ' + node.fullName);
    console.log('  ' + (err && err.stack ? err.stack : String(err)));
    return runHooks(node.isSuite ? node.afterHooks : eachAfter.concat(node.afterHooks), ctx)
      .then(function () {}, function () {});
  });
}

// Only-mode is per FILE, not per level: node keeps a marked test wherever it
// sits, and keeps a suite that contains one so its hooks still run.
function hasOnly(node) {
  if (node.only) return true;
  for (var i = 0; i < node.children.length; i++) if (hasOnly(node.children[i])) return true;
  return false;
}
function pruneToOnly(nodes) {
  return nodes.filter(hasOnly).map(function (node) {
    if (node.only) return node;
    node.children = pruneToOnly(node.children);
    return node;
  });
}

function runAll() {
  if (rootTests.some(hasOnly)) rootTests = pruneToOnly(rootTests);
  var chain = runHooks(hooks.before, undefined);
  rootTests.forEach(function (node) {
    chain = chain.then(function () {
      return runNode(node, { before: hooks.beforeEach, after: hooks.afterEach });
    });
  });
  chain.then(function () {
    return runHooks(hooks.after, undefined);
  }).then(function () {
    console.log('# pass ' + passes);
    console.log('# fail ' + failures);
    if (skipped) console.log('# skipped ' + skipped);
    // The exit code is the only thing the harness reads, so a failed assertion
    // inside a test has to reach it.
    if (failures > 0) process.exit(1);
  }, function (e) {
    console.log('not ok - runner');
    console.log('  ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  });
}

test.skip = function (name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  a.options.skip = true;
  return test(a.name, a.options, a.fn);
};
test.todo = function (name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  a.options.todo = true;
  return test(a.name, a.options, a.fn);
};
// node runs ONLY the marked tests once anything in the file is marked, so this
// cannot be an alias for `test`: `only('x', ...)` in a file of ten tests runs
// one test under node and ran all ten here.
test.only = function (name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  a.options.only = true;
  return test(a.name, a.options, a.fn);
};
describe.skip = function (name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  a.options.skip = true;
  return describe(a.name, a.options, a.fn);
};
describe.only = function (name, options, fn) {
  var a = normalizeArgs(name, options, fn);
  a.options.only = true;
  return describe(a.name, a.options, a.fn);
};

exports.test = test;
exports.default = test;
exports.it = test;
exports.describe = describe;
exports.suite = describe;
exports.before = addHook('before');
exports.after = addHook('after');
exports.beforeEach = addHook('beforeEach');
exports.afterEach = addHook('afterEach');
exports.mock = mock;
exports.assert = testAssert;
// node's top-level only/skip/todo are the same shorthands already hanging off
// `test`, exported under their own names.
exports.only = test.only;
exports.skip = test.skip;
exports.todo = test.todo;
exports.run = function () { return Promise.resolve(); };
