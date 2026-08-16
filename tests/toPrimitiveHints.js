// ToPrimitive/ToString had three holes that all showed up as "[object …]" in
// ordinary string building. Assertions about a Date are written as IDENTITIES
// (String(d) === d.toString()) rather than literal date text, so the fixture
// says nothing about the host timezone.
function p(n, f) { try { console.log(n, String(f())); } catch (e) { console.log(n, "THREW " + (e && e.constructor ? e.constructor.name : String(e))); } }

const d = new Date(Date.UTC(2026, 7, 15, 12, 0, 0));

// Date.prototype.toString/valueOf were excluded from date dispatch, so every
// generic conversion fell through to the object tag
p("String(d) is toString", () => String(d) === d.toString());
p("d+'' is toString", () => (d + "") === d.toString());
p("[d].join is toString", () => [d].join("") === d.toString());
p("`${d}` is toString", () => `${d}` === d.toString());
p("'x'.concat(d)", () => "x".concat(d) === "x" + d.toString());
p("valueOf is getTime", () => d.valueOf() === d.getTime() && d.valueOf.call(d) === d.getTime());
p("+d is a number", () => typeof (+d) === "number" && +d === 1786795200000);
p("toString.call(d)", () => Object.prototype.toString.call(d));

// Object.prototype.toString/valueOf were unreachable from an ordinary object
p("typeof {}.toString", () => typeof ({}).toString);
p("typeof {}.valueOf", () => typeof ({}).valueOf);
p("class inst toString", () => { class C {} return typeof (new C()).toString; });
p("{}.toString()", () => ({}).toString());
p("{}.valueOf() is self", () => { const o = {}; return o.valueOf() === o; });

// the STRING hint reaches toString FIRST, so a valueOf-only object is the tag
p("String(valueOf-only)", () => String({ valueOf() { return 5; } }));
p("`${valueOf-only}`", () => `${{ valueOf() { return 5; } }}`);
p("+ takes valueOf", () => "" + { valueOf() { return 5; } });
p("both, string hint", () => String({ valueOf() { return "V"; }, toString() { return "T"; } }));
p("both, template", () => `${{ valueOf() { return "V"; }, toString() { return "T"; } }}`);
p("both, plus", () => "" + { valueOf() { return "V"; }, toString() { return "T"; } });

// a template literal passes the "string" hint, not "default"
p("Symbol.toPrimitive template", () => `${{ [Symbol.toPrimitive](h) { return "hint:" + h; } }}`);
p("Symbol.toPrimitive plus", () => "" + { [Symbol.toPrimitive](h) { return "hint:" + h; } });
p("Symbol.toPrimitive String", () => String({ [Symbol.toPrimitive](h) { return "hint:" + h; } }));

// a symbol in a template hole throws where String(sym) does not
p("`${sym}`", () => `${Symbol("s")}`);
p("String(sym)", () => String(Symbol("s")));

// concat converts every argument, not just strings
p("concat obj", () => "x".concat({ toString() { return "T"; } }));
p("concat array", () => "x".concat([1, 2]));
p("concat number", () => "x".concat(1, true, null));

// unchanged neighbours
p("String(err)", () => String(new Error("m")));
p("String(re)", () => String(/ab/g));
p("String([1,2])", () => String([1, 2]));
p("String(new Number(5))", () => String(new Number(5)));
