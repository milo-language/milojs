// Module code is STRICT code — the spec makes it so with no directive — and
// milojs ran every module sloppy. Four separate behaviours came from that one
// fact, and every QuickJS test file is a module, so its whole suite ran sloppy.
"use strict";
const a = { x: 1 };
Object.preventExtensions(a);
let threw = false;
try { a.y = 2; } catch (e) { threw = e instanceof TypeError; }
console.log("non-extensible write throws:", threw, "| y:", typeof a.y);

const frozen = Object.freeze({ p: 1 });
let threw2 = false;
try { frozen.p = 9; } catch (e) { threw2 = e instanceof TypeError; }
console.log("frozen write throws:", threw2, "| p:", frozen.p);

function bare() { return this; }
console.log("bare call this:", bare());

let threw3 = false;
try { (0, eval)("'use strict'; notDeclaredAnywhere = 1;"); } catch (e) { threw3 = e instanceof ReferenceError; }
console.log("undeclared assignment throws:", threw3);

// %Object.prototype% is an immutable prototype exotic object: null is the only
// prototype it will accept, and anything else is a TypeError rather than a
// silent no-op.
try { Object.setPrototypeOf(Object.prototype, {}); console.log("Object.prototype: NO THROW"); }
catch (e) { console.log("Object.prototype setProto:", e.constructor.name); }
console.log("null is accepted:", Object.setPrototypeOf(Object.prototype, null) === Object.prototype);

// so is a non-extensible object's
const sealed = Object.preventExtensions({});
try { Object.setPrototypeOf(sealed, { a: 1 }); console.log("non-extensible: NO THROW"); }
catch (e) { console.log("non-extensible setProto:", e.constructor.name); }
const plain = {};
Object.setPrototypeOf(plain, { inherited: 7 });
console.log("ordinary setProto still works:", plain.inherited);
