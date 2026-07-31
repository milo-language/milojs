// `raw` is the un-escaped source text of each chunk. The lexer expands escapes
// while cooking, so the raw text has to be carried separately.
console.log(String.raw`a\nb`);
console.log(String.raw`x${1}y\tz`);
console.log(String.raw`A \\ \``);
function tag(strings, ...values) {
  return strings.raw.join("|") + " // " + strings.join("|") + " // " + values.join(",");
}
console.log(tag`a\nb${1}c\td${2}`);
console.log(`a\nb`.length, String.raw`a\nb`.length);
console.log(Array.isArray(String.raw`x`.split("")), typeof String.raw`y`);
