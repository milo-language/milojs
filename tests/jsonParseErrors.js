// Malformed JSON throws SyntaxError. Silently returning a half-built object with
// NaN values is worse than failing: the caller's error path never runs.
const bad = ['{bad', 'nope', '[1,]', '{"a":1} x', '', '[1', '{"a"}', 'tru', '{"a":}', '[,]'];
console.log(bad.map((s) => {
  try { JSON.parse(s); return "no-throw"; } catch (e) { return e.name; }
}).join(","));
console.log(bad.map((s) => {
  try { JSON.parse(s); return false; } catch (e) { return e instanceof SyntaxError; }
}).join(","));

// valid input keeps parsing
const o = JSON.parse('{"a":[1,2,{"b":null}],"c":true,"d":"x\\ny"}');
console.log(JSON.stringify(o), o.a[2].b, o.c, o.d.length);
console.log(JSON.parse(" 42 "), JSON.parse('"s"'), JSON.parse("null"), JSON.parse("true"), JSON.parse("false"));
console.log(JSON.stringify(JSON.parse("[]")), JSON.stringify(JSON.parse("{}")));
