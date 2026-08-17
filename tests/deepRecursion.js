// Recursion depth is bounded by native stack, not by a fixed frame count. The
// guard used to be a hardcoded 104 frames, which is two orders of magnitude
// below node and killed any recursive JS algorithm (tape's nested subtests, deep
// tree walks). What matters for a fixture is the two properties that must hold on
// any stack size: recursion well past the old cap works, and blowing the stack
// raises a catchable RangeError rather than killing the process.
let depth = 0;
function down() { depth++; down(); }
try { down(); } catch (e) {
  console.log("caught:", e instanceof RangeError, e.message);
}
console.log("past 1000 frames:", depth > 1000);

// unwinding leaves the interpreter usable
let d2 = 0;
function again() { d2++; again(); }
try { again(); } catch (e) { console.log("second overflow also caught:", e instanceof RangeError); }
console.log("still running:", [1, 2, 3].map((x) => x * 2).join(","));

// a non-iterable in for-of throws a real TypeError, not a bare string. Every
// assert.throws(TypeError, ...) around a for-of depends on this.
// milojs appends " (in <file>)" to engine-raised messages, so compare the part
// that is specification text.
const msg = (e) => String(e.message).split(" (in ")[0];
try { for (const x of /a/g) console.log(x); } catch (e) {
  console.log("for-of:", e instanceof TypeError, e.constructor.name, msg(e));
}
try { for (const x of {}) console.log(x); } catch (e) {
  console.log("for-of obj:", e instanceof TypeError, msg(e));
}
try { Object.fromEntries(5); } catch (e) {
  console.log("fromEntries:", e instanceof TypeError);
}
