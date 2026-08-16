// An Error's .stack was the header line alone ("Error: boom") with no frames,
// and a subclass instance had NO stack at all, which is the one thing a caller
// reaches for when logging a custom error.
//
// Frames name the source FILE of each function on the call stack. No line or
// column: this engine records no per-frame position, and ":0:0" would be fake
// precision a reader would try to use. Paths stay repo-relative so this fixture
// is not machine-specific.
function p(n, f) { try { console.log(n, String(f())); } catch (e) { console.log(n, "THREW " + e.name); } }

const head = s => String(s).split("\n")[0];
const frames = s => String(s).split("\n").length - 1;

p("stack is a string", () => typeof new Error("boom").stack);
p("header", () => head(new Error("boom").stack));
p("has frames", () => frames(new Error("boom").stack) > 0);
p("no-message header", () => head(new Error().stack));

function inner() { return new Error("deep"); }
function outer() { return inner(); }
p("nested has more frames", () => frames(outer().stack) >= frames(new Error("x").stack));

p("thrown runtime error", () => { try { null.x; } catch (e) { return typeof e.stack; } });
p("thrown header", () => { try { null.x; } catch (e) { return head(e.stack).split(":")[0]; } });

class E extends Error {}
class F extends Error { constructor(m) { super(m); } }
p("subclass default ctor", () => typeof new E("m").stack);
p("subclass explicit ctor", () => typeof new F("m").stack);
p("subclass header", () => head(new F("m").stack));
p("subclass message", () => new E("m").message);
p("subclass instanceof", () => [new E("m") instanceof Error, new E("m") instanceof E].join(","));

p("stack is own property", () => Object.prototype.hasOwnProperty.call(new Error("x"), "stack"));
p("stack not enumerable", () => Object.keys(new Error("x")).includes("stack"));
p("error.toString unaffected", () => String(new Error("boom")));
p("cause still works", () => String(new Error("m", { cause: "c" }).cause));
