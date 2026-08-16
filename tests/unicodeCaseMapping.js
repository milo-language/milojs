// toUpperCase/toLowerCase were ASCII + Latin-1 only, so every non-Latin script
// passed through unchanged ("привет".toUpperCase() answered itself). The tables
// in src/unicase.milo are generated from node's own ICU by tools/gen-unicase.mjs,
// so this walks every code point and reports what maps where, per 0x1000 block —
// a summary rather than 2981 raw lines, but derived from all of them.
var blocks = [];
for (var b = 0; b < 0x110; b++) blocks.push([0, 0, 0]);
for (var c = 0; c < 0x110000; c++) {
  if (c >= 0xD800 && c <= 0xDFFF) continue;
  var s = String.fromCodePoint(c);
  var u = s.toUpperCase(), l = s.toLowerCase();
  var e = blocks[c >> 12];
  if (u !== s) { e[0]++; if (u.length > s.length) e[2]++; }
  if (l !== s) e[1]++;
}
for (var i = 0; i < blocks.length; i++) {
  var e = blocks[i];
  if (e[0] || e[1]) console.log("U+" + (i << 12).toString(16) + " up=" + e[0] + " down=" + e[1] + " grow=" + e[2]);
}

// scripts the old ASCII-only mapping silently skipped
console.log("привет".toUpperCase(), "ПРИВЕТ".toLowerCase());
console.log("αβγδ".toUpperCase(), "ΑΒΓΔ".toLowerCase());
console.log("čšž".toUpperCase(), "ČŠŽ".toLowerCase());
console.log("ąćęłńóśźż".toUpperCase());
console.log("İıĞğŞş".toLowerCase());
console.log("ᏸᏹᏺ".toUpperCase(), "ⓐⓑⓒ".toUpperCase());

// mappings that grow the string
console.log("ß".toUpperCase(), "ﬁ".toUpperCase(), "ﬄ".toUpperCase());
console.log("ǰ".toUpperCase(), "ΐ".toUpperCase(), "ᾂ".toUpperCase());
console.log("straße".toUpperCase(), "ﬁn".toUpperCase());

// unchanged: digits, punctuation, CJK, emoji
console.log("123 -_= 漢字 😀".toUpperCase(), "123 -_= 漢字 😀".toLowerCase());
