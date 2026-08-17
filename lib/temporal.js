"use strict";
// Temporal, stage 1: the plain (calendar-free-ish, ISO 8601) types.
//
// Written in JS rather than as Milo natives because every operation here is
// arithmetic over small integers and string formatting — the engine runs that
// well, and a native would be a large amount of Milo for no speed that matters.
// Nanosecond fields need exact integers past 2^53, so Instant keeps its epoch
// value as a BigInt.
//
// Deliberately NOT a stub: a `Temporal` global that exists but throws is worse
// than none at all, because every library feature-detects with `typeof
// Temporal !== "undefined"` and would take a broken path. What is defined here
// works; what is not defined yet is absent, so detection stays honest.

// Everything below is wrapped: this file runs in GLOBAL scope, so a bare
// top-level `function pad()` would become a global named `pad`. It did, and it
// broke an unrelated fixture whose sloppy-mode `this` picked up `globalThis.tag`
// as a property. Only `Temporal` escapes.
(function () {
var $slot = Symbol("Temporal.slot");

function def(obj, name, value) {
  // A built-in method's own `name` is the PROPERTY key, not whatever the
  // function expression happened to be called — `with` is a reserved word, so
  // its implementation is `withFields` and the name has to be corrected here.
  // test262 has a name.js and a length.js per member.
  if (typeof value === "function" && typeof name === "string") {
    Object.defineProperty(value, "name", { value: name, writable: false, enumerable: false, configurable: true });
  }
  Object.defineProperty(obj, name, { value: value, writable: true, enumerable: false, configurable: true });
}
function getter(obj, name, fn) {
  Object.defineProperty(obj, name, { get: fn, enumerable: false, configurable: true });
}
function tag(obj, name) {
  Object.defineProperty(obj, Symbol.toStringTag, { value: name, writable: false, enumerable: false, configurable: true });
}
// Every prototype method is brand checked: `Temporal.PlainDate.prototype.year`
// read off a plain object is a TypeError, and test262 has a branding.js per
// member.
function slotOf(o, kind) {
  if (o === null || typeof o !== "object" || !o[$slot] || o[$slot].kind !== kind) {
    throw new TypeError("not a Temporal." + kind);
  }
  return o[$slot];
}
function setSlot(o, kind, fields) {
  fields.kind = kind;
  Object.defineProperty(o, $slot, { value: fields, writable: false, enumerable: false, configurable: false });
}

function toIntegerWithTruncation(v, name) {
  var n = Number(v);
  if (Number.isNaN(n)) throw new RangeError(name + " must be a finite number");
  if (!Number.isFinite(n)) throw new RangeError(name + " must be a finite number");
  return Math.trunc(n);
}
function requireInt(v, name, dflt) {
  if (v === undefined) return dflt;
  return toIntegerWithTruncation(v, name);
}
function pad(n, w) {
  var s = String(Math.abs(n));
  while (s.length < w) s = "0" + s;
  return s;
}

// --- ISO calendar arithmetic -------------------------------------------------
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function daysInMonth(y, m) { return m === 2 && isLeap(y) ? 29 : MONTH_DAYS[m - 1]; }
function isValidISODate(y, m, d) {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}
function rejectISODate(y, m, d) {
  if (!isValidISODate(y, m, d)) throw new RangeError("invalid ISO date");
}
// days since the ISO epoch (1970-01-01), by the civil-from-days algorithm
function epochDayFromISO(y, m, d) {
  var yy = m <= 2 ? y - 1 : y;
  var era = Math.floor(yy / 400);
  var yoe = yy - era * 400;
  var mp = (m + 9) % 12;
  var doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function isoFromEpochDay(z) {
  var zz = z + 719468;
  var era = Math.floor(zz / 146097);
  var doe = zz - era * 146097;
  var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  var y = yoe + era * 400;
  var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  var mp = Math.floor((5 * doy + 2) / 153);
  var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  var m = mp < 10 ? mp + 3 : mp - 9;
  return { year: m <= 2 ? y + 1 : y, month: m, day: d };
}
function dayOfWeek(y, m, d) {
  var wd = (epochDayFromISO(y, m, d) + 4) % 7;
  return wd <= 0 ? wd + 7 : wd;
}
function dayOfYear(y, m, d) { return epochDayFromISO(y, m, d) - epochDayFromISO(y, 1, 1) + 1; }
function balanceISODate(y, m, d) {
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return isoFromEpochDay(epochDayFromISO(y, m, 1) + (d - 1));
}
function formatYear(y) {
  if (y >= 0 && y <= 9999) return pad(y, 4);
  return (y < 0 ? "-" : "+") + pad(y, 6);
}

// --- Temporal.Duration -------------------------------------------------------
function Duration(years, months, weeks, days, hours, minutes, seconds, milliseconds, microseconds, nanoseconds) {
  if (!new.target) throw new TypeError("Temporal.Duration must be called with new");
  var f = {
    years: requireInt(years, "years", 0), months: requireInt(months, "months", 0),
    weeks: requireInt(weeks, "weeks", 0), days: requireInt(days, "days", 0),
    hours: requireInt(hours, "hours", 0), minutes: requireInt(minutes, "minutes", 0),
    seconds: requireInt(seconds, "seconds", 0), milliseconds: requireInt(milliseconds, "milliseconds", 0),
    microseconds: requireInt(microseconds, "microseconds", 0), nanoseconds: requireInt(nanoseconds, "nanoseconds", 0)
  };
  // every field must share one sign; a mixed-sign duration has no meaning
  var sign = 0;
  for (var k in f) {
    var v = f[k];
    if (v !== 0) {
      var s = v < 0 ? -1 : 1;
      if (sign !== 0 && s !== sign) throw new RangeError("mixed-sign duration");
      sign = s;
    }
  }
  setSlot(this, "Duration", f);
}
var DP = Duration.prototype;
tag(DP, "Temporal.Duration");
["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds"]
  .forEach(function (k) { getter(DP, k, function () { return slotOf(this, "Duration")[k]; }); });
getter(DP, "sign", function () {
  var f = slotOf(this, "Duration");
  for (var k in f) { if (k !== "kind" && f[k] !== 0) return f[k] < 0 ? -1 : 1; }
  return 0;
});
getter(DP, "blank", function () { return this.sign === 0; });

function durationFields(d) { return slotOf(d, "Duration"); }
function makeDuration(f) {
  return new Duration(f.years, f.months, f.weeks, f.days, f.hours, f.minutes, f.seconds, f.milliseconds, f.microseconds, f.nanoseconds);
}
def(DP, "negated", function negated() {
  var f = durationFields(this);
  return new Duration(-f.years, -f.months, -f.weeks, -f.days, -f.hours, -f.minutes, -f.seconds, -f.milliseconds, -f.microseconds, -f.nanoseconds);
});
def(DP, "abs", function abs() {
  var f = durationFields(this);
  return new Duration(Math.abs(f.years), Math.abs(f.months), Math.abs(f.weeks), Math.abs(f.days), Math.abs(f.hours),
    Math.abs(f.minutes), Math.abs(f.seconds), Math.abs(f.milliseconds), Math.abs(f.microseconds), Math.abs(f.nanoseconds));
});
def(DP, "with", function withFields(o) {
  var f = durationFields(this);
  if (!isObjectLike(o)) throw new TypeError("options must be an object");
  var g = {};
  ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds"]
    .forEach(function (k) { g[k] = o[k] === undefined ? f[k] : toIntegerWithTruncation(o[k], k); });
  return makeDuration(g);
});
def(DP, "toJSON", function toJSON() { return durationToString(this); });
def(DP, "toString", function toString() { return durationToString(this); });
def(DP, "valueOf", function valueOf() { throw new TypeError("Temporal.Duration has no primitive value"); });

function durationToString(d) {
  var f = durationFields(d);
  var sign = d.sign < 0 ? "-" : "";
  var date = "";
  if (f.years) date += Math.abs(f.years) + "Y";
  if (f.months) date += Math.abs(f.months) + "M";
  if (f.weeks) date += Math.abs(f.weeks) + "W";
  if (f.days) date += Math.abs(f.days) + "D";
  var time = "";
  if (f.hours) time += Math.abs(f.hours) + "H";
  if (f.minutes) time += Math.abs(f.minutes) + "M";
  var secs = Math.abs(f.seconds);
  var frac = Math.abs(f.milliseconds) * 1e6 + Math.abs(f.microseconds) * 1e3 + Math.abs(f.nanoseconds);
  secs += Math.floor(frac / 1e9);
  frac = frac % 1e9;
  if (secs || frac) {
    time += secs;
    if (frac) {
      var fs = pad(frac, 9).replace(/0+$/, "");
      time += "." + fs;
    }
    time += "S";
  }
  if (!date && !time) return "PT0S";
  return sign + "P" + date + (time ? "T" + time : "");
}

var DURATION_RE = /^([+-])?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+(?:[.,]\d{1,9})?)H)?(?:(\d+(?:[.,]\d{1,9})?)M)?(?:(\d+(?:[.,]\d{1,9})?)S)?)?$/;
function durationFromString(s) {
  var m = DURATION_RE.exec(s);
  if (!m || s === "P" || s === "PT" || /T$/.test(s)) throw new RangeError("invalid duration string: " + s);
  var sign = m[1] === "-" ? -1 : 1;
  function whole(x) { return x === undefined ? 0 : Math.trunc(Number(String(x).replace(",", "."))); }
  function fracOf(x, unitNs) {
    if (x === undefined) return 0;
    var v = Number(String(x).replace(",", "."));
    return Math.round((v - Math.trunc(v)) * unitNs);
  }
  var ns = fracOf(m[6], 3.6e12) + fracOf(m[7], 6e10) + fracOf(m[8], 1e9);
  var ms = Math.trunc(ns / 1e6); ns -= ms * 1e6;
  var us = Math.trunc(ns / 1e3); ns -= us * 1e3;
  return new Duration(sign * whole(m[2]), sign * whole(m[3]), sign * whole(m[4]), sign * whole(m[5]),
    sign * whole(m[6]), sign * whole(m[7]), sign * whole(m[8]), sign * ms, sign * us, sign * ns);
}
def(Duration, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    if (item[$slot] && item[$slot].kind === "Duration") return makeDuration(durationFields(item));
    var g = {};
    var any = false;
    ["years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds", "microseconds", "nanoseconds"]
      .forEach(function (k) { if (item[k] !== undefined) { any = true; g[k] = toIntegerWithTruncation(item[k], k); } else g[k] = 0; });
    if (!any) throw new TypeError("duration needs at least one field");
    return makeDuration(g);
  }
  return durationFromString(String(item));
});
def(Duration, "compare", function compare(a, b) {
  var x = totalNs(Duration.from(a)), y = totalNs(Duration.from(b));
  return x < y ? -1 : x > y ? 1 : 0;
});
// --- Duration.prototype.round / .total ---------------------------------------
// Every unit, largest first, with the nanoseconds it is worth. Years, months and
// weeks have no fixed length: their entry is null, and any operation that would
// need their size demands a `relativeTo` to measure them from.
var ALL_UNITS = [
  ["year", null], ["month", null], ["week", null], ["day", 86400e9],
  ["hour", 3600e9], ["minute", 60e9], ["second", 1e9],
  ["millisecond", 1e6], ["microsecond", 1e3], ["nanosecond", 1]
];
var UNIT_FIELD = {
  year: "years", month: "months", week: "weeks", day: "days", hour: "hours",
  minute: "minutes", second: "seconds", millisecond: "milliseconds",
  microsecond: "microseconds", nanosecond: "nanoseconds"
};
function allUnitIndex(name) {
  for (var i = 0; i < ALL_UNITS.length; i++) { if (ALL_UNITS[i][0] === name) return i; }
  return -1;
}
// Accepts the singular and plural spellings the spec allows, and reports an
// unknown one as a RangeError rather than silently defaulting.
function toDurationUnit(v, what) {
  var u = String(v);
  if (u.charAt(u.length - 1) === "s" && u !== "s") u = u.slice(0, -1);
  if (allUnitIndex(u) < 0) throw new RangeError(what + " must be a Temporal unit, got " + String(v));
  return u;
}
function readDurationUnit(opts, key, allowAuto) {
  var v = opts[key];
  if (v === undefined) return undefined;
  if (allowAuto && String(v) === "auto") return "auto";
  return toDurationUnit(v, key);
}
// The largest unit a duration actually uses; the spec's default when
// largestUnit is "auto".
function defaultLargestUnit(f) {
  for (var i = 0; i < ALL_UNITS.length; i++) {
    if (f[UNIT_FIELD[ALL_UNITS[i][0]]] !== 0) return ALL_UNITS[i][0];
  }
  return "nanosecond";
}
function hasCalendarFields(f) {
  return f.years !== 0 || f.months !== 0 || f.weeks !== 0;
}
// Days are 24 hours here, which is exactly true with no time zone in play; a
// duration carrying years/months/weeks cannot be measured this way at all and
// is rejected before reaching here.
function durationExactNs(f) {
  return ((((f.days * 24 + f.hours) * 60 + f.minutes) * 60 + f.seconds) * 1e3 + f.milliseconds) * 1e6
    + f.microseconds * 1e3 + f.nanoseconds;
}
function nsToDurationFields(totalNs, largest, smallest, increment, mode) {
  var sign = totalNs < 0 ? -1 : 1;
  var rest = Math.abs(totalNs);
  rest = applyRounding(rest, ALL_UNITS[allUnitIndex(smallest)][1] * increment, mode);
  var f = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 };
  for (var i = allUnitIndex(largest); i < ALL_UNITS.length; i++) {
    var w = ALL_UNITS[i][1];
    var n = Math.floor(rest / w);
    rest -= n * w;
    f[UNIT_FIELD[ALL_UNITS[i][0]]] = sign * n;
  }
  return f;
}
function checkRoundingIncrement(v) {
  if (v === undefined) return 1;
  var n = Number(v);
  if (!Number.isFinite(n) || Math.trunc(n) !== n || n < 1 || n > 1e9) {
    throw new RangeError("roundingIncrement must be an integer between 1 and 1e9");
  }
  return n;
}
// --- calendar-relative arithmetic --------------------------------------------
// A year, a month and a week only have a length once you say WHEN, so every
// operation over them here works on a concrete start point: a {year, month, day,
// hour…} record built from relativeTo, with midnight filled in for a PlainDate.

function dtOf(o) {
  var f = o[$slot];
  var base = { year: f.year, month: f.month, day: f.day, hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 };
  if (f.kind === "PlainDateTime" || f.kind === "ZonedDateTime") {
    base.hour = f.hour; base.minute = f.minute; base.second = f.second;
    base.millisecond = f.millisecond; base.microsecond = f.microsecond; base.nanosecond = f.nanosecond;
  }
  return base;
}
function addMonthsClamped(dt, n) {
  var y = dt.year;
  var m = dt.month + n;
  y += Math.floor((m - 1) / 12);
  m = ((m - 1) % 12 + 12) % 12 + 1;
  return { year: y, month: m, day: Math.min(dt.day, daysInMonth(y, m)),
           hour: dt.hour, minute: dt.minute, second: dt.second,
           millisecond: dt.millisecond, microsecond: dt.microsecond, nanosecond: dt.nanosecond };
}
function addDaysTo(dt, n) {
  var iso = isoFromEpochDay(epochDayFromISO(dt.year, dt.month, dt.day) + n);
  return { year: iso.year, month: iso.month, day: iso.day,
           hour: dt.hour, minute: dt.minute, second: dt.second,
           millisecond: dt.millisecond, microsecond: dt.microsecond, nanosecond: dt.nanosecond };
}
// start + one whole `unit` in the direction of `sign`.
function addUnits(dt, unit, n) {
  if (unit === "year") return addMonthsClamped(dt, n * 12);
  if (unit === "month") return addMonthsClamped(dt, n);
  if (unit === "week") return addDaysTo(dt, n * 7);
  if (unit === "day") return addDaysTo(dt, n);
  // day-relative, for the same precision reason as cmpDateTime
  var total = timeToNs(dt) + n * ALL_UNITS[allUnitIndex(unit)][1];
  var dayShift = Math.floor(total / 86400e9);
  var t = nsToTime(total - dayShift * 86400e9);
  var shifted = addDaysTo(dt, dayShift);
  shifted.hour = t.hour; shifted.minute = t.minute; shifted.second = t.second;
  shifted.millisecond = t.millisecond; shifted.microsecond = t.microsecond; shifted.nanosecond = t.nanosecond;
  return shifted;
}
// The whole duration applied to a start point: calendar parts first (so adding a
// month to Jan 31 clamps to Feb 28 before any time is added), then days, then
// the exact time span.
function addDurationTo(dt, f) {
  var out = addMonthsClamped(dt, f.years * 12 + f.months);
  out = addDaysTo(out, f.weeks * 7 + f.days);
  var timeNs = ((f.hours * 60 + f.minutes) * 60 + f.seconds) * 1e9 + f.milliseconds * 1e6 + f.microseconds * 1e3 + f.nanoseconds;
  if (timeNs !== 0) out = addUnits(out, "nanosecond", timeNs);
  return out;
}
// Compared by day and then by time, never by an absolute nanosecond count: one
// epoch-nanosecond value is around 1.6e18, well past the 2^53 where a float
// stops holding every integer, so two instants a few hundred nanoseconds apart
// compared EQUAL and the search loops below never terminated.
function cmpDateTime(a, b) {
  var da = epochDayFromISO(a.year, a.month, a.day), db = epochDayFromISO(b.year, b.month, b.day);
  if (da !== db) return da < db ? -1 : 1;
  var ta = timeToNs(a), tb = timeToNs(b);
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}
// The span between two points, built from the day difference and the time
// difference rather than from two absolute epoch values, so it stays exact for
// any span a float can hold at all.
function nsBetween(a, b) {
  return (epochDayFromISO(b.year, b.month, b.day) - epochDayFromISO(a.year, a.month, a.day)) * 86400e9
    + (timeToNs(b) - timeToNs(a));
}
// Whole `unit`s from start to end, signed, with the fraction of the next one.
// This is the shape RoundDuration needs: the fraction's denominator is the
// length of the very unit being counted, measured at the point it starts, which
// is why a month can be 28/29/30/31 days here and stay exact.
function unitsBetween(start, end, unit) {
  var fixed = ALL_UNITS[allUnitIndex(unit)][1];
  if (fixed !== null) {
    // a unit of known length needs no search, and searching one nanosecond at a
    // time over a span of 1e16 nanoseconds would not have terminated anyway
    var total = nsBetween(start, end) / fixed;
    var w = Math.trunc(total);
    return { whole: w, fraction: total - w };
  }
  var cmp = cmpDateTime(start, end);
  if (cmp === 0) return { whole: 0, fraction: 0 };
  var sign = cmp < 0 ? 1 : -1;
  var guess;
  if (unit === "year") guess = end.year - start.year;
  else if (unit === "month") guess = (end.year - start.year) * 12 + (end.month - start.month);
  else guess = Math.trunc(nsBetween(start, end) / (7 * 86400e9));
  // walk the guess back until start + guess units has not passed end, then
  // forward while another whole unit still fits
  while (guess !== 0 && sign * cmpDateTime(addUnits(start, unit, guess), end) > 0) guess -= sign;
  while (sign * cmpDateTime(addUnits(start, unit, guess + sign), end) <= 0) guess += sign;
  var lo = addUnits(start, unit, guess);
  var hi = addUnits(start, unit, guess + sign);
  var span = nsBetween(lo, hi);
  // lo→end and lo→hi run the same way, so their ratio is a MAGNITUDE; it has to
  // be signed back into the direction of travel or a negative duration reads as
  // -1 + 0.47 rather than -1.47
  var fraction = span === 0 ? 0 : sign * (nsBetween(lo, end) / span);
  return { whole: guess, fraction: fraction };
}
// A signed span between two points, expressed with `largest` as its biggest
// unit. Calendar units come from walking the calendar; everything below a day is
// the exact nanosecond remainder.
function spanToDuration(start, end, largest, smallest, increment, mode) {
  var li = allUnitIndex(largest);
  if (ALL_UNITS[li][1] !== null && li >= allUnitIndex("day")) {
    // no calendar unit involved: one exact nanosecond count does it
    return nsToDurationFields(nsBetween(start, end), largest, smallest, increment, mode);
  }
  var f = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 };
  var cursor = start;
  var order = ["year", "month", "week", "day"];
  for (var i = 0; i < order.length; i++) {
    var u = order[i];
    if (allUnitIndex(u) < li) continue;
    if (allUnitIndex(u) > allUnitIndex(smallest)) break;
    var w = unitsBetween(cursor, end, u).whole;
    if (w !== 0) {
      f[UNIT_FIELD[u]] = w;
      cursor = addUnits(cursor, u, w);
    }
  }
  var restNs = nsBetween(cursor, end);
  var si = allUnitIndex(smallest);
  if (si > allUnitIndex("day")) {
    var timeFields = nsToDurationFields(restNs, "hour", smallest, increment, mode);
    for (var k = allUnitIndex("hour"); k < ALL_UNITS.length; k++) {
      f[UNIT_FIELD[ALL_UNITS[k][0]]] = timeFields[UNIT_FIELD[ALL_UNITS[k][0]]];
    }
  }
  return f;
}

// relativeTo is a PlainDate, a PlainDateTime, or something convertible to one.
// A ZonedDateTime is accepted and treated as its wall-clock date and time: no
// time zone here has a transition, so that is the same answer.
function readRelativeTo(opts) {
  var r = opts.relativeTo;
  if (r === undefined) return undefined;
  if (r === null) throw new TypeError("relativeTo must be a date, a string, or undefined");
  if (typeof r === "object") {
    if (r[$slot] && (r[$slot].kind === "PlainDate" || r[$slot].kind === "PlainDateTime" || r[$slot].kind === "ZonedDateTime")) return r;
    return PlainDate.from(r);
  }
  return PlainDate.from(String(r));
}
def(DP, "round", function round(roundTo) {
  var f = durationFields(this);
  if (roundTo === undefined) throw new TypeError("round needs a smallestUnit or largestUnit");
  var opts;
  if (typeof roundTo === "string") {
    opts = { smallestUnit: roundTo };
  } else {
    if (roundTo === null || typeof roundTo !== "object") throw new TypeError("roundTo must be a string or an object");
    opts = roundTo;
  }
  var largest = readDurationUnit(opts, "largestUnit", true);
  var smallest = readDurationUnit(opts, "smallestUnit", false);
  if (largest === undefined && smallest === undefined) {
    throw new RangeError("round needs at least one of smallestUnit and largestUnit");
  }
  var relativeTo = readRelativeTo(opts);
  var increment = checkRoundingIncrement(opts.roundingIncrement);
  var mode = readRoundingMode(opts);
  if (smallest === undefined) smallest = "nanosecond";
  var existing = defaultLargestUnit(f);
  if (largest === undefined || largest === "auto") {
    largest = allUnitIndex(existing) < allUnitIndex(smallest) ? existing : smallest;
  }
  if (allUnitIndex(smallest) < allUnitIndex(largest)) {
    throw new RangeError("smallestUnit is larger than largestUnit");
  }
  var needsCalendar = ALL_UNITS[allUnitIndex(largest)][1] === null || ALL_UNITS[allUnitIndex(smallest)][1] === null || hasCalendarFields(f);
  if (needsCalendar && relativeTo === undefined) {
    throw new RangeError("a relativeTo is required to round years, months or weeks");
  }
  if (relativeTo === undefined) {
    return makeDuration(nsToDurationFields(durationExactNs(f), largest, smallest, increment, mode));
  }
  // Round at the smallest unit FIRST, measured from the start point, then
  // re-express the result from that same start point. Rounding after balancing
  // would round a number whose units had already been given fixed lengths.
  var start = dtOf(relativeTo);
  var end = addDurationTo(start, f);
  var counted = unitsBetween(start, end, smallest);
  var rounded = applyRounding(counted.whole + counted.fraction, increment, mode);
  var roundedEnd = addUnits(start, smallest, rounded);
  return makeDuration(spanToDuration(start, roundedEnd, largest, smallest, 1, "trunc"));
});
// add/subtract without a relativeTo: legal exactly when neither side carries a
// calendar unit, because days and below have fixed lengths. The result balances
// up to the larger of the two operands' largest units, as the spec's
// AddDurations does.
function addDurations(a, other, sign) {
  var b = durationFields(Duration.from(other));
  if (hasCalendarFields(a) || hasCalendarFields(b)) {
    throw new RangeError("a relativeTo is required to add durations with years, months or weeks");
  }
  var ns = durationExactNs(a) + sign * durationExactNs(b);
  var la = allUnitIndex(defaultLargestUnit(a)), lb = allUnitIndex(defaultLargestUnit(b));
  var largest = ALL_UNITS[la < lb ? la : lb][0];
  return makeDuration(nsToDurationFields(ns, largest, "nanosecond", 1, "trunc"));
}
def(DP, "add", function add(other) {
  return addDurations(durationFields(this), other, 1);
});
def(DP, "subtract", function subtract(other) {
  return addDurations(durationFields(this), other, -1);
});
def(DP, "total", function total(totalOf) {
  var f = durationFields(this);
  if (totalOf === undefined) throw new TypeError("total needs a unit");
  var opts;
  if (typeof totalOf === "string") {
    opts = { unit: totalOf };
  } else {
    if (totalOf === null || typeof totalOf !== "object") throw new TypeError("totalOf must be a string or an object");
    opts = totalOf;
  }
  var unit = readDurationUnit(opts, "unit", false);
  if (unit === undefined) throw new RangeError("total needs a unit");
  var relativeTo = readRelativeTo(opts);
  if ((ALL_UNITS[allUnitIndex(unit)][1] === null || hasCalendarFields(f)) && relativeTo === undefined) {
    throw new RangeError("a relativeTo is required to total years, months or weeks");
  }
  if (relativeTo === undefined) {
    return durationExactNs(f) / ALL_UNITS[allUnitIndex(unit)][1];
  }
  var start = dtOf(relativeTo);
  var end = addDurationTo(start, f);
  if (ALL_UNITS[allUnitIndex(unit)][1] !== null && allUnitIndex(unit) >= allUnitIndex("day")) {
    return nsBetween(start, end) / ALL_UNITS[allUnitIndex(unit)][1];
  }
  var counted = unitsBetween(start, end, unit);
  return counted.whole + counted.fraction;
});

function totalNs(d) {
  var f = durationFields(d);
  // years and months are calendar-dependent; without a relativeTo they are
  // compared on the spec's fallback of 0 days, which is what compare() needs
  return ((((f.days * 24 + f.hours) * 60 + f.minutes) * 60 + f.seconds) * 1e3 + f.milliseconds) * 1e6
    + f.microseconds * 1e3 + f.nanoseconds + ((f.years * 12 + f.months) * 30 + f.weeks * 7) * 86400e9;
}

// --- Temporal.PlainDate ------------------------------------------------------
function PlainDate(y, m, d) {
  if (!new.target) throw new TypeError("Temporal.PlainDate must be called with new");
  y = toIntegerWithTruncation(y, "year"); m = toIntegerWithTruncation(m, "month"); d = toIntegerWithTruncation(d, "day");
  rejectISODate(y, m, d);
  setSlot(this, "PlainDate", { year: y, month: m, day: d });
}
var PDP = PlainDate.prototype;
tag(PDP, "Temporal.PlainDate");
getter(PDP, "year", function () { return slotOf(this, "PlainDate").year; });
getter(PDP, "month", function () { return slotOf(this, "PlainDate").month; });
getter(PDP, "day", function () { return slotOf(this, "PlainDate").day; });
getter(PDP, "monthCode", function () { return "M" + pad(slotOf(this, "PlainDate").month, 2); });
getter(PDP, "dayOfWeek", function () { var f = slotOf(this, "PlainDate"); return dayOfWeek(f.year, f.month, f.day); });
getter(PDP, "dayOfYear", function () { var f = slotOf(this, "PlainDate"); return dayOfYear(f.year, f.month, f.day); });
getter(PDP, "daysInMonth", function () { var f = slotOf(this, "PlainDate"); return daysInMonth(f.year, f.month); });
getter(PDP, "daysInYear", function () { return isLeap(slotOf(this, "PlainDate").year) ? 366 : 365; });
getter(PDP, "monthsInYear", function () { slotOf(this, "PlainDate"); return 12; });
getter(PDP, "inLeapYear", function () { return isLeap(slotOf(this, "PlainDate").year); });
getter(PDP, "weekOfYear", function () {
  var f = slotOf(this, "PlainDate");
  var wd = dayOfWeek(f.year, f.month, f.day);
  var thursday = epochDayFromISO(f.year, f.month, f.day) + (4 - wd);
  var t = isoFromEpochDay(thursday);
  return Math.floor((thursday - epochDayFromISO(t.year, 1, 1)) / 7) + 1;
});
getter(PDP, "yearOfWeek", function () {
  var f = slotOf(this, "PlainDate");
  var wd = dayOfWeek(f.year, f.month, f.day);
  return isoFromEpochDay(epochDayFromISO(f.year, f.month, f.day) + (4 - wd)).year;
});
function plainDateToString(f) { return formatYear(f.year) + "-" + pad(f.month, 2) + "-" + pad(f.day, 2); }
def(PDP, "toString", function toString() { return plainDateToString(slotOf(this, "PlainDate")); });
def(PDP, "toJSON", function toJSON() { return plainDateToString(slotOf(this, "PlainDate")); });
def(PDP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainDate has no primitive value"); });
def(PDP, "equals", function equals(other) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return a.year === b.year && a.month === b.month && a.day === b.day;
});
def(PDP, "with", function withFields(o) {
  if (!isObjectLike(o)) throw new TypeError("options must be an object");
  var f = slotOf(this, "PlainDate");
  return new PlainDate(o.year === undefined ? f.year : o.year,
    o.month === undefined ? f.month : o.month, o.day === undefined ? f.day : o.day);
});
function addToDate(f, dur, subtract) {
  var s = subtract ? -1 : 1;
  var d = durationFields(dur);
  // years and months first, clamped into the target month, then days: the order
  // the spec fixes, and it is observable — adding 1 month to Jan 31 is Feb 28.
  var y = f.year + s * d.years;
  var m = f.month + s * d.months;
  y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  var day = Math.min(f.day, daysInMonth(y, m));
  var totalDays = s * (d.weeks * 7 + d.days);
  return balanceISODate(y, m, day + totalDays);
}
def(PDP, "add", function add(dur) {
  var r = addToDate(slotOf(this, "PlainDate"), Duration.from(dur), false);
  return new PlainDate(r.year, r.month, r.day);
});
def(PDP, "subtract", function subtract(dur) {
  var r = addToDate(slotOf(this, "PlainDate"), Duration.from(dur), true);
  return new PlainDate(r.year, r.month, r.day);
});
def(PDP, "until", function until(other, options) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return plainDateDifference(a, b, options, "until");
});
def(PDP, "since", function since(other, options) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return plainDateDifference(b, a, options, "since");
});
// An Object in the spec's sense, which includes a FUNCTION. Every option check in
// this file used `typeof x !== "object"`, which rejects one: test262 passes
// `until(later, () => {})` precisely to catch that, because GetOptionsObject only
// asks for an Object and a lambda with no properties is a legal empty options bag.
function isObjectLike(v) {
  return v !== null && (typeof v === "object" || typeof v === "function");
}

// GetOptionsObject: undefined means "no options", and anything else that is not an
// Object is a TypeError — a string, a number and a symbol included. Methods used to
// index the argument directly, so `until(other, null)` was silently accepted.
function optionsObject(options, where) {
  if (options === undefined) return undefined;
  if (!isObjectLike(options)) {
    throw new TypeError(where + ": options must be an object or undefined");
  }
  return options;
}

// The calendar an item names. There was no validation at all: an empty string, a
// number, null and even a Symbol were accepted and silently treated as iso8601.
// The spec's ORDER is what the tests check — a Symbol fails at ToString with a
// TypeError, everything else is stringified and must then BE a known calendar ID,
// case-insensitively, so "ISO8601" is fine and "" and "nope" are RangeErrors.
// Any ISO-ish shape a calendar annotation can hang off: a year-month or date, a
// month-day (`01-01`, `--01-01`), or a time. The narrower year-first pattern
// rejected `01-01`, which 15 tests use as a calendar string.
var CAL_ISOISH_RE = /^(?:[+-]?\d{4,6}-?\d{2}|(?:--)?\d{2}-?\d{2}|T?\d{2}:\d{2})/;
var CAL_ANNOT_RE = /\[!?u-ca=([^\]]*)\]/;

function toCalendarId(v) {
  if (v === undefined) return "iso8601";
  if (typeof v === "symbol") {
    throw new TypeError("calendar must be a string, got a symbol");
  }
  // A Temporal object carrying a date is itself a valid calendar-like: the spec
  // takes its [[Calendar]] directly and must NOT stringify it (the tests assert the
  // fast path by making toString observable).
  if (isObjectLike(v)) {
    var vs = v[$slot];
    if (vs && (vs.kind === "PlainDate" || vs.kind === "PlainDateTime" ||
               vs.kind === "PlainMonthDay" || vs.kind === "PlainYearMonth" ||
               vs.kind === "ZonedDateTime")) {
      return "iso8601";
    }
  }
  var raw = String(v);
  if (raw.toLowerCase() === "iso8601") return "iso8601";
  // ToTemporalCalendarIdentifier also accepts an ISO STRING and takes the calendar
  // from its [u-ca=…] annotation, defaulting to iso8601 when there is none — so
  // `{ calendar: "2020-01[u-ca=iso8601]" }` and `{ calendar: "2020-01-01" }` are
  // both legal ways to say iso8601, and rejecting them broke 51 tests.
  if (CAL_ISOISH_RE.test(raw)) {
    var am = CAL_ANNOT_RE.exec(raw);
    if (!am) return "iso8601";
    if (am[1].toLowerCase() === "iso8601") return "iso8601";
    throw new RangeError("invalid calendar identifier: " + raw);
  }
  throw new RangeError("invalid calendar identifier: " + raw);
}

// An extended (six-digit) year may not be written as negative zero: there is no
// year -0, and the sign is the only thing separating "-000000" from legal "+000000".
function checkExtendedYear(text) {
  if (text.charAt(0) === "-" && Number(text) === 0) {
    throw new RangeError("minus zero is not a valid extended year: " + text);
  }
}

// The difference between two ISO dates in calendar units. Walking month by month is
// unusable at Temporal's range (±273972 years is 3.3M months), so this takes the
// arithmetic difference and corrects it once: build E + years + months with the day
// CLAMPED, and if that overshot the target, back off a single month.
function diffISODateCalendar(e, l, largestUnit) {
  var zero = { hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 };
  function at(n) {
    return addMonthsClamped({ year: e.year, month: e.month, day: e.day,
      hour: zero.hour, minute: zero.minute, second: zero.second,
      millisecond: zero.millisecond, microsecond: zero.microsecond, nanosecond: zero.nanosecond }, n);
  }
  var years = l.year - e.year;
  var months = l.month - e.month;
  if (months < 0) { years -= 1; months += 12; }
  var total = years * 12 + months;
  var cand = at(total);
  if (epochDayFromISO(cand.year, cand.month, cand.day) > epochDayFromISO(l.year, l.month, l.day)) {
    total -= 1;
    years = Math.floor(total / 12);
    months = total - years * 12;
    cand = at(total);
  }
  var days = epochDayFromISO(l.year, l.month, l.day) - epochDayFromISO(cand.year, cand.month, cand.day);
  if (largestUnit === "month") { months = total; years = 0; }
  return { years: years, months: months, weeks: 0, days: days };
}

// Whole days, optionally split into weeks. A week is always 7 days in ISO.
function diffISODateDays(e, l, largestUnit) {
  var days = epochDayFromISO(l.year, l.month, l.day) - epochDayFromISO(e.year, e.month, e.day);
  var weeks = 0;
  if (largestUnit === "week") { weeks = Math.trunc(days / 7); days -= weeks * 7; }
  return { years: 0, months: 0, weeks: weeks, days: days };
}

// until/since between two PlainDates. Both used to ignore their options entirely
// and always answer in days, so `largestUnit: "year"` gave P1889D instead of P5Y2M3D.
function plainDateDifference(a, b, options, where) {
  var opts = optionsObject(options, where);
  var largest = "day";
  if (opts !== undefined) {
    var lu = opts.largestUnit;
    if (lu !== undefined && String(lu) !== "auto") {
      largest = toDurationUnit(lu, "largestUnit");
      if (largest === "hour" || largest === "minute" || largest === "second" ||
          largest === "millisecond" || largest === "microsecond" || largest === "nanosecond") {
        // a date has no time to measure, so a time unit is out of range
        throw new RangeError("largestUnit must be a date unit, got " + String(lu));
      }
    }
  }
  var cmp = epochDayFromISO(a.year, a.month, a.day) - epochDayFromISO(b.year, b.month, b.day);
  var e = cmp <= 0 ? a : b;
  var l = cmp <= 0 ? b : a;
  var d = (largest === "year" || largest === "month")
    ? diffISODateCalendar(e, l, largest)
    : diffISODateDays(e, l, largest);
  var s = cmp <= 0 ? 1 : -1;
  return new Duration(s * d.years, s * d.months, s * d.weeks, s * d.days);
}

var DATE_RE = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})$/;
def(PlainDate, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    if (item[$slot] && item[$slot].kind === "PlainDate") {
      var s = item[$slot];
      return new PlainDate(s.year, s.month, s.day);
    }
    if (item[$slot] && item[$slot].kind === "PlainDateTime") {
      var t = item[$slot];
      return new PlainDate(t.year, t.month, t.day);
    }
    if (item.year === undefined || item.day === undefined) throw new TypeError("PlainDate needs year, month and day");
    var mo = item.month;
    if (mo === undefined && typeof item.monthCode === "string") mo = Number(item.monthCode.slice(1));
    if (mo === undefined) throw new TypeError("PlainDate needs a month");
    toCalendarId(item.calendar);
    return new PlainDate(item.year, mo, item.day);
  }
  // a Symbol never reaches ToString in the spec's order
  if (typeof item === "symbol") throw new TypeError("cannot convert a symbol to a PlainDate");
  var str = String(item);
  var m = DATE_RE.exec(str.length > 10 ? str.slice(0, str.indexOf("T") < 0 ? str.length : str.indexOf("T")) : str);
  if (!m) throw new RangeError("invalid ISO date string: " + str);
  checkExtendedYear(m[1]);
  return new PlainDate(Number(m[1]), Number(m[2]), Number(m[3]));
});
def(PlainDate, "compare", function compare(a, b) {
  var x = slotOf(PlainDate.from(a), "PlainDate"), y = slotOf(PlainDate.from(b), "PlainDate");
  var dx = epochDayFromISO(x.year, x.month, x.day), dy = epochDayFromISO(y.year, y.month, y.day);
  return dx < dy ? -1 : dx > dy ? 1 : 0;
});

// --- Temporal.PlainTime ------------------------------------------------------
function rejectTime(h, mi, s, ms, us, ns) {
  if (h < 0 || h > 23 || mi < 0 || mi > 59 || s < 0 || s > 59 || ms < 0 || ms > 999 || us < 0 || us > 999 || ns < 0 || ns > 999) {
    throw new RangeError("invalid time");
  }
}
function PlainTime(h, mi, s, ms, us, ns) {
  if (!new.target) throw new TypeError("Temporal.PlainTime must be called with new");
  h = requireInt(h, "hour", 0); mi = requireInt(mi, "minute", 0); s = requireInt(s, "second", 0);
  ms = requireInt(ms, "millisecond", 0); us = requireInt(us, "microsecond", 0); ns = requireInt(ns, "nanosecond", 0);
  rejectTime(h, mi, s, ms, us, ns);
  setSlot(this, "PlainTime", { hour: h, minute: mi, second: s, millisecond: ms, microsecond: us, nanosecond: ns });
}
var PTP = PlainTime.prototype;
tag(PTP, "Temporal.PlainTime");
["hour", "minute", "second", "millisecond", "microsecond", "nanosecond"]
  .forEach(function (k) { getter(PTP, k, function () { return slotOf(this, "PlainTime")[k]; }); });
function plainTimeToString(f) {
  var s = pad(f.hour, 2) + ":" + pad(f.minute, 2) + ":" + pad(f.second, 2);
  var frac = f.millisecond * 1e6 + f.microsecond * 1e3 + f.nanosecond;
  if (frac) s += "." + pad(frac, 9).replace(/0+$/, "");
  return s;
}
def(PTP, "toString", function toString() { return plainTimeToString(slotOf(this, "PlainTime")); });
def(PTP, "toJSON", function toJSON() { return plainTimeToString(slotOf(this, "PlainTime")); });
def(PTP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainTime has no primitive value"); });
def(PTP, "equals", function equals(other) {
  var a = slotOf(this, "PlainTime"), b = slotOf(PlainTime.from(other), "PlainTime");
  return a.hour === b.hour && a.minute === b.minute && a.second === b.second
    && a.millisecond === b.millisecond && a.microsecond === b.microsecond && a.nanosecond === b.nanosecond;
});
def(PTP, "with", function withFields(o) {
  if (!isObjectLike(o)) throw new TypeError("options must be an object");
  var f = slotOf(this, "PlainTime");
  return new PlainTime(o.hour === undefined ? f.hour : o.hour, o.minute === undefined ? f.minute : o.minute,
    o.second === undefined ? f.second : o.second, o.millisecond === undefined ? f.millisecond : o.millisecond,
    o.microsecond === undefined ? f.microsecond : o.microsecond, o.nanosecond === undefined ? f.nanosecond : o.nanosecond);
});
function timeToNs(f) {
  return ((f.hour * 60 + f.minute) * 60 + f.second) * 1e9 + f.millisecond * 1e6 + f.microsecond * 1e3 + f.nanosecond;
}
function nsToTime(ns) {
  var day = 86400e9;
  var r = ((ns % day) + day) % day;
  var nanosecond = r % 1e3; r = (r - nanosecond) / 1e3;
  var microsecond = r % 1e3; r = (r - microsecond) / 1e3;
  var millisecond = r % 1e3; r = (r - millisecond) / 1e3;
  var second = r % 60; r = (r - second) / 60;
  var minute = r % 60; r = (r - minute) / 60;
  return { hour: r, minute: minute, second: second, millisecond: millisecond, microsecond: microsecond, nanosecond: nanosecond };
}
function durationTimeNs(d) {
  var f = durationFields(d);
  return ((f.hours * 60 + f.minutes) * 60 + f.seconds) * 1e9 + f.milliseconds * 1e6 + f.microseconds * 1e3 + f.nanoseconds;
}
def(PTP, "add", function add(dur) {
  var t = nsToTime(timeToNs(slotOf(this, "PlainTime")) + durationTimeNs(Duration.from(dur)));
  return new PlainTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(PTP, "subtract", function subtract(dur) {
  var t = nsToTime(timeToNs(slotOf(this, "PlainTime")) - durationTimeNs(Duration.from(dur)));
  return new PlainTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
var TIME_RE = /^(\d{2}):?(\d{2})(?::?(\d{2})(?:[.,](\d{1,9}))?)?$/;
function parseTimeParts(str) {
  var m = TIME_RE.exec(str);
  if (!m) throw new RangeError("invalid ISO time string: " + str);
  var frac = m[4] ? (m[4] + "000000000").slice(0, 9) : "000000000";
  return { hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3] || 0),
    millisecond: Number(frac.slice(0, 3)), microsecond: Number(frac.slice(3, 6)), nanosecond: Number(frac.slice(6, 9)) };
}
def(PlainTime, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    var s = item[$slot];
    if (s && (s.kind === "PlainTime" || s.kind === "PlainDateTime")) {
      return new PlainTime(s.hour, s.minute, s.second, s.millisecond, s.microsecond, s.nanosecond);
    }
    if (item.hour === undefined && item.minute === undefined && item.second === undefined) {
      throw new TypeError("PlainTime needs at least one time field");
    }
    return new PlainTime(item.hour, item.minute, item.second, item.millisecond, item.microsecond, item.nanosecond);
  }
  var str = String(item);
  var ti = str.indexOf("T");
  var t = parseTimeParts(ti >= 0 ? str.slice(ti + 1) : str);
  return new PlainTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(PlainTime, "compare", function compare(a, b) {
  var x = timeToNs(slotOf(PlainTime.from(a), "PlainTime")), y = timeToNs(slotOf(PlainTime.from(b), "PlainTime"));
  return x < y ? -1 : x > y ? 1 : 0;
});

// --- Temporal.PlainDateTime --------------------------------------------------
function PlainDateTime(y, mo, d, h, mi, s, ms, us, ns) {
  if (!new.target) throw new TypeError("Temporal.PlainDateTime must be called with new");
  y = toIntegerWithTruncation(y, "year"); mo = toIntegerWithTruncation(mo, "month"); d = toIntegerWithTruncation(d, "day");
  h = requireInt(h, "hour", 0); mi = requireInt(mi, "minute", 0); s = requireInt(s, "second", 0);
  ms = requireInt(ms, "millisecond", 0); us = requireInt(us, "microsecond", 0); ns = requireInt(ns, "nanosecond", 0);
  rejectISODate(y, mo, d); rejectTime(h, mi, s, ms, us, ns);
  setSlot(this, "PlainDateTime", { year: y, month: mo, day: d, hour: h, minute: mi, second: s,
    millisecond: ms, microsecond: us, nanosecond: ns });
}
var PDTP = PlainDateTime.prototype;
tag(PDTP, "Temporal.PlainDateTime");
["year", "month", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond"]
  .forEach(function (k) { getter(PDTP, k, function () { return slotOf(this, "PlainDateTime")[k]; }); });
getter(PDTP, "monthCode", function () { return "M" + pad(slotOf(this, "PlainDateTime").month, 2); });
getter(PDTP, "dayOfWeek", function () { var f = slotOf(this, "PlainDateTime"); return dayOfWeek(f.year, f.month, f.day); });
getter(PDTP, "dayOfYear", function () { var f = slotOf(this, "PlainDateTime"); return dayOfYear(f.year, f.month, f.day); });
getter(PDTP, "daysInMonth", function () { var f = slotOf(this, "PlainDateTime"); return daysInMonth(f.year, f.month); });
getter(PDTP, "daysInYear", function () { return isLeap(slotOf(this, "PlainDateTime").year) ? 366 : 365; });
getter(PDTP, "monthsInYear", function () { slotOf(this, "PlainDateTime"); return 12; });
getter(PDTP, "inLeapYear", function () { return isLeap(slotOf(this, "PlainDateTime").year); });
function plainDateTimeToString(f) { return plainDateToString(f) + "T" + plainTimeToString(f); }
def(PDTP, "toString", function toString() { return plainDateTimeToString(slotOf(this, "PlainDateTime")); });
def(PDTP, "toJSON", function toJSON() { return plainDateTimeToString(slotOf(this, "PlainDateTime")); });
def(PDTP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainDateTime has no primitive value"); });
def(PDTP, "toPlainDate", function toPlainDate() { var f = slotOf(this, "PlainDateTime"); return new PlainDate(f.year, f.month, f.day); });
def(PDTP, "toPlainTime", function toPlainTime() {
  var f = slotOf(this, "PlainDateTime");
  return new PlainTime(f.hour, f.minute, f.second, f.millisecond, f.microsecond, f.nanosecond);
});
def(PDTP, "equals", function equals(other) {
  var a = slotOf(this, "PlainDateTime"), b = slotOf(PlainDateTime.from(other), "PlainDateTime");
  return plainDateTimeToString(a) === plainDateTimeToString(b);
});
def(PDTP, "with", function withFields(o) {
  if (!isObjectLike(o)) throw new TypeError("options must be an object");
  var f = slotOf(this, "PlainDateTime");
  function pick(k) { return o[k] === undefined ? f[k] : o[k]; }
  return new PlainDateTime(pick("year"), pick("month"), pick("day"), pick("hour"), pick("minute"),
    pick("second"), pick("millisecond"), pick("microsecond"), pick("nanosecond"));
});
function addToDateTime(f, dur, subtract) {
  var s = subtract ? -1 : 1;
  var totalNsTime = timeToNs(f) + s * durationTimeNs(dur);
  var dayShift = Math.floor(totalNsTime / 86400e9);
  var t = nsToTime(totalNsTime);
  var d = addToDate(f, dur, subtract);
  var shifted = isoFromEpochDay(epochDayFromISO(d.year, d.month, d.day) + dayShift);
  return { date: shifted, time: t };
}
def(PDTP, "add", function add(dur) {
  var r = addToDateTime(slotOf(this, "PlainDateTime"), Duration.from(dur), false);
  return new PlainDateTime(r.date.year, r.date.month, r.date.day, r.time.hour, r.time.minute, r.time.second,
    r.time.millisecond, r.time.microsecond, r.time.nanosecond);
});
def(PDTP, "subtract", function subtract(dur) {
  var r = addToDateTime(slotOf(this, "PlainDateTime"), Duration.from(dur), true);
  return new PlainDateTime(r.date.year, r.date.month, r.date.day, r.time.hour, r.time.minute, r.time.second,
    r.time.millisecond, r.time.microsecond, r.time.nanosecond);
});
def(PlainDateTime, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    var s = item[$slot];
    if (s && s.kind === "PlainDateTime") {
      return new PlainDateTime(s.year, s.month, s.day, s.hour, s.minute, s.second, s.millisecond, s.microsecond, s.nanosecond);
    }
    if (s && s.kind === "PlainDate") return new PlainDateTime(s.year, s.month, s.day);
    if (item.year === undefined || item.day === undefined) throw new TypeError("PlainDateTime needs year, month and day");
    var mo = item.month;
    if (mo === undefined && typeof item.monthCode === "string") mo = Number(item.monthCode.slice(1));
    toCalendarId(item.calendar);
    return new PlainDateTime(item.year, mo, item.day, item.hour, item.minute, item.second,
      item.millisecond, item.microsecond, item.nanosecond);
  }
  if (typeof item === "symbol") throw new TypeError("cannot convert a symbol to a PlainDateTime");
  var str = String(item);
  var ti = str.indexOf("T");
  var dm = DATE_RE.exec(ti < 0 ? str : str.slice(0, ti));
  if (!dm) throw new RangeError("invalid ISO date-time string: " + str);
  checkExtendedYear(dm[1]);
  if (ti < 0) return new PlainDateTime(Number(dm[1]), Number(dm[2]), Number(dm[3]));
  var t = parseTimeParts(str.slice(ti + 1));
  return new PlainDateTime(Number(dm[1]), Number(dm[2]), Number(dm[3]), t.hour, t.minute, t.second,
    t.millisecond, t.microsecond, t.nanosecond);
});
def(PlainDateTime, "compare", function compare(a, b) {
  var x = slotOf(PlainDateTime.from(a), "PlainDateTime"), y = slotOf(PlainDateTime.from(b), "PlainDateTime");
  var dx = epochDayFromISO(x.year, x.month, x.day), dy = epochDayFromISO(y.year, y.month, y.day);
  if (dx !== dy) return dx < dy ? -1 : 1;
  var tx = timeToNs(x), ty = timeToNs(y);
  return tx < ty ? -1 : tx > ty ? 1 : 0;
});

// --- Temporal.Instant --------------------------------------------------------
// The epoch value is a BigInt: nanoseconds since 1970 run past 2^53 within a
// few months of the epoch, so a Number would lose the low digits outright.
var NS_PER_DAY = 86400000000000n;
var MAX_INSTANT_NS = 8640000000000000000000n; // +/- 1e8 days
function rejectInstant(ns) {
  if (ns > MAX_INSTANT_NS || ns < -MAX_INSTANT_NS) throw new RangeError("Instant outside the representable range");
}
function Instant(ns) {
  if (!new.target) throw new TypeError("Temporal.Instant must be called with new");
  if (typeof ns !== "bigint") throw new TypeError("epochNanoseconds must be a BigInt");
  rejectInstant(ns);
  setSlot(this, "Instant", { ns: ns });
}
var IP = Instant.prototype;
tag(IP, "Temporal.Instant");
getter(IP, "epochNanoseconds", function () { return slotOf(this, "Instant").ns; });
getter(IP, "epochMilliseconds", function () {
  var ns = slotOf(this, "Instant").ns;
  var ms = ns / 1000000n;
  if (ns < 0n && ns % 1000000n !== 0n) ms -= 1n;
  return Number(ms);
});
def(IP, "valueOf", function valueOf() { throw new TypeError("Temporal.Instant has no primitive value"); });
def(IP, "equals", function equals(other) {
  return slotOf(this, "Instant").ns === slotOf(Instant.from(other), "Instant").ns;
});
def(IP, "add", function add(dur) {
  var d = Duration.from(dur);
  var f = durationFields(d);
  if (f.years || f.months || f.weeks || f.days) throw new RangeError("Instant arithmetic takes time units only");
  return new Instant(slotOf(this, "Instant").ns + BigInt(durationTimeNs(d)));
});
def(IP, "subtract", function subtract(dur) {
  var d = Duration.from(dur);
  var f = durationFields(d);
  if (f.years || f.months || f.weeks || f.days) throw new RangeError("Instant arithmetic takes time units only");
  return new Instant(slotOf(this, "Instant").ns - BigInt(durationTimeNs(d)));
});
function instantToString(ns) {
  var days = ns / NS_PER_DAY;
  var rem = ns % NS_PER_DAY;
  if (rem < 0n) { days -= 1n; rem += NS_PER_DAY; }
  var date = isoFromEpochDay(Number(days));
  var t = nsToTime(Number(rem));
  return plainDateToString(date) + "T" + plainTimeToString(t) + "Z";
}
def(IP, "toString", function toString() { return instantToString(slotOf(this, "Instant").ns); });
def(IP, "toJSON", function toJSON() { return instantToString(slotOf(this, "Instant").ns); });
def(Instant, "fromEpochMilliseconds", function fromEpochMilliseconds(ms) {
  return new Instant(BigInt(toIntegerWithTruncation(ms, "epochMilliseconds")) * 1000000n);
});
def(Instant, "fromEpochNanoseconds", function fromEpochNanoseconds(ns) {
  if (typeof ns !== "bigint") throw new TypeError("epochNanoseconds must be a BigInt");
  return new Instant(ns);
});
var INSTANT_RE = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})$/i;
def(Instant, "from", function from(item) {
  if (item !== null && typeof item === "object" && item[$slot] && item[$slot].kind === "Instant") {
    return new Instant(item[$slot].ns);
  }
  var str = String(item);
  var m = INSTANT_RE.exec(str);
  if (!m) throw new RangeError("invalid instant string: " + str);
  var frac = m[7] ? (m[7] + "000000000").slice(0, 9) : "000000000";
  var days = BigInt(epochDayFromISO(Number(m[1]), Number(m[2]), Number(m[3])));
  var ns = days * NS_PER_DAY
    + BigInt(Number(m[4])) * 3600000000000n + BigInt(Number(m[5])) * 60000000000n
    + BigInt(Number(m[6] || 0)) * 1000000000n + BigInt(Number(frac));
  var off = m[8];
  if (off.toUpperCase() !== "Z") {
    var sign = off[0] === "-" ? 1n : -1n;
    var oh = BigInt(Number(off.slice(1, 3))), om = BigInt(Number(off.slice(-2)));
    ns += sign * (oh * 3600000000000n + om * 60000000000n);
  }
  return new Instant(ns);
});
def(Instant, "compare", function compare(a, b) {
  var x = slotOf(Instant.from(a), "Instant").ns, y = slotOf(Instant.from(b), "Instant").ns;
  return x < y ? -1 : x > y ? 1 : 0;
});

// --- Temporal.Now ------------------------------------------------------------
var Now = {};
tag(Now, "Temporal.Now");
def(Now, "instant", function instant() { return new Instant(BigInt(Date.now()) * 1000000n); });
def(Now, "plainDateTimeISO", function plainDateTimeISO() {
  var ms = Date.now();
  var days = Math.floor(ms / 86400000);
  var d = isoFromEpochDay(days);
  var t = nsToTime((ms - days * 86400000) * 1e6);
  return new PlainDateTime(d.year, d.month, d.day, t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(Now, "plainDateISO", function plainDateISO() {
  var d = isoFromEpochDay(Math.floor(Date.now() / 86400000));
  return new PlainDate(d.year, d.month, d.day);
});
def(Now, "plainTimeISO", function plainTimeISO() { return Now.plainDateTimeISO().toPlainTime(); });

// --- Temporal.PlainYearMonth -------------------------------------------------
// A month in a year, with a reference DAY kept out of sight: the spec stores one
// so that arithmetic and comparison have a concrete date to work from, and it is
// 1 for the ISO calendar.
function PlainYearMonth(y, m, cal, ref) {
  if (!new.target) throw new TypeError("Temporal.PlainYearMonth must be called with new");
  y = toIntegerWithTruncation(y, "year"); m = toIntegerWithTruncation(m, "month");
  var day = ref === undefined ? 1 : toIntegerWithTruncation(ref, "referenceISODay");
  rejectISODate(y, m, day);
  setSlot(this, "PlainYearMonth", { year: y, month: m, day: day });
}
var YMP = PlainYearMonth.prototype;
tag(YMP, "Temporal.PlainYearMonth");
getter(YMP, "year", function () { return slotOf(this, "PlainYearMonth").year; });
getter(YMP, "month", function () { return slotOf(this, "PlainYearMonth").month; });
getter(YMP, "monthCode", function () { return "M" + pad(slotOf(this, "PlainYearMonth").month, 2); });
getter(YMP, "daysInMonth", function () { var f = slotOf(this, "PlainYearMonth"); return daysInMonth(f.year, f.month); });
getter(YMP, "daysInYear", function () { return isLeap(slotOf(this, "PlainYearMonth").year) ? 366 : 365; });
getter(YMP, "monthsInYear", function () { slotOf(this, "PlainYearMonth"); return 12; });
getter(YMP, "inLeapYear", function () { return isLeap(slotOf(this, "PlainYearMonth").year); });
function yearMonthToString(f) { return formatYear(f.year) + "-" + pad(f.month, 2); }
def(YMP, "toString", function toString() { return yearMonthToString(slotOf(this, "PlainYearMonth")); });
def(YMP, "toJSON", function toJSON() { return yearMonthToString(slotOf(this, "PlainYearMonth")); });
def(YMP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainYearMonth has no primitive value"); });
def(YMP, "equals", function equals(other) {
  var a = slotOf(this, "PlainYearMonth"), b = slotOf(PlainYearMonth.from(other), "PlainYearMonth");
  return a.year === b.year && a.month === b.month;
});
def(YMP, "with", function withFields(o) {
  if (!isObjectLike(o)) throw new TypeError("options must be an object");
  var f = slotOf(this, "PlainYearMonth");
  return new PlainYearMonth(o.year === undefined ? f.year : o.year, o.month === undefined ? f.month : o.month);
});
def(YMP, "toPlainDate", function toPlainDate(item) {
  if (item === null || typeof item !== "object") throw new TypeError("toPlainDate needs a day");
  var f = slotOf(this, "PlainYearMonth");
  return new PlainDate(f.year, f.month, item.day);
});
function addYearMonth(f, dur, subtract) {
  var s = subtract ? -1 : 1;
  var d = durationFields(dur);
  var y = f.year + s * d.years;
  var m = f.month + s * d.months;
  y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  return new PlainYearMonth(y, m);
}
def(YMP, "add", function add(dur) { return addYearMonth(slotOf(this, "PlainYearMonth"), Duration.from(dur), false); });
def(YMP, "subtract", function subtract(dur) { return addYearMonth(slotOf(this, "PlainYearMonth"), Duration.from(dur), true); });
def(YMP, "until", function until(other) {
  var a = slotOf(this, "PlainYearMonth"), b = slotOf(PlainYearMonth.from(other), "PlainYearMonth");
  return new Duration(0, (b.year * 12 + b.month) - (a.year * 12 + a.month));
});
def(YMP, "since", function since(other) {
  var a = slotOf(this, "PlainYearMonth"), b = slotOf(PlainYearMonth.from(other), "PlainYearMonth");
  return new Duration(0, (a.year * 12 + a.month) - (b.year * 12 + b.month));
});
var YM_RE = /^([+-]\d{6}|\d{4})-(\d{2})$/;
def(PlainYearMonth, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    var s = item[$slot];
    if (s && s.kind === "PlainYearMonth") return new PlainYearMonth(s.year, s.month, undefined, s.day);
    if (s && (s.kind === "PlainDate" || s.kind === "PlainDateTime")) return new PlainYearMonth(s.year, s.month);
    if (item.year === undefined) throw new TypeError("PlainYearMonth needs a year");
    var mo = item.month;
    if (mo === undefined && typeof item.monthCode === "string") mo = Number(item.monthCode.slice(1));
    if (mo === undefined) throw new TypeError("PlainYearMonth needs a month");
    toCalendarId(item.calendar);
    return new PlainYearMonth(item.year, mo);
  }
  if (typeof item === "symbol") throw new TypeError("cannot convert a symbol to a PlainYearMonth");
  var str = String(item);
  var m = YM_RE.exec(str);
  if (m) {
    checkExtendedYear(m[1]);
    return new PlainYearMonth(Number(m[1]), Number(m[2]));
  }
  var dm = DATE_RE.exec(str.indexOf("T") < 0 ? str : str.slice(0, str.indexOf("T")));
  if (!dm) throw new RangeError("invalid ISO year-month string: " + str);
  checkExtendedYear(dm[1]);
  return new PlainYearMonth(Number(dm[1]), Number(dm[2]));
});
def(PlainYearMonth, "compare", function compare(a, b) {
  var x = slotOf(PlainYearMonth.from(a), "PlainYearMonth"), y = slotOf(PlainYearMonth.from(b), "PlainYearMonth");
  var kx = x.year * 12 + x.month, ky = y.year * 12 + y.month;
  return kx < ky ? -1 : kx > ky ? 1 : 0;
});

// --- Temporal.PlainMonthDay --------------------------------------------------
// A month and day with no year, for recurring dates. The reference YEAR is 1972:
// the spec picks a leap year so that 02-29 is representable.
function PlainMonthDay(m, d, cal, refYear) {
  if (!new.target) throw new TypeError("Temporal.PlainMonthDay must be called with new");
  m = toIntegerWithTruncation(m, "month"); d = toIntegerWithTruncation(d, "day");
  var y = refYear === undefined ? 1972 : toIntegerWithTruncation(refYear, "referenceISOYear");
  rejectISODate(y, m, d);
  setSlot(this, "PlainMonthDay", { year: y, month: m, day: d });
}
var MDP = PlainMonthDay.prototype;
tag(MDP, "Temporal.PlainMonthDay");
getter(MDP, "monthCode", function () { return "M" + pad(slotOf(this, "PlainMonthDay").month, 2); });
getter(MDP, "day", function () { return slotOf(this, "PlainMonthDay").day; });
function monthDayToString(f) {
  var base = pad(f.month, 2) + "-" + pad(f.day, 2);
  // the reference year is only emitted when it is not the default 1972, which is
  // how a round trip keeps a date that only exists in some years
  return f.year === 1972 ? base : formatYear(f.year) + "-" + base;
}
def(MDP, "toString", function toString() { return monthDayToString(slotOf(this, "PlainMonthDay")); });
def(MDP, "toJSON", function toJSON() { return monthDayToString(slotOf(this, "PlainMonthDay")); });
def(MDP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainMonthDay has no primitive value"); });
def(MDP, "equals", function equals(other) {
  var a = slotOf(this, "PlainMonthDay"), b = slotOf(PlainMonthDay.from(other), "PlainMonthDay");
  return a.year === b.year && a.month === b.month && a.day === b.day;
});
def(MDP, "with", function withFields(o) {
  if (!isObjectLike(o)) throw new TypeError("options must be an object");
  var f = slotOf(this, "PlainMonthDay");
  var mo = o.month;
  if (mo === undefined && typeof o.monthCode === "string") mo = Number(o.monthCode.slice(1));
  return new PlainMonthDay(mo === undefined ? f.month : mo, o.day === undefined ? f.day : o.day, undefined, f.year);
});
def(MDP, "toPlainDate", function toPlainDate(item) {
  if (item === null || typeof item !== "object" || item.year === undefined) throw new TypeError("toPlainDate needs a year");
  var f = slotOf(this, "PlainMonthDay");
  return new PlainDate(item.year, f.month, f.day);
});
var MD_RE = /^(?:--)?(\d{2})-(\d{2})$/;
def(PlainMonthDay, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    var s = item[$slot];
    if (s && s.kind === "PlainMonthDay") return new PlainMonthDay(s.month, s.day, undefined, s.year);
    if (s && (s.kind === "PlainDate" || s.kind === "PlainDateTime")) return new PlainMonthDay(s.month, s.day);
    if (item.day === undefined) throw new TypeError("PlainMonthDay needs a day");
    var mo = item.month;
    if (mo === undefined && typeof item.monthCode === "string") mo = Number(item.monthCode.slice(1));
    if (mo === undefined) throw new TypeError("PlainMonthDay needs a month");
    toCalendarId(item.calendar);
    return new PlainMonthDay(mo, item.day, undefined, item.year);
  }
  if (typeof item === "symbol") throw new TypeError("cannot convert a symbol to a PlainMonthDay");
  var str = String(item);
  var m = MD_RE.exec(str);
  if (m) return new PlainMonthDay(Number(m[1]), Number(m[2]));
  var dm = DATE_RE.exec(str.indexOf("T") < 0 ? str : str.slice(0, str.indexOf("T")));
  if (!dm) throw new RangeError("invalid ISO month-day string: " + str);
  checkExtendedYear(dm[1]);
  return new PlainMonthDay(Number(dm[2]), Number(dm[3]), undefined, Number(dm[1]));
});

// --- Time zones --------------------------------------------------------------
// UTC and fixed offsets only. Named IANA zones need a tz database, which this
// engine does not carry; `from` REJECTS them rather than silently treating
// "America/New_York" as UTC, because a wrong offset is worse than a refusal.
function parseOffsetNs(id) {
  if (id === "UTC" || id === "utc") return 0;
  var m = /^([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/.exec(id);
  if (!m) return null;
  var sign = m[1] === "-" ? -1 : 1;
  var h = Number(m[2]), mi = Number(m[3] || 0), sec = Number(m[4] || 0);
  if (h > 23 || mi > 59 || sec > 59) return null;
  return sign * ((h * 60 + mi) * 60 + sec) * 1e9;
}
function formatOffset(ns) {
  var sign = ns < 0 ? "-" : "+";
  var t = Math.abs(ns) / 1e9;
  var h = Math.floor(t / 3600), mi = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60);
  return sign + pad(h, 2) + ":" + pad(mi, 2) + (sec ? ":" + pad(sec, 2) : "");
}
function canonicalZone(id) {
  if (id === "UTC" || id === "utc") return "UTC";
  var ns = parseOffsetNs(id);
  if (ns === null) {
    throw new RangeError("unsupported time zone: " + id + " (only UTC and fixed offsets are implemented)");
  }
  return formatOffset(ns);
}

// --- Temporal.ZonedDateTime --------------------------------------------------
function ZonedDateTime(ns, tz) {
  if (!new.target) throw new TypeError("Temporal.ZonedDateTime must be called with new");
  if (typeof ns !== "bigint") throw new TypeError("epochNanoseconds must be a BigInt");
  if (tz === undefined) throw new TypeError("ZonedDateTime needs a time zone");
  rejectInstant(ns);
  setSlot(this, "ZonedDateTime", { ns: ns, tz: canonicalZone(String(tz)) });
}
var ZP = ZonedDateTime.prototype;
tag(ZP, "Temporal.ZonedDateTime");
function zonedLocal(f) {
  var off = BigInt(parseOffsetNs(f.tz) || 0);
  var local = f.ns + off;
  var days = local / NS_PER_DAY, rem = local % NS_PER_DAY;
  if (rem < 0n) { days -= 1n; rem += NS_PER_DAY; }
  var d = isoFromEpochDay(Number(days));
  var t = nsToTime(Number(rem));
  return { year: d.year, month: d.month, day: d.day, hour: t.hour, minute: t.minute, second: t.second,
    millisecond: t.millisecond, microsecond: t.microsecond, nanosecond: t.nanosecond };
}
getter(ZP, "epochNanoseconds", function () { return slotOf(this, "ZonedDateTime").ns; });
getter(ZP, "epochMilliseconds", function () {
  var ns = slotOf(this, "ZonedDateTime").ns;
  var ms = ns / 1000000n;
  if (ns < 0n && ns % 1000000n !== 0n) ms -= 1n;
  return Number(ms);
});
getter(ZP, "timeZoneId", function () { return slotOf(this, "ZonedDateTime").tz; });
getter(ZP, "offset", function () { return formatOffset(parseOffsetNs(slotOf(this, "ZonedDateTime").tz) || 0); });
getter(ZP, "offsetNanoseconds", function () { return parseOffsetNs(slotOf(this, "ZonedDateTime").tz) || 0; });
["year", "month", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond"]
  .forEach(function (k) { getter(ZP, k, function () { return zonedLocal(slotOf(this, "ZonedDateTime"))[k]; }); });
getter(ZP, "monthCode", function () { return "M" + pad(zonedLocal(slotOf(this, "ZonedDateTime")).month, 2); });
getter(ZP, "dayOfWeek", function () { var f = zonedLocal(slotOf(this, "ZonedDateTime")); return dayOfWeek(f.year, f.month, f.day); });
getter(ZP, "dayOfYear", function () { var f = zonedLocal(slotOf(this, "ZonedDateTime")); return dayOfYear(f.year, f.month, f.day); });
getter(ZP, "daysInMonth", function () { var f = zonedLocal(slotOf(this, "ZonedDateTime")); return daysInMonth(f.year, f.month); });
getter(ZP, "daysInYear", function () { return isLeap(zonedLocal(slotOf(this, "ZonedDateTime")).year) ? 366 : 365; });
getter(ZP, "monthsInYear", function () { slotOf(this, "ZonedDateTime"); return 12; });
getter(ZP, "inLeapYear", function () { return isLeap(zonedLocal(slotOf(this, "ZonedDateTime")).year); });
getter(ZP, "hoursInDay", function () { slotOf(this, "ZonedDateTime"); return 24; });
function zonedToString(f) {
  var l = zonedLocal(f);
  var off = f.tz === "UTC" ? "+00:00" : formatOffset(parseOffsetNs(f.tz) || 0);
  return plainDateToString(l) + "T" + plainTimeToString(l) + off + "[" + f.tz + "]";
}
def(ZP, "toString", function toString() { return zonedToString(slotOf(this, "ZonedDateTime")); });
def(ZP, "toJSON", function toJSON() { return zonedToString(slotOf(this, "ZonedDateTime")); });
def(ZP, "valueOf", function valueOf() { throw new TypeError("Temporal.ZonedDateTime has no primitive value"); });
def(ZP, "equals", function equals(other) {
  var a = slotOf(this, "ZonedDateTime"), b = slotOf(ZonedDateTime.from(other), "ZonedDateTime");
  return a.ns === b.ns && a.tz === b.tz;
});
def(ZP, "toInstant", function toInstant() { return new Instant(slotOf(this, "ZonedDateTime").ns); });
def(ZP, "toPlainDate", function toPlainDate() {
  var l = zonedLocal(slotOf(this, "ZonedDateTime"));
  return new PlainDate(l.year, l.month, l.day);
});
def(ZP, "toPlainTime", function toPlainTime() {
  var l = zonedLocal(slotOf(this, "ZonedDateTime"));
  return new PlainTime(l.hour, l.minute, l.second, l.millisecond, l.microsecond, l.nanosecond);
});
def(ZP, "toPlainDateTime", function toPlainDateTime() {
  var l = zonedLocal(slotOf(this, "ZonedDateTime"));
  return new PlainDateTime(l.year, l.month, l.day, l.hour, l.minute, l.second, l.millisecond, l.microsecond, l.nanosecond);
});
def(ZP, "withTimeZone", function withTimeZone(tz) { return new ZonedDateTime(slotOf(this, "ZonedDateTime").ns, tz); });
def(ZP, "add", function add(dur) {
  var f = slotOf(this, "ZonedDateTime");
  var d = Duration.from(dur);
  var df = durationFields(d);
  // date units act on the LOCAL wall clock, time units on the exact instant
  var l = zonedLocal(f);
  var shifted = addToDate(l, d, false);
  var off = BigInt(parseOffsetNs(f.tz) || 0);
  var localNs = BigInt(epochDayFromISO(shifted.year, shifted.month, shifted.day)) * NS_PER_DAY + BigInt(timeToNs(l));
  return new ZonedDateTime(localNs - off + BigInt(durationTimeNs(d)), f.tz);
});
def(ZP, "subtract", function subtract(dur) {
  var f = slotOf(this, "ZonedDateTime");
  var d = Duration.from(dur);
  var l = zonedLocal(f);
  var shifted = addToDate(l, d, true);
  var off = BigInt(parseOffsetNs(f.tz) || 0);
  var localNs = BigInt(epochDayFromISO(shifted.year, shifted.month, shifted.day)) * NS_PER_DAY + BigInt(timeToNs(l));
  return new ZonedDateTime(localNs - off - BigInt(durationTimeNs(d)), f.tz);
});
var ZDT_RE = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?(?:\[([^\]]+)\])?$/i;
def(ZonedDateTime, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    var s = item[$slot];
    if (s && s.kind === "ZonedDateTime") return new ZonedDateTime(s.ns, s.tz);
    if (item.timeZone === undefined) throw new TypeError("ZonedDateTime needs a timeZone");
    var tz = canonicalZone(String(item.timeZone));
    var off = BigInt(parseOffsetNs(tz) || 0);
    var pd = new PlainDateTime(item.year, item.month, item.day, item.hour, item.minute, item.second,
      item.millisecond, item.microsecond, item.nanosecond);
    var pf = slotOf(pd, "PlainDateTime");
    return new ZonedDateTime(BigInt(epochDayFromISO(pf.year, pf.month, pf.day)) * NS_PER_DAY + BigInt(timeToNs(pf)) - off, tz);
  }
  var str = String(item);
  var m = ZDT_RE.exec(str);
  if (!m) throw new RangeError("invalid ZonedDateTime string: " + str);
  if (!m[9]) throw new RangeError("ZonedDateTime string needs a [timeZone] annotation");
  var zone = canonicalZone(m[9]);
  var frac = m[7] ? (m[7] + "000000000").slice(0, 9) : "000000000";
  var localNs = BigInt(epochDayFromISO(Number(m[1]), Number(m[2]), Number(m[3]))) * NS_PER_DAY
    + BigInt(Number(m[4])) * 3600000000000n + BigInt(Number(m[5])) * 60000000000n
    + BigInt(Number(m[6] || 0)) * 1000000000n + BigInt(Number(frac));
  // the offset in the string wins for locating the instant; the annotation names
  // the zone the result is expressed in
  var offNs = m[8] && m[8].toUpperCase() !== "Z" ? parseOffsetNs(m[8].replace(":", "")) : 0;
  if (m[8] === undefined) offNs = parseOffsetNs(zone) || 0;
  return new ZonedDateTime(localNs - BigInt(offNs || 0), zone);
});
def(ZonedDateTime, "compare", function compare(a, b) {
  var x = slotOf(ZonedDateTime.from(a), "ZonedDateTime").ns, y = slotOf(ZonedDateTime.from(b), "ZonedDateTime").ns;
  return x < y ? -1 : x > y ? 1 : 0;
});
def(Now, "zonedDateTimeISO", function zonedDateTimeISO(tz) {
  return new ZonedDateTime(BigInt(Date.now()) * 1000000n, tz === undefined ? "UTC" : tz);
});
def(Now, "timeZoneId", function timeZoneId() { return "UTC"; });
def(IP, "toZonedDateTimeISO", function toZonedDateTimeISO(tz) {
  return new ZonedDateTime(slotOf(this, "Instant").ns, tz);
});

// Every plain type reports the ISO calendar. Named calendars are not
// implemented, so this is the only value it can honestly take.
[PDP, PDTP, YMP, MDP, ZP].forEach(function (proto) {
  getter(proto, "calendarId", function () { return "iso8601"; });
});

// --- until / since / round ---------------------------------------------------
// Units, largest first, with the nanoseconds each is worth. Calendar units are
// absent on purpose: their length depends on the date they are measured from,
// and the types that can answer that (PlainDate, PlainYearMonth) implement
// until/since themselves above.
var TIME_UNITS = [
  ["hour", 3600e9], ["minute", 60e9], ["second", 1e9],
  ["millisecond", 1e6], ["microsecond", 1e3], ["nanosecond", 1]
];
function unitIndex(name) {
  for (var i = 0; i < TIME_UNITS.length; i++) { if (TIME_UNITS[i][0] === name) return i; }
  return -1;
}
function readUnitOption(options, key, dflt) {
  if (options === undefined) return dflt;
  if (!isObjectLike(options)) throw new TypeError("options must be an object");
  var v = options[key];
  if (v === undefined) return dflt;
  v = String(v);
  if (v.charAt(v.length - 1) === "s") v = v.slice(0, -1);
  if (unitIndex(v) < 0) throw new RangeError("unsupported unit: " + v);
  return v;
}
function readRoundingIncrement(options) {
  if (options === undefined || !isObjectLike(options)) return 1;
  var v = options.roundingIncrement;
  if (v === undefined) return 1;
  var n = Number(v);
  if (!Number.isFinite(n) || n < 1 || Math.trunc(n) !== n) throw new RangeError("roundingIncrement must be a positive integer");
  return n;
}
function readRoundingMode(options) {
  if (options === undefined || !isObjectLike(options)) return "halfExpand";
  var v = options.roundingMode;
  if (v === undefined) return "halfExpand";
  v = String(v);
  if (["ceil", "floor", "trunc", "halfExpand", "expand", "halfCeil", "halfFloor", "halfTrunc", "halfEven"].indexOf(v) < 0) {
    throw new RangeError("unsupported roundingMode: " + v);
  }
  return v;
}
function applyRounding(value, increment, mode) {
  var q = value / increment;
  var r;
  switch (mode) {
    case "ceil": r = Math.ceil(q); break;
    case "floor": r = Math.floor(q); break;
    case "trunc": r = Math.trunc(q); break;
    case "expand": r = q < 0 ? Math.floor(q) : Math.ceil(q); break;
    case "halfCeil": r = Math.floor(q + 0.5); break;
    case "halfFloor": r = Math.ceil(q - 0.5); break;
    case "halfTrunc": r = q < 0 ? Math.ceil(q - 0.5) : Math.floor(q + 0.5); break;
    case "halfEven": {
      var fl = Math.floor(q);
      var diff = q - fl;
      if (diff > 0.5) r = fl + 1;
      else if (diff < 0.5) r = fl;
      else r = fl % 2 === 0 ? fl : fl + 1;
      break;
    }
    default: r = q < 0 ? -Math.round(-q) : Math.round(q);
  }
  return r * increment;
}
// Split a nanosecond difference into a Duration down to `largest`, then round
// the remainder at `smallest`.
function nsToDuration(totalNs, largest, smallest, increment, mode) {
  var li = unitIndex(largest), si = unitIndex(smallest);
  if (si < li) throw new RangeError("smallestUnit is larger than largestUnit");
  var sign = totalNs < 0 ? -1 : 1;
  var rest = Math.abs(totalNs);
  rest = applyRounding(rest, TIME_UNITS[si][1] * increment, mode);
  var f = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 };
  var plural = { hour: "hours", minute: "minutes", second: "seconds", millisecond: "milliseconds", microsecond: "microseconds", nanosecond: "nanoseconds" };
  for (var i = li; i < TIME_UNITS.length; i++) {
    var w = TIME_UNITS[i][1];
    var n = Math.floor(rest / w);
    rest -= n * w;
    f[plural[TIME_UNITS[i][0]]] = sign * n;
  }
  return makeDuration(f);
}
function diffTimeLike(aNs, bNs, options, reverse) {
  var largest = readUnitOption(options, "largestUnit", "hour");
  var smallest = readUnitOption(options, "smallestUnit", "nanosecond");
  var inc = readRoundingIncrement(options), mode = readRoundingMode(options);
  var delta = reverse ? aNs - bNs : bNs - aNs;
  return nsToDuration(delta, largest, smallest, inc, mode);
}
def(PTP, "until", function until(other, options) {
  return diffTimeLike(timeToNs(slotOf(this, "PlainTime")), timeToNs(slotOf(PlainTime.from(other), "PlainTime")), options, false);
});
def(PTP, "since", function since(other, options) {
  return diffTimeLike(timeToNs(slotOf(this, "PlainTime")), timeToNs(slotOf(PlainTime.from(other), "PlainTime")), options, true);
});
def(PTP, "round", function round(options) {
  if (options === undefined) throw new TypeError("round needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : options;
  var smallest = readUnitOption(opts, "smallestUnit", undefined);
  if (smallest === undefined) throw new RangeError("round needs a smallestUnit");
  var t = nsToTime(applyRounding(timeToNs(slotOf(this, "PlainTime")),
    TIME_UNITS[unitIndex(smallest)][1] * readRoundingIncrement(opts), readRoundingMode(opts)));
  return new PlainTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
function instantNsOf(o, kind) { return slotOf(o, kind).ns; }
def(IP, "until", function until(other, options) {
  return diffTimeLike(Number(instantNsOf(this, "Instant")), Number(slotOf(Instant.from(other), "Instant").ns), options, false);
});
def(IP, "since", function since(other, options) {
  return diffTimeLike(Number(instantNsOf(this, "Instant")), Number(slotOf(Instant.from(other), "Instant").ns), options, true);
});
def(IP, "round", function round(options) {
  if (options === undefined) throw new TypeError("round needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : options;
  var smallest = readUnitOption(opts, "smallestUnit", undefined);
  if (smallest === undefined) throw new RangeError("round needs a smallestUnit");
  var w = TIME_UNITS[unitIndex(smallest)][1] * readRoundingIncrement(opts);
  return new Instant(BigInt(applyRounding(Number(slotOf(this, "Instant").ns), w, readRoundingMode(opts))));
});
function dateTimeTotalNs(f) { return epochDayFromISO(f.year, f.month, f.day) * 86400e9 + timeToNs(f); }
def(PDTP, "until", function until(other, options) {
  var a = dateTimeTotalNs(slotOf(this, "PlainDateTime")), b = dateTimeTotalNs(slotOf(PlainDateTime.from(other), "PlainDateTime"));
  return diffTimeLike(a, b, options, false);
});
def(PDTP, "since", function since(other, options) {
  var a = dateTimeTotalNs(slotOf(this, "PlainDateTime")), b = dateTimeTotalNs(slotOf(PlainDateTime.from(other), "PlainDateTime"));
  return diffTimeLike(a, b, options, true);
});
def(PDTP, "round", function round(options) {
  if (options === undefined) throw new TypeError("round needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : options;
  var smallest = readUnitOption(opts, "smallestUnit", undefined);
  if (smallest === undefined) throw new RangeError("round needs a smallestUnit");
  var f = slotOf(this, "PlainDateTime");
  var w = TIME_UNITS[unitIndex(smallest)][1] * readRoundingIncrement(opts);
  var total = applyRounding(dateTimeTotalNs(f), w, readRoundingMode(opts));
  var days = Math.floor(total / 86400e9);
  var d = isoFromEpochDay(days);
  var t = nsToTime(total - days * 86400e9);
  return new PlainDateTime(d.year, d.month, d.day, t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(ZP, "until", function until(other, options) {
  return diffTimeLike(Number(slotOf(this, "ZonedDateTime").ns), Number(slotOf(ZonedDateTime.from(other), "ZonedDateTime").ns), options, false);
});
def(ZP, "since", function since(other, options) {
  return diffTimeLike(Number(slotOf(this, "ZonedDateTime").ns), Number(slotOf(ZonedDateTime.from(other), "ZonedDateTime").ns), options, true);
});
def(ZP, "round", function round(options) {
  if (options === undefined) throw new TypeError("round needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : options;
  var smallest = readUnitOption(opts, "smallestUnit", undefined);
  if (smallest === undefined) throw new RangeError("round needs a smallestUnit");
  var f = slotOf(this, "ZonedDateTime");
  var w = TIME_UNITS[unitIndex(smallest)][1] * readRoundingIncrement(opts);
  return new ZonedDateTime(BigInt(applyRounding(Number(f.ns), w, readRoundingMode(opts))), f.tz);
});

var Temporal = {};
tag(Temporal, "Temporal");
def(Temporal, "Duration", Duration);
def(Temporal, "PlainDate", PlainDate);
def(Temporal, "PlainTime", PlainTime);
def(Temporal, "PlainDateTime", PlainDateTime);
def(Temporal, "PlainYearMonth", PlainYearMonth);
def(Temporal, "PlainMonthDay", PlainMonthDay);
def(Temporal, "Instant", Instant);
def(Temporal, "ZonedDateTime", ZonedDateTime);
def(Temporal, "Now", Now);
globalThis.Temporal = Temporal;
})();

// Temporal's methods are built-in methods: callable, not constructable. The
// CLASSES stay constructors, so only their statics and prototypes are walked.
(function () {
  var names = Object.getOwnPropertyNames(Temporal);
  for (var i = 0; i < names.length; i++) {
    var c = Temporal[names[i]];
    if (typeof c !== "function") { __markBuiltinMethods(c); continue; }
    __markBuiltinMethods(c);
    __markBuiltinMethods(c.prototype);
  }
})();
