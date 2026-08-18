// RegExp.escape (ES2025) over the whole low range, diffed against node. milojs
// escaped the SyntaxCharacters and the control escapes but none of the ES2025
// "other punctuators" (and not the space), so 17 code points came out literal
// where they must be \xNN. A literal `-` is the dangerous one: spliced into a
// character class it reads as a range.
var escaped = [];
for (var c = 0; c < 0x300; c++) {
  var out = RegExp.escape("Z" + String.fromCharCode(c)).slice(4);
  if (out !== String.fromCharCode(c)) escaped.push(c + ":" + JSON.stringify(out));
}
console.log("escaped beyond literal:", escaped.length);
console.log(escaped.join(" "));

// The leading-character rule: a first char that is alphanumeric becomes hex.
console.log(JSON.stringify([
  RegExp.escape("abc"), RegExp.escape("0x"), RegExp.escape("_a"), RegExp.escape("")
]));

// Splicing safety: the escaped form must match the original literally.
var samples = ["a.b-c|d", "x^y$z", "[a-z]", "a b\tc", "'q\"r`s", "~@#%&,;:<=>!"];
console.log(samples.map(function (s) {
  return new RegExp(RegExp.escape(s)).test(s) && !/[^\\]-/.test(RegExp.escape(s).slice(1));
}).join(","));
