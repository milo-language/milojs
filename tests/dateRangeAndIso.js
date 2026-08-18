// Two Date bugs, both about the ends of the representable range.
//
// TimeClip: a time value outside +/-8.64e15 ms is not representable and becomes
// NaN. milojs had no clamp anywhere, so out-of-range construction produced a Date
// answering impossible milliseconds instead of Invalid Date.
//
// Extended years: the ISO year is either four digits or a SIGN plus six
// (`+275760`, `-271820`), which is how the spec reaches those ends. The parser
// assumed four digits, so every extended-year string was NaN.
//
// Only forms that carry an explicit Z are used below. A date-TIME with no offset
// is local time per spec, and milojs has no local timezone (getTimezoneOffset is
// always 0), so such a string would compare against node's machine.
function t(n, f) { try { console.log(n, String(f())); } catch (e) { console.log(n, "threw"); } }

t("utc-min", () => Date.UTC(-271821, 3, 20));
t("utc-max", () => Date.UTC(275760, 8, 13));
t("utc-under", () => Date.UTC(-271821, 3, 19));
t("utc-over", () => Date.UTC(275760, 8, 14));
t("new-over", () => new Date(8640000000000001).getTime());
t("new-under", () => new Date(-8640000000000001).getTime());
t("new-edge", () => new Date(8640000000000000).getTime());
t("setTime-over", () => { var d = new Date(0); d.setTime(9e15); return d.getTime(); });
t("setFullYear-over", () => { var d = new Date(0); d.setFullYear(400000); return d.getTime(); });
t("new-infinity", () => new Date(Infinity).getTime());
t("new-fractional", () => new Date(1.9).getTime());
t("new-negative-fractional", () => new Date(-1.9).getTime());

var forms = ["2020", "2020-05", "2020-05-17", "2020-05-17T10:20:30Z",
  "2020-05-17T10:20:30.123Z", "+002020", "-000001", "+275760", "-271820",
  "+275760-09-13T00:00:00Z", "-271821-04-20T00:00:00.000Z", "-000000",
  "2020-13-01", "2020-05-32", "", "1970-01-01T00:00:00.000Z"];
console.log(forms.map(function (s) { return JSON.stringify(s) + "=" + Date.parse(s); }).join("\n"));
t("roundtrip-min", () => new Date(-8640000000000000).toISOString());
t("roundtrip-max", () => new Date(8640000000000000).toISOString());
