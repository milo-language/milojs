// RegExp.prototype did not exist — the same shape of gap as the buffer family
// and Date. Instances carried `source`, `flags`, `global` and `lastIndex` and
// nothing else: .ignoreCase/.multiline/.sticky/.unicode/.dotAll/.hasIndices all
// read undefined, and `undefined` is not `false`.
//
// Three separate pre-existing bugs came out while building it:
//   * /ab/gi.toString() returned undefined — 'toString' was listed as a regex
//     method but regexMethod had no branch for it.
//   * RegExp.prototype.compile did not exist.
//   * String.prototype.match.call(s, /re/) returned undefined while
//     s.match(/re/) worked: the regex-taking String operations lived only on
//     evalExpr's method-call path, and callBuiltinByName goes straight to
//     stringMethod, which knows nothing about regexes. Both paths share one
//     implementation now.
//
// Each group is braced so its const bindings stay block-scoped.

{
  console.log('RegExp.prototype:', typeof RegExp.prototype);
  console.log('exec on proto:', typeof (RegExp.prototype && RegExp.prototype.exec));
  const r = /a(b)c/gi;
  console.log('proto identity:', Object.getPrototypeOf(r) === RegExp.prototype, r instanceof RegExp);
  console.log('own names on proto:', RegExp.prototype ? Object.getOwnPropertyNames(RegExp.prototype).length : 'n/a');
  console.log('flags:', r.flags, r.source, r.global, r.ignoreCase, r.multiline, r.sticky, r.unicode, r.dotAll, r.hasIndices);
  console.log('desc source:', JSON.stringify(Object.getOwnPropertyDescriptor(RegExp.prototype,'source')));
  console.log('exec:', JSON.stringify(r.exec('xabc')));
  console.log('Symbol.match/replace/split:', typeof RegExp.prototype[Symbol.match], typeof RegExp.prototype[Symbol.replace], typeof RegExp.prototype[Symbol.split]);
}

{
  const r = /a(b)c/g;
  console.log(RegExp.prototype[Symbol.match].call(r, 'xabcabc'));
  console.log(RegExp.prototype[Symbol.search].call(/b/, 'xabc'));
  console.log(RegExp.prototype[Symbol.split].call(/,/, 'a,b,c'));
  console.log(RegExp.prototype[Symbol.replace].call(/a/g, 'aaa', 'X'));
  console.log('str delegation:', 'xabc'.match(/a(b)c/)[1], 'a,b'.split(/,/).join('|'));
  console.log('flags on proto vs instance:', typeof Object.getOwnPropertyDescriptor(RegExp.prototype,'global').get, /x/g.global);
  console.log('lastIndex writable:', JSON.stringify(Object.getOwnPropertyDescriptor(/x/g,'lastIndex')));
  const q = /x/y;
  console.log(q.sticky, q.multiline, q.dotAll, q.hasIndices, q.unicode, q.ignoreCase);
  console.log('exec via proto:', JSON.stringify(RegExp.prototype.exec.call(/b/, 'abc')));
  console.log('test via proto:', RegExp.prototype.test.call(/b/, 'abc'));
  console.log('toString via proto:', RegExp.prototype.toString.call(/ab/gi));
  console.log('names:', JSON.stringify(Object.getOwnPropertyNames(RegExp.prototype).sort()));
}

{
  console.log('str.match direct:', JSON.stringify('xabc'.match(/a(b)c/)));
  console.log('String.prototype.match.call:', JSON.stringify(String.prototype.match.call('xabc', /a(b)c/)));
  console.log('regex toString direct:', /ab/gi.toString());
  console.log('String.prototype.split.call:', JSON.stringify(String.prototype.split.call('a,b', /,/)));
}

{
  console.log(/ab/gi.toString(), String(/x/), `${/y/g}`); const r=/a/; r.compile("b","g"); console.log(r.source, r.flags, r.global, r.test("bb"));
}
