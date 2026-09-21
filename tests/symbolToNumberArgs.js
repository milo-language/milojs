// ToNumber(Symbol) and ToString(Symbol) in an argument position are TypeErrors,
// and a valueOf/toString on an object argument runs, for the builtins that
// coerce natively: Math.*, isNaN/isFinite, Date setters, string and number
// method arguments, parseInt/parseFloat, array and typed-array indices.
var s = Symbol("1"); function t(f) { try { return String(f()); } catch (e) { return e.constructor.name; } }
console.log(t(() => isFinite(s)), t(() => isNaN(s)), t(() => Math.max(1, s)), t(() => Math.abs(s)), t(() => [].copyWithin(0, s)), t(() => [1,2].slice(s)), t(() => new Uint8Array(2).slice(s)), t(() => new Date().setFullYear(s)), t(() => s == 1), t(() => Number(s)), t(() => +s), t(() => Math.max({ valueOf() { return 7; } }, 2)), t(() => Math.random() < 1), t(() => Math.min()), t(() => parseInt(s)), t(() => [1].indexOf(1, s)), t(() => "abc".slice(s)), t(() => (1).toFixed(s)));
console.log((1.5).toFixed({ valueOf() { return 3; } }), (255).toString({ valueOf() { return 16; } }), (1).toExponential(undefined), new Date(0).setFullYear({ valueOf() { return 2000; } }) > 0, Math.max("3", { valueOf() { return 4; } }), isNaN({ valueOf() { return NaN; } }));
