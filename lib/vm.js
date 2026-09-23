// vm: a context is a realm. createContext(sandbox) asks the engine for a new
// realm (its own intrinsics and global scope) whose SANDBOX is that object: the
// realm's global names resolve against it first, and its top-level var and
// function declarations and undeclared assignments land on it (see
// identTryLookup in src/engine/realm.milo). `vm.runInNewContext("[]") instanceof
// Array` is false here as in node, and an error a context throws is made from
// that context's constructors.
//
// What the engine does not do is make the sandbox the realm's `globalThis`:
// node's global object inside a context is a proxy that forwards to the
// sandbox, with the realm's built-ins behind it, and so is this one (see
// globalProxyFor). The engine realm's own global object sits behind it.
//
// Not implemented: `timeout` and `breakOnSigint` are validated and then not
// enforced (the evaluator has no interrupt), `microtaskMode: "afterEvaluate"`
// shares the one job queue, and stack traces carry the filename but no line or
// column, since the engine records none.

const errors = require('_errors');

const DONT_CONTEXTIFY = Symbol('vm_context_no_contextify');

// The main realm's global object: runInThisContext evaluates there. Captured
// now, because the program can rebind `globalThis`.
const mainGlobal = globalThis;

// contextified object -> { realm: the engine realm's own global object,
//                          global: what `globalThis` is inside }
const contexts = new WeakMap();

function invalidArgType(name, expected, actual) {
  return errors.ERR_INVALID_ARG_TYPE(name, expected, actual);
}

function isObjectLike(v) {
  return v !== null && (typeof v === 'object' || typeof v === 'function');
}

function validateString(v, name) {
  if (typeof v !== 'string') throw invalidArgType(name, 'string', v);
}

function validateOptionsObject(options, name) {
  if (options === null || typeof options !== 'object') {
    throw invalidArgType(name || 'options', 'object', options);
  }
}

function validateInt32(v, name) {
  if (typeof v !== 'number') throw errors.ERR_INVALID_ARG_TYPE_PROP(name, 'number', v);
  if (!Number.isInteger(v)) throw errors.ERR_OUT_OF_RANGE(name, 'an integer', v);
  if (v < -2147483648 || v > 2147483647) {
    throw errors.ERR_OUT_OF_RANGE(name, '>= -2147483648 && <= 2147483647', v);
  }
}

function validateBooleanProp(v, name) {
  if (typeof v !== 'boolean') throw errors.ERR_INVALID_ARG_TYPE_PROP(name, 'boolean', v);
}

function validateStringProp(v, name) {
  if (typeof v !== 'string') throw errors.ERR_INVALID_ARG_TYPE_PROP(name, 'string', v);
}

function isArrayBufferView(v) {
  return ArrayBuffer.isView(v);
}

// The run options every run* entry point takes: an object whose timeout /
// displayErrors / breakOnSigint are checked as node checks them, or, for the
// module-level functions only, a filename string.
function runOptions(options, allowFilename) {
  if (allowFilename && typeof options === 'string') return { filename: options };
  if (options === undefined) return {};
  validateOptionsObject(options);
  if (options.timeout !== undefined) {
    if (typeof options.timeout !== 'number') {
      throw errors.ERR_INVALID_ARG_TYPE_PROP('options.timeout', 'number', options.timeout);
    }
    if (!Number.isInteger(options.timeout) || options.timeout <= 0 || options.timeout > 4294967295) {
      throw errors.ERR_OUT_OF_RANGE('options.timeout', '>= 1 && <= 4294967295', options.timeout);
    }
  }
  if (options.displayErrors !== undefined) validateBooleanProp(options.displayErrors, 'options.displayErrors');
  if (options.breakOnSigint !== undefined) validateBooleanProp(options.breakOnSigint, 'options.breakOnSigint');
  if (options.filename !== undefined) validateStringProp(options.filename, 'options.filename');
  return options;
}

// The global object code inside a context sees: node's contextified global,
// which reads the sandbox first and the realm's own global second, and writes,
// defines and deletes on the sandbox. A Proxy, so every property path in the
// engine (a getter, a proxy sandbox's traps, Object.defineProperty on
// `this`) reaches the sandbox the way it does in node.
//
// The target only answers the proxy invariants: a property reported as
// non-configurable has to exist, non-configurable, on the target, so each one
// is copied there as it is reported.
function globalProxyFor(sandbox, realm) {
  const target = {};
  let proxy;
  function pin(key, desc) {
    if (desc !== undefined && !desc.configurable) {
      const had = Reflect.getOwnPropertyDescriptor(target, key);
      if (had === undefined || had.writable !== desc.writable || had.value !== desc.value ||
          had.get !== desc.get || had.set !== desc.set) {
        Reflect.defineProperty(target, key, desc);
      }
    }
    return desc;
  }
  proxy = new Proxy(target, {
    get(_t, key) {
      const v = key in sandbox ? Reflect.get(sandbox, key) : Reflect.get(realm, key);
      return v === sandbox ? proxy : v;
    },
    set(_t, key, value) {
      return Reflect.set(sandbox, key, value);
    },
    // the sandbox's OWN properties only: node's global is not on the sandbox's
    // prototype chain, so `in` never sees what the sandbox inherits (a read
    // does, above)
    has(_t, key) {
      return Object.prototype.hasOwnProperty.call(sandbox, key) || key in realm;
    },
    deleteProperty(_t, key) {
      return Reflect.deleteProperty(sandbox, key);
    },
    defineProperty(_t, key, desc) {
      // Object.defineProperty, not Reflect: a refused definition throws the
      // "Cannot redefine property" TypeError node's context throws
      Object.defineProperty(sandbox, key, desc);
      pin(key, Reflect.getOwnPropertyDescriptor(sandbox, key));
      return true;
    },
    getOwnPropertyDescriptor(_t, key) {
      let desc = Reflect.getOwnPropertyDescriptor(sandbox, key);
      if (desc === undefined) desc = Reflect.getOwnPropertyDescriptor(realm, key);
      return pin(key, desc);
    },
    ownKeys() {
      const out = [];
      const seen = new Set();
      const add = (keys, wantSymbols) => {
        for (const k of keys) {
          if ((typeof k === 'symbol') === wantSymbols && !seen.has(k)) {
            seen.add(k);
            out.push(k);
          }
        }
      };
      const realmKeys = Reflect.ownKeys(realm);
      const sandboxKeys = Reflect.ownKeys(sandbox);
      add(realmKeys, false);
      add(sandboxKeys, false);
      add(realmKeys, true);
      add(sandboxKeys, true);
      for (const k of Reflect.ownKeys(target)) {
        if (!seen.has(k)) out.push(k);
      }
      return out;
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(realm);
    },
    setPrototypeOf(_t, proto) {
      return Reflect.setPrototypeOf(realm, proto);
    },
  });
  return proxy;
}

function createContext(contextObject, options) {
  if (contextObject === undefined) contextObject = {};
  if (options !== undefined) {
    validateOptionsObject(options);
    if (options.name !== undefined) validateStringProp(options.name, 'options.name');
    if (options.origin !== undefined) validateStringProp(options.origin, 'options.origin');
    if (options.codeGeneration !== undefined) validateOptionsObject(options.codeGeneration, 'options.codeGeneration');
    if (options.microtaskMode !== undefined && options.microtaskMode !== 'afterEvaluate') {
      throw errors.ERR_INVALID_ARG_VALUE_PROP('options.microtaskMode', options.microtaskMode);
    }
  }
  if (contextObject === DONT_CONTEXTIFY) {
    // a vanilla context: the realm's own global object, no sandbox in front
    const realm = __realmCreate();
    contexts.set(realm, { realm, global: realm });
    return realm;
  }
  if (!isObjectLike(contextObject)) {
    throw invalidArgType('contextObject', 'object', contextObject);
  }
  if (contexts.has(contextObject)) return contextObject;
  const realm = __realmCreate(contextObject);
  const global = globalProxyFor(contextObject, realm);
  // the realm's `globalThis`, and so the `this` of its top-level code and of
  // its sloppy functions called bare
  realm.globalThis = global;
  contexts.set(contextObject, { realm, global });
  return contextObject;
}

function isContext(object) {
  if (!isObjectLike(object)) throw invalidArgType('object', 'object', object);
  return contexts.has(object);
}

function contextOf(contextifiedObject) {
  if (!isObjectLike(contextifiedObject)) {
    throw invalidArgType('contextifiedObject', 'object', contextifiedObject);
  }
  const info = contexts.get(contextifiedObject);
  if (info === undefined) {
    throw errors.codedError(TypeError, 'ERR_INVALID_ARG_TYPE',
      'The "contextifiedObject" argument must be an vm.Context.' +
      ' Received an instance of ' + ((contextifiedObject.constructor && contextifiedObject.constructor.name) || 'Object'));
  }
  return info;
}

// ScriptEvaluation of `code` in the realm owning `realmGlobal`.
function evaluate(code, realmGlobal, opts) {
  return __realmEval(realmGlobal, code, opts.filename === undefined ? 'evalmachine.<anonymous>' : opts.filename);
}

// Node parses a Script when it is constructed, so a syntax error surfaces
// there rather than at the first run. The body is compiled as a function and
// never called; a top-level `return`, which a function accepts and a script
// does not, is the one shape this lets through.
function checkSyntax(code) {
  (0, eval)('(function(){' + code + '\n})');
}

// The produced "cached data" is the source itself, tagged: nothing is cached,
// but a Script handed another script's data can still say it was rejected.
const CACHE_TAG = 'milojs-vm-cache:';

function cachedDataFor(code) {
  return Buffer.from(CACHE_TAG + code);
}

function cachedDataMatches(data, code) {
  const expected = cachedDataFor(code);
  if (data.byteLength !== expected.length) return false;
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < expected.length; i++) if (bytes[i] !== expected[i]) return false;
  return true;
}

const SOURCE_MAP_URL = /\/[*/][#@]\s*sourceMappingURL=([^\s'"*]+)\s*(?:\*\/\s*)?$/;

function sourceMapUrlOf(code) {
  const lines = code.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '') continue;
    const m = SOURCE_MAP_URL.exec(line);
    return m === null ? undefined : m[1];
  }
  return undefined;
}

class Script {
  constructor(code, options) {
    code = `${code}`;
    if (typeof options === 'string') options = { filename: options };
    if (options === undefined) options = {};
    validateOptionsObject(options);
    const {
      filename = 'evalmachine.<anonymous>',
      lineOffset = 0,
      columnOffset = 0,
      cachedData,
      produceCachedData = false,
    } = options;
    validateStringProp(filename, 'options.filename');
    validateInt32(lineOffset, 'options.lineOffset');
    validateInt32(columnOffset, 'options.columnOffset');
    if (cachedData !== undefined && !isArrayBufferView(cachedData)) {
      throw errors.ERR_INVALID_ARG_TYPE_PROP('options.cachedData', ['Buffer', 'TypedArray', 'DataView'], cachedData);
    }
    validateBooleanProp(produceCachedData, 'options.produceCachedData');
    checkSyntax(code);
    this.code = code;
    this.filename = filename;
    if (cachedData !== undefined) this.cachedDataRejected = !cachedDataMatches(cachedData, code);
    if (produceCachedData) {
      this.cachedData = cachedDataFor(code);
      this.cachedDataProduced = true;
    }
    this.sourceMapURL = sourceMapUrlOf(code);
  }

  runInThisContext(options) {
    const opts = runOptions(options, false);
    return evaluate(this.code, mainGlobal, { filename: opts.filename || this.filename });
  }

  runInContext(contextifiedObject, options) {
    const info = contextOf(contextifiedObject);
    const opts = runOptions(options, false);
    return evaluate(this.code, info.realm, { filename: opts.filename || this.filename });
  }

  runInNewContext(contextObject, options) {
    const opts = runOptions(options, false);
    const context = createContext(contextObject, contextOptions(opts));
    return this.runInContext(context, opts);
  }

  createCachedData() {
    return cachedDataFor(this.code);
  }
}

// runInNewContext's options name the new context's options with a prefix.
function contextOptions(opts) {
  const out = {};
  if (opts.contextName !== undefined) {
    validateStringProp(opts.contextName, 'options.contextName');
    out.name = opts.contextName;
  }
  if (opts.contextOrigin !== undefined) {
    validateStringProp(opts.contextOrigin, 'options.contextOrigin');
    out.origin = opts.contextOrigin;
  }
  if (opts.contextCodeGeneration !== undefined) out.codeGeneration = opts.contextCodeGeneration;
  if (opts.microtaskMode !== undefined) out.microtaskMode = opts.microtaskMode;
  return out;
}

function createScript(code, options) {
  return new Script(code, options);
}

function runInContext(code, contextifiedObject, options) {
  const info = contextOf(contextifiedObject);
  validateString(code, 'code');
  return evaluate(code, info.realm, runOptions(options, true));
}

function runInNewContext(code, contextObject, options) {
  validateString(code, 'code');
  const opts = runOptions(options, true);
  const context = createContext(contextObject, contextOptions(opts));
  return evaluate(code, contexts.get(context).realm, opts);
}

function runInThisContext(code, options) {
  validateString(code, 'code');
  return evaluate(code, mainGlobal, runOptions(options, true));
}

// compileFunction: a function whose body is `code`, created in the realm of
// `parsingContext` (the main realm by default), with each of
// `contextExtensions` in scope around it the way `with` puts an object there.
function compileFunction(code, params, options) {
  validateString(code, 'code');
  if (params !== undefined && !Array.isArray(params)) {
    throw invalidArgType('params', 'Array', params);
  }
  if (options === undefined) options = {};
  validateOptionsObject(options);
  const {
    filename = '',
    columnOffset = 0,
    lineOffset = 0,
    cachedData,
    produceCachedData = false,
    parsingContext,
    contextExtensions = [],
  } = options;
  validateStringProp(filename, 'options.filename');
  if (typeof columnOffset !== 'number') throw errors.ERR_INVALID_ARG_TYPE_PROP('options.columnOffset', 'number', columnOffset);
  if (typeof lineOffset !== 'number') throw errors.ERR_INVALID_ARG_TYPE_PROP('options.lineOffset', 'number', lineOffset);
  if (cachedData !== undefined && !isArrayBufferView(cachedData)) {
    throw errors.ERR_INVALID_ARG_TYPE_PROP('options.cachedData', ['Buffer', 'TypedArray', 'DataView'], cachedData);
  }
  validateBooleanProp(produceCachedData, 'options.produceCachedData');
  let realm = mainGlobal;
  if (parsingContext !== undefined) {
    const info = isObjectLike(parsingContext) ? contexts.get(parsingContext) : undefined;
    if (info === undefined) {
      throw errors.ERR_INVALID_ARG_TYPE_PROP('options.parsingContext', 'Context', parsingContext);
    }
    realm = info.realm;
  }
  if (!Array.isArray(contextExtensions)) {
    throw errors.ERR_INVALID_ARG_TYPE_PROP('options.contextExtensions', 'Array', contextExtensions);
  }
  contextExtensions.forEach((ext, i) => {
    if (!isObjectLike(ext)) {
      throw errors.ERR_INVALID_ARG_TYPE_PROP(`options.contextExtensions[${i}]`, 'object', ext);
    }
  });
  const names = params === undefined ? [] : params;
  names.forEach((p, i) => validateString(p, `params[${i}]`));
  // the function's own text is exactly node's: `function (a, b) {\n<code>\n}`
  const fnText = `function (${names.join(', ')}) {\n${code}\n}`;
  let fn;
  if (contextExtensions.length === 0) {
    fn = __realmEval(realm, `(${fnText})`, filename || 'evalmachine.<anonymous>');
  } else {
    let src = `return ${fnText};`;
    for (let i = contextExtensions.length - 1; i >= 0; i--) src = `with (__mjExts[${i}]) { ${src} }`;
    const make = __realmEval(realm, `(function (__mjExts) { ${src} })`, filename || 'evalmachine.<anonymous>');
    fn = make(contextExtensions);
  }
  if (cachedData !== undefined) fn.cachedDataRejected = !cachedDataMatches(cachedData, code);
  if (produceCachedData) {
    fn.cachedDataProduced = true;
    fn.cachedData = cachedDataFor(code);
  }
  return fn;
}

function measureMemory(options) {
  if (options === undefined) options = {};
  validateOptionsObject(options);
  const { mode = 'summary', execution = 'default' } = options;
  if (mode !== 'summary' && mode !== 'detailed') {
    throw errors.ERR_INVALID_ARG_VALUE_PROP('options.mode', mode);
  }
  if (execution !== 'default' && execution !== 'eager') {
    throw errors.ERR_INVALID_ARG_VALUE_PROP('options.execution', execution);
  }
  const estimate = { jsMemoryEstimate: 0, jsMemoryRange: [0, 0] };
  const result = { total: estimate };
  if (mode === 'detailed') {
    result.current = { jsMemoryEstimate: 0, jsMemoryRange: [0, 0] };
    result.other = [];
  }
  return Promise.resolve(result);
}

module.exports = {
  Script, createContext, createScript, isContext,
  runInContext, runInNewContext, runInThisContext,
  compileFunction, measureMemory,
  constants: Object.assign(Object.create(null), {
    USE_MAIN_CONTEXT_DEFAULT_LOADER: Symbol('vm_dynamic_import_main_context_default'),
    DONT_CONTEXTIFY,
  }),
};
