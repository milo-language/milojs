// annexB's String HTML methods and the trimLeft/trimRight aliases. The aliases
// are the SAME function objects as trimStart/trimEnd, which is observable.
const s = "hi";
console.log(s.anchor('a"b'), s.big(), s.blink(), s.bold(), s.fixed());
console.log(s.fontcolor("red"), s.fontsize(3), s.italics(), s.link("u\"v"));
console.log(s.small(), s.strike(), s.sub(), s.sup());
console.log("[" + "  x  ".trimLeft() + "]", "[" + "  x  ".trimRight() + "]");
console.log(String.prototype.trimLeft === String.prototype.trimStart, String.prototype.trimRight === String.prototype.trimEnd);
for (const m of ["anchor", "big", "fontcolor", "link", "small"]) console.log(m, String.prototype[m].length, String.prototype[m].name);

// Function.prototype is a function of no name and no arguments, and owns both
console.log(Object.prototype.hasOwnProperty.call(Function.prototype, "name"), JSON.stringify(Function.prototype.name), Function.prototype.length);
function f(a, b) {}
delete f.name;
console.log(JSON.stringify(f.name), Object.prototype.hasOwnProperty.call(f, "name"));
