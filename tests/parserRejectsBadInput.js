// The parser used to ACCEPT input that is not a program. parsePrimary swallowed
// any token that cannot start an expression and answered `undefined`, and
// atStatementEnd treats EOF as a legal ending, so a truncated expression ran off
// the end without complaint. Six of ten malformed sources parsed clean.
//
// eval is the only place a fixture can observe this, since a bad source file is
// reported and skipped rather than turned into a catchable error.
for (const src of ["var =", "1 +", "function(", "}", "let 1 = 2", "if (",
                   "a b c", "class", "return 1", "()=>", "[1,", "({",
                   "x ===", "foo(", "var a = ;"]) {
  let r;
  try { eval(src); r = "accepted"; } catch (e) { r = e.name; }
  console.log(JSON.stringify(src), r);
}

// and it still accepts everything that IS a program
for (const src of ["1 + 1", "var ok = 1", "function f(){ return 2 }", "({a:1}).a",
                   "[1,2].length", "(() => 3)()", "class C { m(){ return 4 } }",
                   "`t${1}`", "/re/.test('re')", "if (true) { 5 }", "l: for(;;){ break l }"]) {
  let r;
  try { eval(src); r = "ok"; } catch (e) { r = "THREW " + e.name; }
  console.log(JSON.stringify(src), r);
}

// ASI after return/break/continue. proxy-addr (an express dependency) writes
//     if (!trust(addrs[i], i)) continue
//     addrs.length = i + 1
// and the label parser took `addrs` as the label, mangling the function body.
function r1() { return
  42; }
console.log("return ASI:", r1());
let n = 0;
for (let i = 0; i < 3; i++) { if (i === 1) continue
  n++; }
console.log("continue ASI:", n);
let b = 0;
for (let i = 0; i < 3; i++) { if (i === 1) break
  b++; }
console.log("break ASI:", b);
outer: for (let i = 0; i < 2; i++) { for (let j = 0; j < 3; j++) { if (j === 1) continue outer; } }
console.log("labelled continue on one line still works");

// contextual keywords remain readable as identifiers in expression position
console.log("typeof:", typeof async, typeof undefined);
