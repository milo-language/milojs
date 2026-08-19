// The RegExp flag accessors are generic in the spec: `flags` reads its answer
// off whatever object it is handed, and %RegExp.prototype% has defined answers
// of its own rather than being an incompatible receiver. Every es-shim package
// reads these off the prototype to feature-detect the engine.
const names = ['flags', 'source', 'global', 'ignoreCase', 'multiline', 'dotAll',
               'sticky', 'unicode', 'hasIndices', 'unicodeSets'];
for (const n of names) {
  const d = Object.getOwnPropertyDescriptor(RegExp.prototype, n);
  let onProto, onPlain, onPrimitive;
  try { onProto = JSON.stringify(d.get.call(RegExp.prototype)); } catch (e) { onProto = 'throws ' + e.constructor.name; }
  try { onPlain = JSON.stringify(d.get.call({ global: true, dotAll: true })); } catch (e) { onPlain = 'throws ' + e.constructor.name; }
  try { onPrimitive = JSON.stringify(d.get.call(1)); } catch (e) { onPrimitive = 'throws ' + e.constructor.name; }
  console.log(n, onProto, onPlain, onPrimitive);
}
console.log(/ab/gi.flags, /ab/gi.source, /ab/gi.global, /ab/gi.sticky);

// Only Number.prototype.toString takes a radix; every other primitive ignores
// the argument entirely.
console.log('abc'.toString(1), true.toString(1), (255).toString(16), (new Number(255)).toString(16));
try { (255).toString(1); } catch (e) { console.log(e.constructor.name, e.message); }
try { (255).toString(null); } catch (e) { console.log(e.constructor.name, e.message); }
