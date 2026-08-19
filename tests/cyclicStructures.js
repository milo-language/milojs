// Operations that recurse over user data must survive a cycle. Three bugs of this
// shape were fixed separately (Array.join, JSON.stringify, and the parser's
// expression nesting); this is the sweep that looked for the rest of the class.
//
// `flat` was the one still broken: its requested depth is capped at a million,
// which is fine as a NUMBER but not as native recursion, so a cyclic array blew
// the stack and the process exited 0 having printed nothing. node has no cycle
// check either -- it hits its own stack limit and raises a catchable RangeError,
// which is what the depth bound now reproduces.
function t(n, f) { try { var r = f(); console.log(n, "OK", String(r).slice(0, 40)); } catch (e) { console.log(n, "ERR", e.constructor.name); } }
function selfObj() { var a = { x: 1 }; a.self = a; return a; }
function selfArr() { var a = [1]; a.push(a); return a; }
function pair() { var a = {}, b = { a: a }; a.b = b; return a; }

t("flat-cyclic", () => selfArr().flat(Infinity).length);
t("flat-normal", () => [1, [2, [3, [4]]]].flat(Infinity).join(","));
t("flat-depth1", () => [1, [2, [3]]].flat().length);
t("join-cyclic", () => selfArr().join("-"));
t("join-indirect", () => { var a = [1], b = [a]; a.push(b); return a.join("-"); });
t("String-cyclic", () => String(selfArr()));
t("json-cyclic", () => JSON.stringify(selfObj()));
t("json-indirect", () => JSON.stringify(pair()));
t("concat-cyclic", () => [].concat(selfArr()).length);
t("includes-cyclic", () => selfArr().includes(1));
t("sort-cyclic", () => selfArr().slice().sort().length);
t("assign-cyclic", () => Object.keys(Object.assign({}, selfObj())).length);
t("spread-cyclic", () => Object.keys({ ...selfObj() }).length);
t("map-cyclic", () => { var m = new Map(); m.set("k", m); return m.size; });
t("set-cyclic", () => { var s = new Set(); s.add(s); return s.size; });
t("keys-cyclic", () => Object.keys(selfObj()).join(","));
