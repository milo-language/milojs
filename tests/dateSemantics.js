// Date: parsing, UTC construction and getters, setter overflow, the value range,
// and the primitive conversions. 4 of 24 disagreed with node.
//
// Everything here is UTC or epoch-based on purpose. Local formatting depends on
// the machine's timezone, so a fixture that used it would encode this laptop.
function t(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "THREW", e.constructor.name); } }
t("parse-iso", () => [Date.parse("2026-08-19"), Date.parse("2026-08-19T12:00:00Z"), Date.parse("2026-08-19T12:00:00.500Z")]);
t("parse-offsets", () => [Date.parse("2026-08-19T12:00:00+02:00"), Date.parse("2026-08-19T12:00:00-05:30")]);
t("parse-extended-year", () => [Date.parse("+002026-08-19T00:00:00Z"), Date.parse("-000001-01-01T00:00:00Z")]);
t("parse-invalid", () => [Date.parse("nonsense"), Date.parse("2026-13-01"), Date.parse("2026-02-30T00:00:00Z")]);
t("parse-legacy", () => [typeof Date.parse("Aug 19 2026"), typeof Date.parse("Wed, 19 Aug 2026 00:00:00 GMT")]);
t("utc-static", () => [Date.UTC(2026, 7, 19), Date.UTC(2026), Date.UTC(2026, 0, 1, 0, 0, 0, 0), Date.UTC(96, 1, 2)]);
t("ctor-overflow", () => [new Date(Date.UTC(2026, 12, 1)).toISOString(), new Date(Date.UTC(2026, 0, 32)).toISOString()]);
t("ctor-two-digit-year", () => new Date(Date.UTC(99, 0, 1)).toISOString());
t("getters-utc", () => { const d = new Date(Date.UTC(2026, 7, 19, 13, 45, 30, 250)); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCDay(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()]; });
t("setters-utc", () => { const d = new Date(0); d.setUTCFullYear(2026); d.setUTCMonth(7); d.setUTCDate(19); return d.toISOString(); });
t("setter-overflow", () => { const d = new Date(Date.UTC(2026, 0, 1)); d.setUTCDate(32); return d.toISOString(); });
t("setter-returns-time", () => { const d = new Date(0); return [d.setUTCFullYear(2026), typeof d.setUTCMonth(1)]; });
t("invalid-date", () => { const d = new Date(NaN); return [String(d.getTime()), d.toString(), (() => { try { return d.toISOString(); } catch (e) { return "THREW:" + e.constructor.name; } })()]; });
t("range-limit", () => [new Date(8640000000000000).toISOString(), String(new Date(8640000000000001).getTime())]);
t("toJSON", () => [new Date(0).toJSON(), JSON.stringify({ d: new Date(0) }), new Date(NaN).toJSON()]);
t("toISOString-neg", () => [new Date(-1).toISOString(), new Date(Date.UTC(-1, 0, 1)).toISOString()]);
t("valueOf-primitive", () => { const d = new Date(0); return [+d, `${d}` === d.toString(), d[Symbol.toPrimitive]("number")]; });
t("compare", () => { const a = new Date(0); const b = new Date(1); return [a < b, +a === +new Date(0), a.getTime() === 0]; });
t("date-arith", () => { const d = new Date(0); return [new Date(+d + 1000).toISOString(), d - new Date(0)]; });
t("setTime", () => { const d = new Date(0); d.setTime(1000); return [d.toISOString(), d.setTime(NaN), String(d.getTime())]; });
t("getYear-legacy", () => { const d = new Date(Date.UTC(2026, 0, 1)); return typeof d.getYear; });
t("utc-string", () => new Date(0).toUTCString());
t("iso-roundtrip", () => { const s = "2026-08-19T13:45:30.250Z"; return new Date(s).toISOString() === s; });
t("symbol-toPrimitive-call", () => { const d = new Date(5); return [d[Symbol.toPrimitive]("number"), d[Symbol.toPrimitive]("string").slice(0, 3), typeof Date.prototype[Symbol.toPrimitive]]; });
