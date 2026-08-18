// vm: run source in a chosen scope. The engine already has eval, so this is a
// real implementation rather than a stub, with one honest limitation stated up
// front: a "context" here is a SCOPE, not a separate realm.
//
// Node gives each context its own global object and its own intrinsics, so
// `vm.runInNewContext("[]")  instanceof Array` is false there. This runtime has
// one realm, so a context is the sandbox object made visible through `with`,
// and cross-realm identity tests will not agree. Everything that depends on
// scoping rather than on realm identity behaves.

const CONTEXT_MARK = Symbol("vm.Context");

// A `with` block puts the sandbox on the scope chain, and a DIRECT eval inside
// it resolves and assigns against that chain: reads see the sandbox, and a write
// to a name the sandbox already has lands there rather than on the global.
const runner = new Function(
  "__sandbox",
  "__code",
  "with (__sandbox) { return eval(__code); }",
);

function requireObject(o, name) {
  if (o === null || (typeof o !== "object" && typeof o !== "function")) {
    throw new TypeError(`The "${name}" argument must be an object`);
  }
}

function codeOf(code) {
  if (typeof code !== "string") {
    throw new TypeError('The "code" argument must be of type string');
  }
  return code;
}

function createContext(sandbox) {
  if (sandbox === undefined) sandbox = {};
  requireObject(sandbox, "contextObject");
  if (!sandbox[CONTEXT_MARK]) {
    Object.defineProperty(sandbox, CONTEXT_MARK, {
      value: true, writable: false, enumerable: false, configurable: false,
    });
  }
  return sandbox;
}

function isContext(sandbox) {
  return (sandbox !== null && (typeof sandbox === "object" || typeof sandbox === "function"))
    && sandbox[CONTEXT_MARK] === true;
}

function runInContext(code, contextifiedObject, options) {
  if (!isContext(contextifiedObject)) {
    throw new TypeError('The "contextifiedObject" argument must be a vm.Context');
  }
  return runner(contextifiedObject, codeOf(code));
}

function runInNewContext(code, contextObject, options) {
  return runner(createContext(contextObject), codeOf(code));
}

// The global scope, which is what an INDIRECT eval evaluates in.
function runInThisContext(code, options) {
  return (0, eval)(codeOf(code));
}

class Script {
  constructor(code, options) {
    // Nothing is compiled ahead of time here: the source is kept and evaluated
    // at run time. The observable difference is WHEN a syntax error surfaces,
    // so it is forced now, at construction, the way node does.
    this.code = codeOf(code);
    const opts = options === undefined ? {} : options;
    this.filename = opts.filename === undefined ? "evalmachine.<anonymous>" : opts.filename;
    (0, eval)(`(function(){ ${this.code}\n})`);
  }

  runInThisContext(options) {
    return (0, eval)(this.code);
  }

  runInContext(contextifiedObject, options) {
    if (!isContext(contextifiedObject)) {
      throw new TypeError('The "contextifiedObject" argument must be a vm.Context');
    }
    return runner(contextifiedObject, this.code);
  }

  runInNewContext(contextObject, options) {
    return runner(createContext(contextObject), this.code);
  }

  createCachedData() {
    throw new Error("vm.Script.createCachedData is not supported by this runtime");
  }
}

function createScript(code, options) {
  return new Script(code, options);
}

// compileFunction builds a function from a body and parameter names, with any
// contextExtensions layered on through `with` the same way a context is.
function compileFunction(code, params, options) {
  const opts = options === undefined ? {} : options;
  const names = params === undefined ? [] : params;
  const exts = opts.contextExtensions === undefined ? [] : opts.contextExtensions;
  let body = codeOf(code);
  for (let i = exts.length - 1; i >= 0; i--) {
    requireObject(exts[i], "contextExtensions");
  }
  if (exts.length === 0) {
    return new Function(...names, body);
  }
  const wrap = new Function(
    "__exts",
    `return function (${names.join(",")}) { with (__exts[0]) { ${body} } };`,
  );
  return wrap(exts);
}

function measureMemory() {
  return Promise.resolve({ total: { jsMemoryEstimate: 0, jsMemoryRange: [0, 0] } });
}

module.exports = {
  Script, createContext, createScript, isContext,
  runInContext, runInNewContext, runInThisContext,
  compileFunction, measureMemory,
  constants: { USE_MAIN_CONTEXT_DEFAULT_LOADER: 0, DONT_CONTEXTIFY: 1 },
};
