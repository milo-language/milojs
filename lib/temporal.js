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
  // the spec names an accessor function "get <prop>", and test262 reads that off
  // the descriptor; every getter here was an anonymous function with name ""
  Object.defineProperty(fn, "name", { value: "get " + name, writable: false, enumerable: false, configurable: true });
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

// ToNumber, which is not Number(): it throws on a Symbol and on a BigInt where
// the Number function would answer NaN or a value.
function toNumberSpec(v, name) {
  if (typeof v === "symbol") throw new TypeError(name + " must be a number, got a symbol");
  if (typeof v === "bigint") throw new TypeError(name + " must be a number, got a bigint");
  return Number(v);
}
function toIntegerWithTruncation(v, name) {
  var n = toNumberSpec(v, name);
  if (Number.isNaN(n)) throw new RangeError(name + " must be a finite number");
  if (!Number.isFinite(n)) throw new RangeError(name + " must be a finite number");
  return Math.trunc(n);
}
function requireInt(v, name, dflt) {
  if (v === undefined) return dflt;
  return toIntegerWithTruncation(v, name);
}
// ToIntegerIfIntegral, which is NOT ToIntegerWithTruncation: a Duration field of
// 1.5 is a RangeError rather than a silent truncation to 1. Date fields truncate;
// duration fields do not.
function toIntegerIfIntegral(v, name) {
  var n = toNumberSpec(v, name);
  if (!Number.isFinite(n) || Math.trunc(n) !== n) {
    throw new RangeError(name + " must be an integer, got " + String(v));
  }
  return n === 0 ? 0 : n;
}
function durationInt(v, name, dflt) {
  if (v === undefined) return dflt;
  return toIntegerIfIntegral(v, name);
}
// The spec reads a duration property bag in alphabetical order, and the
// order-of-operations tests compare the exact sequence of gets.
var DURATION_FIELDS = ["days", "hours", "microseconds", "milliseconds", "minutes",
  "months", "nanoseconds", "seconds", "weeks", "years"];
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
// ISODateWithinLimits / ISODateTimeWithinLimits. The representable span is one
// day either side of +/-10^8 days from the epoch, and a bare date is judged at
// NOON, which is why 275760-09-13 is a legal PlainDate but 275760-09-14 is not.
var MIN_EPOCH_DAY = -100000001, MAX_EPOCH_DAY = 100000000;
function rejectDateRange(y, m, d) {
  var day = epochDayFromISO(y, m, d);
  if (day < MIN_EPOCH_DAY || day > MAX_EPOCH_DAY) {
    throw new RangeError("date is outside the representable range: " + formatYear(y) + "-" + pad(m, 2) + "-" + pad(d, 2));
  }
  return day;
}
function rejectDateTimeRange(y, m, d, timeNs) {
  var day = rejectDateRange(y, m, d);
  // On the very first representable day only times after midnight qualify: the
  // limit is an exact nanosecond count, not a whole number of days.
  if (day === MIN_EPOCH_DAY && timeNs <= 0) {
    throw new RangeError("date-time is outside the representable range");
  }
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
    years: durationInt(years, "years", 0), months: durationInt(months, "months", 0),
    weeks: durationInt(weeks, "weeks", 0), days: durationInt(days, "days", 0),
    hours: durationInt(hours, "hours", 0), minutes: durationInt(minutes, "minutes", 0),
    seconds: durationInt(seconds, "seconds", 0), milliseconds: durationInt(milliseconds, "milliseconds", 0),
    microseconds: durationInt(microseconds, "microseconds", 0), nanoseconds: durationInt(nanoseconds, "nanoseconds", 0)
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
  // IsValidDuration. A calendar unit is capped at 2^32 and the whole time part at
  // 2^53 SECONDS, which is the widest span the rest of the arithmetic can carry
  // without losing nanoseconds.
  if (Math.abs(f.years) >= 4294967296 || Math.abs(f.months) >= 4294967296 || Math.abs(f.weeks) >= 4294967296) {
    throw new RangeError("duration field is out of range");
  }
  var secs = f.days * 86400 + f.hours * 3600 + f.minutes * 60 + f.seconds
    + Math.trunc(f.milliseconds / 1e3) + Math.trunc(f.microseconds / 1e6) + Math.trunc(f.nanoseconds / 1e9);
  if (!(Math.abs(secs) < 9007199254740992)) {
    throw new RangeError("duration is out of range");
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
  DURATION_FIELDS.forEach(function (k) { g[k] = o[k] === undefined ? f[k] : toIntegerIfIntegral(o[k], k); });
  return makeDuration(g);
});
def(DP, "toJSON", function toJSON() { return durationToString(this); });
def(DP, "toString", function toString() {
  var opts = optionsObject(arguments[0], "Duration.toString");
  // A duration has no clock, so "minute" is not a legal precision here even
  // though it is for the time-of-day types.
  return durationToString(this, timeStringPrecision(opts, "Duration.toString", false));
});
def(DP, "valueOf", function valueOf() { throw new TypeError("Temporal.Duration has no primitive value"); });

function durationToString(d, p) {
  var f = durationFields(d);
  var days = Math.abs(f.days), hours = Math.abs(f.hours), minutes = Math.abs(f.minutes);
  var secs = Math.abs(f.seconds);
  var frac = Math.abs(f.milliseconds) * 1e6 + Math.abs(f.microseconds) * 1e3 + Math.abs(f.nanoseconds);
  secs += Math.floor(frac / 1e9);
  frac = frac % 1e9;
  var precision = p ? p.digits : "auto";
  if (p && (p.unit !== "nanosecond" || p.increment !== 1)) {
    // Rounding the sub-second part can carry all the way up, but only as far as
    // days: weeks, months and years have no fixed length. The carry also stops
    // at whatever the duration's own largest unit is, so 59.9s at 0 digits is
    // PT60S and not PT1M.
    var start = defaultLargestUnit(f);
    if (allUnitIndex(start) < allUnitIndex("day")) start = "day";
    if (allUnitIndex(start) > allUnitIndex("second")) start = "second";
    // Rounding direction is signed, so the negative half of a duration has to be
    // rounded as a negative number and only then split back into fields.
    var dir = d.sign < 0 ? -1 : 1;
    var rest = Math.abs(applyRounding(dir * (((hours * 60 + minutes) * 60 + secs) * 1e9 + frac), precisionNs(p), p.mode));
    hours = 0; minutes = 0; secs = 0;
    for (var i = allUnitIndex(start); i <= allUnitIndex("second"); i++) {
      var w = ALL_UNITS[i][1];
      var n = Math.floor(rest / w);
      rest -= n * w;
      if (i === allUnitIndex("day")) days += n;
      else if (i === allUnitIndex("hour")) hours = n;
      else if (i === allUnitIndex("minute")) minutes = n;
      else secs = n;
    }
    frac = rest;
  }
  var sign = d.sign < 0 ? "-" : "";
  var date = "";
  if (f.years) date += Math.abs(f.years) + "Y";
  if (f.months) date += Math.abs(f.months) + "M";
  if (f.weeks) date += Math.abs(f.weeks) + "W";
  if (days) date += days + "D";
  var time = "";
  if (hours) time += hours + "H";
  if (minutes) time += minutes + "M";
  // The seconds component appears when it carries information, when there is
  // nothing else to print, or whenever an exact digit count was demanded.
  if (secs || frac || (!date && !hours && !minutes) || precision !== "auto") {
    time += secs + formatSubseconds(frac, precision) + "S";
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
    DURATION_FIELDS.forEach(function (k) { if (item[k] !== undefined) { any = true; g[k] = toIntegerIfIntegral(item[k], k); } else g[k] = 0; });
    if (!any) throw new TypeError("duration needs at least one field");
    return makeDuration(g);
  }
  return durationFromString(requireISOString(item, "Duration"));
});
def(Duration, "compare", function compare(a, b) {
  var one = durationFields(Duration.from(a));
  var two = durationFields(Duration.from(b));
  var relativeTo = readRelativeTo(optionsObject(arguments[2], "Duration.compare"));
  var same = true;
  for (var i = 0; i < DURATION_FIELDS.length; i++) {
    if (one[DURATION_FIELDS[i]] !== two[DURATION_FIELDS[i]]) { same = false; break; }
  }
  if (same) return 0;
  if (relativeTo === undefined && (hasCalendarFields(one) || hasCalendarFields(two))) {
    throw new RangeError("a relativeTo is required to compare durations with years, months or weeks");
  }
  var x, y;
  if (relativeTo === undefined) {
    x = durationExactNs(one); y = durationExactNs(two);
  } else {
    var start = dtOf(relativeTo);
    x = nsBetween(start, addDurationTo(start, one));
    y = nsBetween(start, addDurationTo(start, two));
  }
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
// The spec's ToString, not the String() function: ToString(symbol) is a TypeError
// and String(symbol) is not. Every Temporal entry point that takes a unit, a
// calendar or an ISO string reaches one of these, and test262 checks the symbol
// case at every one of them — they were reporting RangeError ("not a Temporal
// unit") because String() had already turned the symbol into "Symbol(year)".
function toStringSpec(v, what) {
  if (typeof v === "symbol") throw new TypeError(what + " must be a string, got a symbol");
  return String(v);
}
function toDurationUnit(v, what) {
  return unitFromName(toStringSpec(v, what), what, false);
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
  var f = localFieldsOf(o[$slot]);
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
// GetTemporalRelativeToOption. A relativeTo names a time zone or it does not:
// with one it is a ZonedDateTime, without one a PlainDate. A string carrying a
// "Z" but no zone annotation is rejected — it says which instant it means but
// not which calendar day that was.
function readRelativeTo(opts) {
  var r = opts === undefined ? undefined : opts.relativeTo;
  if (r === undefined) return undefined;
  if (isObjectLike(r)) {
    var sl = r[$slot];
    if (sl && (sl.kind === "PlainDate" || sl.kind === "PlainDateTime" || sl.kind === "ZonedDateTime")) return r;
    if (r.timeZone !== undefined) return ZonedDateTime.from(r);
    return PlainDateTime.from(r);
  }
  var str = requireISOString(r, "relativeTo");
  var p = parseTemporalISO(str, "ZonedDateTime");
  if (p.tz !== null && p.tz !== undefined) {
    var zone = canonicalZone(p.tz);
    var offNs = p.offsetNs === null || p.offsetNs === undefined ? (parseOffsetNs(zone) || 0) : p.offsetNs;
    return new ZonedDateTime(BigInt(epochDayFromISO(p.year, p.month, p.day)) * NS_PER_DAY + BigInt(timeToNs(p)) - BigInt(offNs), zone);
  }
  if (p.z) throw new RangeError("relativeTo needs a time zone to go with its UTC designator: " + str);
  return new PlainDate(p.year, p.month, p.day);
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
  var increment = readRoundingIncrement(opts, smallest);
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

// GetOption, spelled out. Every option in this file used to be read as a bare
// property and coerced with String(), which is wrong in three ways at once:
// String(symbol) does not throw where ToString(symbol) must, an invalid value
// was accepted rather than rejected, and an object's toString was reached
// through a path that read it twice.
//
// The spec's order is fixed and observable: read the property, return the
// default if undefined, ToString it (TypeError for a symbol), then check
// membership (RangeError if absent). test262 watches the toString call with an
// observer, so the coercion has to happen exactly once.
function getOption(options, key, allowed, dflt, where) {
  if (options === undefined) return dflt;
  var value = options[key];
  if (value === undefined) return dflt;
  if (typeof value === "symbol") {
    throw new TypeError(where + ": " + key + " must be a string, got a symbol");
  }
  var str = String(value);
  for (var i = 0; i < allowed.length; i++) {
    if (allowed[i] === str) return str;
  }
  throw new RangeError(where + ": " + key + " must be one of " + allowed.join(", ") + ", got " + str);
}

// ToTemporalOverflow. "constrain" clamps an out-of-range field into its month
// (Jan 32 becomes Jan 31); "reject" makes it a RangeError. Nothing in this file
// read the option at all before, so `{ overflow: "bogus" }` was silently
// accepted and so was `{ overflow: null }`.
function toOverflow(options, where) {
  return getOption(options, "overflow", ["constrain", "reject"], "constrain", where);
}

// --- one ISO parser for every Temporal type ----------------------------------
// Each type used to carry its own regex, and not one of them knew about
// ANNOTATIONS — the bracketed suffixes that carry the time zone and the calendar
// and that every Temporal string in the wild ends with. The annotation grammar
// alone is 208 test262 cases, and it needs real validation rather than a
// character class: an unknown annotation is ignored, the SAME annotation marked
// critical with `!` is a RangeError, and a second time zone annotation is a
// RangeError whether or not anything is critical.
//
// Returns { year, month, day, hour, minute, second, millisecond, microsecond,
//           nanosecond, offsetNs, z, tz, calendar, hasTime, hasDate }.
// offsetNs is null when the string carried no offset; `z` distinguishes the "Z"
// spelling, which is not the same as "+00:00" for a ZonedDateTime.
function isoFail(str, what, why) {
  throw new RangeError("invalid " + what + " string: " + str + (why ? " (" + why + ")" : ""));
}
function isDigit(c) { return c >= "0" && c <= "9"; }

// ToTemporal<Type> accepts an Object (a Temporal object or a property bag) or a
// String, and nothing else. A number, a boolean, null, undefined and a BigInt are
// all TypeErrors before any parsing happens, so only a String can ever produce
// the RangeError that says the text did not parse.
function requireISOString(item, what) {
  if (typeof item !== "string") {
    throw new TypeError("cannot convert " + (item === null ? "null" : typeof item) + " to a Temporal." + what);
  }
  return item;
}

// The annotation key grammar: a lowercase alphanumeric run, then any number of
// `-` separated runs. "u-ca" and "foo" are keys; "Foo" and "9foo" are not.
var ANNOT_KEY_RE = /^[a-z_][a-z0-9_-]*$/;

function parseAnnotations(s, i, str, what, out) {
  var sawTimeZone = false, calendar = null, calendarCritical = false, calendarCount = 0;
  while (i < s.length && s.charAt(i) === "[") {
    var close = s.indexOf("]", i);
    if (close < 0) isoFail(str, what, "unterminated annotation");
    var body = s.slice(i + 1, close);
    i = close + 1;
    var critical = false;
    if (body.charAt(0) === "!") { critical = true; body = body.slice(1); }
    var eq = body.indexOf("=");
    if (eq < 0) {
      // no "=" makes it a TIME ZONE annotation, and only one is allowed. It has
      // to come before any key=value annotation, and it is the only one whose
      // value this implementation keeps.
      if (sawTimeZone || calendarCount > 0) isoFail(str, what, "misplaced or repeated time zone annotation");
      if (body.length === 0) isoFail(str, what, "empty time zone annotation");
      sawTimeZone = true;
      out.tz = body;
      continue;
    }
    var key = body.slice(0, eq), value = body.slice(eq + 1);
    if (!ANNOT_KEY_RE.test(key)) isoFail(str, what, "invalid annotation key " + key);
    if (value.length === 0) isoFail(str, what, "empty annotation value");
    if (key === "u-ca") {
      calendarCount += 1;
      if (critical) calendarCritical = true;
      // a repeated calendar is tolerated (the first wins) UNLESS one of them was
      // marked critical, which makes the ambiguity fatal
      if (calendarCount > 1 && calendarCritical) isoFail(str, what, "repeated critical calendar annotation");
      if (calendar === null) calendar = value;
    } else if (critical) {
      // the whole point of `!`: a consumer that does not understand this
      // annotation must refuse the string rather than ignore it
      isoFail(str, what, "unknown annotation marked critical: " + key);
    }
  }
  if (i !== s.length) isoFail(str, what, "trailing characters");
  out.calendar = calendar;
  return i;
}

function parseTemporalISO(str, what, opts) {
  var s = String(str);
  var i = 0;
  var out = { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0,
    millisecond: 0, microsecond: 0, nanosecond: 0,
    offsetNs: null, z: false, tz: null, calendar: null, hasTime: false, hasDate: true };
  function digits(k) {
    var v = 0;
    for (var j = 0; j < k; j++) {
      if (!isDigit(s.charAt(i))) isoFail(str, what, "expected " + k + " digits");
      v = v * 10 + (s.charCodeAt(i) - 48);
      i++;
    }
    return v;
  }
  var monthDayOnly = opts && opts.monthDay;
  var timeOnly = opts && opts.timeOnly;

  if (timeOnly) {
    // PlainTime accepts a bare time, but a bare time that could be read as a
    // date-with-no-time ("2000-05-02") is a RangeError rather than 20:00:05.
    out.hasDate = false;
  } else if (monthDayOnly && (s.charAt(0) === "-" && s.charAt(1) === "-")) {
    i = 2;
    out.year = 1972;
    out.month = digits(2);
    if (s.charAt(i) === "-") i++;
    out.day = digits(2);
  } else {
    var sign = 1;
    if (s.charAt(i) === "+" || s.charAt(i) === "-") {
      // Only ASCII. U+2212 MINUS SIGN reads as a minus to a human and is
      // explicitly not accepted here, which is its own test262 file per type.
      sign = s.charAt(i) === "-" ? -1 : 1;
      i++;
      var y6 = digits(6);
      if (sign < 0 && y6 === 0) isoFail(str, what, "year -000000 does not exist");
      out.year = sign * y6;
    } else {
      out.year = digits(4);
    }
    var dashed = s.charAt(i) === "-";
    if (dashed) i++;
    out.month = digits(2);
    if (dashed) {
      if (s.charAt(i) !== "-") isoFail(str, what, "inconsistent date separators");
      i++;
    }
    out.day = digits(2);
  }

  if (!timeOnly) {
    var sep = s.charAt(i);
    if (sep === "T" || sep === "t" || sep === " ") { i++; out.hasTime = true; }
  } else {
    out.hasTime = true;
    if (s.charAt(i) === "T" || s.charAt(i) === "t") i++;
  }

  if (out.hasTime && i < s.length && isDigit(s.charAt(i))) {
    out.hour = digits(2);
    var colon = s.charAt(i) === ":";
    if (colon) i++;
    if (isDigit(s.charAt(i))) {
      out.minute = digits(2);
      if (colon ? s.charAt(i) === ":" : isDigit(s.charAt(i))) {
        if (colon) i++;
        out.second = digits(2);
        var fc = s.charAt(i);
        if (fc === "." || fc === ",") {
          i++;
          var frac = "";
          while (isDigit(s.charAt(i)) && frac.length < 9) { frac += s.charAt(i); i++; }
          if (frac.length === 0) isoFail(str, what, "empty fraction");
          if (isDigit(s.charAt(i))) isoFail(str, what, "more than nine fractional digits");
          frac = (frac + "000000000").slice(0, 9);
          out.millisecond = Number(frac.slice(0, 3));
          out.microsecond = Number(frac.slice(3, 6));
          out.nanosecond = Number(frac.slice(6, 9));
        }
      }
    }
  } else if (out.hasTime) {
    isoFail(str, what, "time designator with no time");
  }

  var oc = s.charAt(i);
  if (oc === "Z" || oc === "z") {
    // an offset needs a time to be an offset FROM: "2022-09-15Z" is a RangeError
    if (!out.hasTime) isoFail(str, what, "offset without a time");
    out.z = true; out.offsetNs = 0; i++;
  } else if (oc === "+" || oc === "-") {
    if (!out.hasTime) isoFail(str, what, "offset without a time");
    var osign = oc === "-" ? -1 : 1;
    i++;
    var oh = digits(2);
    var ocolon = s.charAt(i) === ":";
    if (ocolon) i++;
    var om = 0, os = 0, ofrac = 0;
    if (isDigit(s.charAt(i))) {
      om = digits(2);
      if (ocolon ? s.charAt(i) === ":" : isDigit(s.charAt(i))) {
        if (ocolon) i++;
        os = digits(2);
        var ofc = s.charAt(i);
        if (ofc === "." || ofc === ",") {
          i++;
          var of = "";
          while (isDigit(s.charAt(i)) && of.length < 9) { of += s.charAt(i); i++; }
          if (of.length === 0) isoFail(str, what, "empty offset fraction");
          ofrac = Number((of + "000000000").slice(0, 9));
        }
      }
    }
    if (oh > 23 || om > 59 || os > 59) isoFail(str, what, "offset out of range");
    out.offsetNs = osign * (oh * 3600e9 + om * 60e9 + os * 1e9 + ofrac);
  }

  parseAnnotations(s, i, str, what, out);
  // A PlainTime has no calendar, so its string's calendar annotation is parsed
  // for well-formedness and then ignored — even an unknown one, even critical.
  if (out.calendar !== null && out.calendar.toLowerCase() !== "iso8601" && what !== "PlainTime") {
    throw new RangeError("unsupported calendar in " + what + " string: " + out.calendar);
  }
  // 60 is a leap second in the wire format and clamps to 59; it never denotes a
  // 61st second of a minute in Temporal.
  if (out.second === 60) out.second = 59;
  // Only an exact instant may carry the "Z" designator. A Z-stamped string names
  // a moment in UTC, and there is no way to say which local day that was, so it
  // is not a PlainDate, a PlainTime or anything else calendar-local.
  if (out.z && what !== "Instant" && what !== "ZonedDateTime" && what !== "TimeZone") {
    isoFail(str, what, "a UTC designator is not allowed here");
  }
  return out;
}

// --- Temporal.PlainDate ------------------------------------------------------
function PlainDate(y, m, d) {
  if (!new.target) throw new TypeError("Temporal.PlainDate must be called with new");
  y = toIntegerWithTruncation(y, "year"); m = toIntegerWithTruncation(m, "month"); d = toIntegerWithTruncation(d, "day");
  rejectISODate(y, m, d);
  rejectDateRange(y, m, d);
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
def(PDP, "toString", function toString() {
  var f = slotOf(this, "PlainDate");
  var show = getShowCalendar(optionsObject(arguments[0], "PlainDate.toString"), "PlainDate.toString");
  return plainDateToString(f) + calendarSuffix(show);
});
def(PDP, "toJSON", function toJSON() { return plainDateToString(slotOf(this, "PlainDate")); });
def(PDP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainDate has no primitive value"); });
def(PDP, "equals", function equals(other) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return a.year === b.year && a.month === b.month && a.day === b.day;
});
def(PDP, "with", function withFields(o) {
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainDate.with'), 'PlainDate.with');
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
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainDate.add'), 'PlainDate.add');
  var r = addToDate(slotOf(this, "PlainDate"), Duration.from(dur), false);
  return new PlainDate(r.year, r.month, r.day);
});
def(PDP, "subtract", function subtract(dur) {
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainDate.subtract'), 'PlainDate.subtract');
  var r = addToDate(slotOf(this, "PlainDate"), Duration.from(dur), true);
  return new PlainDate(r.year, r.month, r.day);
});
def(PDP, "until", function until(other, options) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return plainDateDifference(a, b, options, "until");
});
def(PDP, "since", function since(other, options) {
  // Anchored on `this` even though the answer runs the other way: rounding a
  // month depends on which month you start counting from.
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return plainDateDifference(a, b, options, "since", true);
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
    // An Object with no [[Calendar]] is never stringified into a calendar name:
    // `{ calendar: {} }` and `{ calendar: new Temporal.Duration() }` are both
    // TypeErrors, not "[object Object] is not a calendar".
    throw new TypeError("calendar must be a string or a Temporal date object");
  }
  if (typeof v !== "string") {
    throw new TypeError("calendar must be a string or a Temporal date object, got " + typeof v);
  }
  var raw = v;
  if (raw.toLowerCase() === "iso8601") return "iso8601";
  checkCalendarStringYear(raw);
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

// A calendar identifier may be spelled as a whole ISO string, and that string is
// held to the same rules as any other: `{ calendar: "-000000-10-31" }` names the
// year -0, which does not exist.
var CAL_YEAR_RE = /^([+-])(\d{6})/;
function checkCalendarStringYear(raw) {
  var m = CAL_YEAR_RE.exec(raw);
  if (m && m[1] === "-" && Number(m[2]) === 0) {
    throw new RangeError("minus zero is not a valid extended year: " + raw);
  }
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

// GetTemporalUnitValuedOption: coerces the value and rejects anything that is not
// a unit name, but does NOT check that the unit suits the operation. Every option
// is read and cast before any of them is validated, and test262 observes that
// order with an object whose toString records the call.
function readUnitValued(opts, key, allowAuto) {
  if (opts === undefined) return undefined;
  var v = opts[key];
  if (v === undefined) return undefined;
  // Coerced once and then inspected: testing for "auto" with a second String()
  // called an observer's toString twice, which the tests count.
  return unitFromName(toStringSpec(v, key), key, allowAuto);
}
function unitFromName(u, key, allowAuto) {
  if (allowAuto && u === "auto") return undefined;
  if (u.charAt(u.length - 1) === "s" && u !== "s") u = u.slice(0, -1);
  if (allUnitIndex(u) < 0) throw new RangeError(key + " must be a Temporal unit, got " + u);
  return u;
}
var UNIT_GROUPS = {
  date: ["year", "month", "week", "day"],
  time: ["hour", "minute", "second", "millisecond", "microsecond", "nanosecond"],
  datetime: ["year", "month", "week", "day", "hour", "minute", "second", "millisecond", "microsecond", "nanosecond"],
  yearmonth: ["year", "month"]
};
// GetDifferenceSettings. The read order is largestUnit, roundingIncrement,
// roundingMode, smallestUnit, and `since` differs from `until` only in that the
// rounding mode is mirrored and the answer negated.
function differenceSettings(opts, where, group, defaultLargest, defaultSmallest, isSince) {
  var largest = readUnitValued(opts, "largestUnit", true);
  var inc = castRoundingIncrement(opts);
  var mode = getOption(opts, "roundingMode", ROUNDING_MODES, "trunc", where);
  var smallest = readUnitValued(opts, "smallestUnit", false);
  var allowed = UNIT_GROUPS[group];
  if (smallest === undefined) smallest = defaultSmallest;
  else if (allowed.indexOf(smallest) < 0) {
    throw new RangeError(where + ": smallestUnit " + smallest + " is not supported here");
  }
  if (largest === undefined) {
    largest = allUnitIndex(smallest) < allUnitIndex(defaultLargest) ? smallest : defaultLargest;
  } else if (allowed.indexOf(largest) < 0) {
    throw new RangeError(where + ": largestUnit " + largest + " is not supported here");
  }
  if (allUnitIndex(smallest) < allUnitIndex(largest)) {
    throw new RangeError(where + ": smallestUnit " + smallest + " is larger than largestUnit " + largest);
  }
  validateIncrement(inc, smallest, "difference");
  return { largest: largest, smallest: smallest, increment: inc,
    mode: isSince ? negateRoundingMode(mode) : mode };
}

// RoundRelativeDuration, for the case where the smallest unit is a calendar one.
// A month has no fixed length, so the only way to round to it is to build the two
// dates that bracket the target — start + N units and start + (N+1) units — and
// ask where the target falls between them. Both brackets keep the origin's time
// of day, so the fraction really is a fraction of that one calendar unit.
function roundCalendarDuration(start, destDay, destTime, dur, largest, smallest, increment, mode) {
  var startDay = epochDayFromISO(start.year, start.month, start.day);
  var startTime = timeToNs(start);
  if (destDay === startDay && destTime === startTime) return dur;
  var sign = (destDay < startDay || (destDay === startDay && destTime < startTime)) ? -1 : 1;
  function dayOf(y, mo, w, dd) {
    var t = addMonthsClamped(start, y * 12 + mo);
    var iso = balanceISODate(t.year, t.month, t.day + w * 7 + dd);
    return epochDayFromISO(iso.year, iso.month, iso.day);
  }
  var r1, lo, hi;
  if (smallest === "year") {
    r1 = Math.trunc(dur.years / increment) * increment;
    lo = [r1, 0, 0, 0];
  } else if (smallest === "month") {
    r1 = Math.trunc(dur.months / increment) * increment;
    lo = [dur.years, r1, 0, 0];
  } else if (smallest === "week") {
    r1 = Math.trunc(dur.weeks / increment) * increment;
    lo = [dur.years, dur.months, r1, 0];
  } else {
    r1 = Math.trunc(dur.days / increment) * increment;
    lo = [dur.years, dur.months, dur.weeks, r1];
  }
  var slot = smallest === "year" ? 0 : smallest === "month" ? 1 : smallest === "week" ? 2 : 3;
  hi = [lo[0], lo[1], lo[2], lo[3]];
  hi[slot] = r1 + increment * sign;
  var e1 = dayOf(lo[0], lo[1], lo[2], lo[3]);
  var e2 = dayOf(hi[0], hi[1], hi[2], hi[3]);
  // Measured in DAYS plus a fraction of a day: the same span in nanoseconds runs
  // past 2^53 at Temporal's limits and the fraction would come out wrong.
  var num = (destDay - e1) + (destTime - startTime) / 86400e9;
  var progress = e2 === e1 ? 0 : num / (e2 - e1);
  var rounded = applyRounding(r1 + progress * increment * sign, increment, mode);
  var res = { years: lo[0], months: lo[1], weeks: lo[2], days: lo[3] };
  if (slot === 0) res.years = rounded;
  else if (slot === 1) res.months = rounded;
  else if (slot === 2) res.weeks = rounded;
  else res.days = rounded;
  // BubbleRelativeDuration: rounding twelve months up completes a year, and the
  // answer owes the caller the largest unit they asked for. The comparison is
  // against where the ROUNDED duration lands, not against the original target.
  // Weeks are skipped unless weeks are what was asked for: seven days is "7 days"
  // in a year-largest difference and "1 week" only in a week-largest one.
  var order = ["year", "month", "week", "day"];
  var nudged = dayOf(res.years, res.months, res.weeks, res.days);
  for (var u = order.indexOf(smallest) - 1; u >= order.indexOf(largest) && u >= 0; u--) {
    if (order[u] === "week" && largest !== "week") continue;
    var cand;
    if (order[u] === "year") cand = { years: res.years + sign, months: 0, weeks: 0, days: 0 };
    else if (order[u] === "month") cand = { years: res.years, months: res.months + sign, weeks: 0, days: 0 };
    else cand = { years: res.years, months: res.months, weeks: res.weeks + sign, days: 0 };
    var p = dayOf(cand.years, cand.months, cand.weeks, cand.days);
    if (sign * (nudged - p) < 0) break;
    res = cand;
  }
  return res;
}

// The signed, truncated-toward-the-start difference from a to b in `largest`.
// No rounding: this is the raw duration the rounding step then nudges.
function rawDateDifference(a, b, largest) {
  var cmp = epochDayFromISO(a.year, a.month, a.day) - epochDayFromISO(b.year, b.month, b.day);
  var e = cmp <= 0 ? a : b;
  var l = cmp <= 0 ? b : a;
  var d = (largest === "year" || largest === "month")
    ? diffISODateCalendar(e, l, largest)
    : diffISODateDays(e, l, largest);
  var s = cmp <= 0 ? 1 : -1;
  return { years: s * d.years, months: s * d.months, weeks: s * d.weeks, days: s * d.days };
}

// until/since between two PlainDates. Both used to ignore their options entirely
// and always answer in days, so `largestUnit: "year"` gave P1889D instead of P5Y2M3D.
function plainDateDifference(a, b, options, where, isSince) {
  var opts = optionsObject(options, where);
  var s = differenceSettings(opts, where, "date", "day", "day", isSince);
  var d = rawDateDifference(a, b, s.largest);
  var start = { year: a.year, month: a.month, day: a.day,
    hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 };
  d = roundCalendarDuration(start, epochDayFromISO(b.year, b.month, b.day), 0, d,
    s.largest, s.smallest, s.increment, s.mode);
  var sign = isSince ? -1 : 1;
  return new Duration(sign * d.years, sign * d.months, sign * d.weeks, sign * d.days);
}

var DATE_RE = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})$/;
// --- property bags -----------------------------------------------------------
// PrepareCalendarFields. Every field a bag can carry is read in ALPHABETICAL
// order, which is what the order-of-operations tests compare against, and every
// read happens before any of the values is validated.
var DATE_KEYS = ["day", "month", "monthCode", "year"];
var YEARMONTH_KEYS = ["month", "monthCode", "year"];
var TIME_KEYS = ["hour", "microsecond", "millisecond", "minute", "nanosecond", "second"];
var DATETIME_KEYS = ["day", "hour", "microsecond", "millisecond", "minute", "month",
  "monthCode", "nanosecond", "second", "year"];
// The wall-clock fields of any Temporal object that has some. A ZonedDateTime
// stores an instant and a zone, so its date and time only exist once the offset
// has been applied; reading `slot.year` off one gave undefined.
function localFieldsOf(slot) {
  return slot.kind === "ZonedDateTime" ? zonedLocal(slot) : slot;
}
function readBagFields(item, keys) {
  var out = { $any: false };
  for (var i = 0; i < keys.length; i++) {
    var v = item[keys[i]];
    if (v !== undefined) out.$any = true;
    out[keys[i]] = v;
  }
  return out;
}
// ToPrimitiveAndRequireString: a monthCode of 5 is a TypeError, not "M05".
function requireStringField(v, name) {
  if (isObjectLike(v)) v = String(v);
  if (typeof v !== "string") throw new TypeError(name + " must be a string");
  return v;
}
var MONTH_CODE_RE = /^M(0[1-9]|1[0-2])$/;
function monthFromCode(v) {
  var code = requireStringField(v, "monthCode");
  if (!MONTH_CODE_RE.test(code)) throw new RangeError("invalid monthCode: " + code);
  return Number(code.slice(1));
}
// RegulateISODate: "constrain" clamps a field into its month, "reject" refuses.
function regulateISODate(y, m, d, overflow) {
  if (overflow === "reject") {
    rejectISODate(y, m, d);
    return { year: y, month: m, day: d };
  }
  m = Math.min(Math.max(m, 1), 12);
  d = Math.min(Math.max(d, 1), daysInMonth(y, m));
  return { year: y, month: m, day: d };
}
function clampTo(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function regulateISOTime(t, overflow) {
  if (overflow === "reject") {
    rejectTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
    return t;
  }
  return { hour: clampTo(t.hour, 0, 23), minute: clampTo(t.minute, 0, 59), second: clampTo(t.second, 0, 59),
    millisecond: clampTo(t.millisecond, 0, 999), microsecond: clampTo(t.microsecond, 0, 999),
    nanosecond: clampTo(t.nanosecond, 0, 999) };
}
// CalendarDateFromFields for the ISO calendar. month and monthCode may both be
// given, but then they have to agree; the year is required for everything but a
// month-day, which falls back to the reference year 1972.
function isoDateFromFields(raw, overflow, what) {
  var m;
  if (raw.monthCode !== undefined) {
    m = monthFromCode(raw.monthCode);
    if (raw.month !== undefined && toIntegerWithTruncation(raw.month, "month") !== m) {
      throw new RangeError("month and monthCode do not agree");
    }
  } else if (raw.month !== undefined) {
    m = toIntegerWithTruncation(raw.month, "month");
  } else {
    throw new TypeError(what + " needs a month or a monthCode");
  }
  var y;
  if (raw.year !== undefined) y = toIntegerWithTruncation(raw.year, "year");
  else if (what === "PlainMonthDay") y = 1972;
  else throw new TypeError(what + " needs a year");
  if (what === "PlainYearMonth") {
    if (m < 1 || m > 12) {
      if (overflow === "reject") throw new RangeError("invalid ISO month: " + m);
      m = clampTo(m, 1, 12);
    }
    return { year: y, month: m, day: 1 };
  }
  if (raw.day === undefined) throw new TypeError(what + " needs a day");
  return regulateISODate(y, m, toIntegerWithTruncation(raw.day, "day"), overflow);
}
function isoTimeFromFields(raw, overflow) {
  return regulateISOTime({
    hour: raw.hour === undefined ? 0 : toIntegerWithTruncation(raw.hour, "hour"),
    minute: raw.minute === undefined ? 0 : toIntegerWithTruncation(raw.minute, "minute"),
    second: raw.second === undefined ? 0 : toIntegerWithTruncation(raw.second, "second"),
    millisecond: raw.millisecond === undefined ? 0 : toIntegerWithTruncation(raw.millisecond, "millisecond"),
    microsecond: raw.microsecond === undefined ? 0 : toIntegerWithTruncation(raw.microsecond, "microsecond"),
    nanosecond: raw.nanosecond === undefined ? 0 : toIntegerWithTruncation(raw.nanosecond, "nanosecond")
  }, overflow);
}

function PlainDateFromValue(item, options, where) {
  if (isObjectLike(item)) {
    var s = item[$slot];
    if (s && (s.kind === "PlainDate" || s.kind === "PlainDateTime" || s.kind === "ZonedDateTime")) {
      toOverflow(options, where);
      var pd = localFieldsOf(s);
      return new PlainDate(pd.year, pd.month, pd.day);
    }
    toCalendarId(item.calendar);
    var raw = readBagFields(item, DATE_KEYS);
    if (!raw.$any) throw new TypeError("PlainDate needs year, month and day");
    var r = isoDateFromFields(raw, toOverflow(options, where), "PlainDate");
    return new PlainDate(r.year, r.month, r.day);
  }
  var p = parseTemporalISO(requireISOString(item, "PlainDate"), "PlainDate");
  toOverflow(options, where);
  return new PlainDate(p.year, p.month, p.day);
}

def(PlainDate, "from", function from(item) {
  // `options` comes off `arguments`: from.length is 1 in the spec, and a
  // declared second parameter made it 2.
  var options = arguments[1];
  // GetOptionsObject reads no properties, so checking the bag's TYPE here is
  // not observable. Reading `overflow` IS observable and must not happen until
  // the item itself has parsed: PlainDate.from("13-34", observer) throws RangeError
  // without ever touching the bag.
  return PlainDateFromValue(item, optionsObject(options, 'PlainDate.from'), 'PlainDate.from');
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
def(PTP, "toString", function toString() {
  var f = slotOf(this, "PlainTime");
  var opts = optionsObject(arguments[0], "PlainTime.toString");
  var p = timeStringPrecision(opts, "PlainTime.toString", true);
  // rounding a time up can carry past midnight, and a PlainTime has no date to
  // carry into, so the clock wraps: 23:59:59.9999 to the millisecond is 00:00.
  return formatTimeWithPrecision(nsToTime(applyRounding(timeToNs(f), precisionNs(p), p.mode)), p);
});
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
function PlainTimeFromValue(item, options, where) {
  if (isObjectLike(item)) {
    var s = item[$slot];
    if (s && (s.kind === "PlainTime" || s.kind === "PlainDateTime" || s.kind === "ZonedDateTime")) {
      toOverflow(options, where);
      var pt = localFieldsOf(s);
      return new PlainTime(pt.hour, pt.minute, pt.second, pt.millisecond, pt.microsecond, pt.nanosecond);
    }
    var raw = readBagFields(item, TIME_KEYS);
    if (!raw.$any) throw new TypeError("PlainTime needs at least one time field");
    var t = isoTimeFromFields(raw, toOverflow(options, where));
    return new PlainTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
  }
  requireISOString(item, "PlainTime");
  var str = item;
  // a date-time string supplies its time half; a bare time has no date to strip
  var p = /^[+-]?\d{4}/.test(str)
    ? parseTemporalISO(str, "PlainTime")
    : parseTemporalISO(str, "PlainTime", { timeOnly: true });
  if (!p.hasTime) throw new RangeError("invalid PlainTime string: " + str + " (no time)");
  toOverflow(options, where);
  return new PlainTime(p.hour, p.minute, p.second, p.millisecond, p.microsecond, p.nanosecond);
}

def(PlainTime, "from", function from(item) {
  // `options` comes off `arguments`: from.length is 1 in the spec, and a
  // declared second parameter made it 2.
  var options = arguments[1];
  // GetOptionsObject reads no properties, so checking the bag's TYPE here is
  // not observable. Reading `overflow` IS observable and must not happen until
  // the item itself has parsed: PlainTime.from("13-34", observer) throws RangeError
  // without ever touching the bag.
  return PlainTimeFromValue(item, optionsObject(options, 'PlainTime.from'), 'PlainTime.from');
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
  rejectDateTimeRange(y, mo, d, ((h * 60 + mi) * 60 + s) * 1e9 + ms * 1e6 + us * 1e3 + ns);
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
def(PDTP, "toString", function toString() {
  var f = slotOf(this, "PlainDateTime");
  var opts = optionsObject(arguments[0], "PlainDateTime.toString");
  var show = getShowCalendar(opts, "PlainDateTime.toString");
  var p = timeStringPrecision(opts, "PlainDateTime.toString", true);
  // Only the time of day is rounded, so the rounding direction is measured from
  // midnight rather than from the epoch; a carry moves the date forward a day.
  var t = applyRounding(timeToNs(f), precisionNs(p), p.mode);
  var carry = Math.floor(t / 86400e9);
  var d = carry === 0 ? f : balanceISODate(f.year, f.month, f.day + carry);
  return plainDateToString(d) + "T" + formatTimeWithPrecision(nsToTime(t), p) + calendarSuffix(show);
});
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
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainDateTime.with'), 'PlainDateTime.with');
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
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainDateTime.add'), 'PlainDateTime.add');
  var r = addToDateTime(slotOf(this, "PlainDateTime"), Duration.from(dur), false);
  return new PlainDateTime(r.date.year, r.date.month, r.date.day, r.time.hour, r.time.minute, r.time.second,
    r.time.millisecond, r.time.microsecond, r.time.nanosecond);
});
def(PDTP, "subtract", function subtract(dur) {
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainDateTime.subtract'), 'PlainDateTime.subtract');
  var r = addToDateTime(slotOf(this, "PlainDateTime"), Duration.from(dur), true);
  return new PlainDateTime(r.date.year, r.date.month, r.date.day, r.time.hour, r.time.minute, r.time.second,
    r.time.millisecond, r.time.microsecond, r.time.nanosecond);
});
function PlainDateTimeFromValue(item, options, where) {
  if (isObjectLike(item)) {
    var s = item[$slot];
    if (s && (s.kind === "PlainDateTime" || s.kind === "ZonedDateTime")) {
      toOverflow(options, where);
      var pdt = localFieldsOf(s);
      return new PlainDateTime(pdt.year, pdt.month, pdt.day, pdt.hour, pdt.minute, pdt.second, pdt.millisecond, pdt.microsecond, pdt.nanosecond);
    }
    if (s && s.kind === "PlainDate") {
      toOverflow(options, where);
      return new PlainDateTime(s.year, s.month, s.day);
    }
    toCalendarId(item.calendar);
    var raw = readBagFields(item, DATETIME_KEYS);
    if (!raw.$any) throw new TypeError("PlainDateTime needs year, month and day");
    var overflow = toOverflow(options, where);
    var r = isoDateFromFields(raw, overflow, "PlainDateTime");
    var t = isoTimeFromFields(raw, overflow);
    return new PlainDateTime(r.year, r.month, r.day, t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
  }
  var p = parseTemporalISO(requireISOString(item, "PlainDateTime"), "PlainDateTime");
  toOverflow(options, where);
  return new PlainDateTime(p.year, p.month, p.day, p.hour, p.minute, p.second,
    p.millisecond, p.microsecond, p.nanosecond);
}

def(PlainDateTime, "from", function from(item) {
  // `options` comes off `arguments`: from.length is 1 in the spec, and a
  // declared second parameter made it 2.
  var options = arguments[1];
  // GetOptionsObject reads no properties, so checking the bag's TYPE here is
  // not observable. Reading `overflow` IS observable and must not happen until
  // the item itself has parsed: PlainDateTime.from("13-34", observer) throws RangeError
  // without ever touching the bag.
  return PlainDateTimeFromValue(item, optionsObject(options, 'PlainDateTime.from'), 'PlainDateTime.from');
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
def(IP, "toString", function toString() {
  var f = slotOf(this, "Instant");
  var opts = optionsObject(arguments[0], "Instant.toString");
  var p = timeStringPrecision(opts, "Instant.toString", true);
  var tzRaw = opts === undefined ? undefined : opts.timeZone;
  var ns = applyRoundingBig(f.ns, BigInt(precisionNs(p)), asIfPositive(p.mode));
  // With no timeZone option the instant prints in UTC with a "Z"; with one it
  // prints in that zone's local time and shows the numeric offset instead.
  var offNs = 0;
  if (tzRaw !== undefined) offNs = parseOffsetNs(toTimeZoneArg(tzRaw)) || 0;
  var local = ns + BigInt(offNs);
  var days = local / NS_PER_DAY, rem = local % NS_PER_DAY;
  if (rem < 0n) { days -= 1n; rem += NS_PER_DAY; }
  var date = isoFromEpochDay(Number(days));
  return plainDateToString(date) + "T" + formatTimeWithPrecision(nsToTime(Number(rem)), p) +
    (tzRaw === undefined ? "Z" : formatOffset(offNs));
});
def(IP, "toJSON", function toJSON() { return instantToString(slotOf(this, "Instant").ns); });
def(Instant, "fromEpochMilliseconds", function fromEpochMilliseconds(ms) {
  return new Instant(BigInt(toIntegerWithTruncation(ms, "epochMilliseconds")) * 1000000n);
});
def(Instant, "fromEpochNanoseconds", function fromEpochNanoseconds(ns) {
  if (typeof ns !== "bigint") throw new TypeError("epochNanoseconds must be a BigInt");
  return new Instant(ns);
});
def(Instant, "from", function from(item) {
  if (item !== null && typeof item === "object") {
    var s = item[$slot];
    if (s && s.kind === "Instant") return new Instant(s.ns);
    if (s && s.kind === "ZonedDateTime") return new Instant(s.ns);
  }
  // The shared parser is what knows about leap seconds, annotations and the year
  // -000000; the hand-rolled regex this replaced knew about none of them.
  var p = parseTemporalISO(requireISOString(item, "Instant"), "Instant");
  if (p.offsetNs === null || p.offsetNs === undefined) {
    throw new RangeError("an Instant string needs a UTC designator or an offset: " + item);
  }
  var ns = BigInt(epochDayFromISO(p.year, p.month, p.day)) * NS_PER_DAY
    + BigInt(timeToNs(p)) - BigInt(p.offsetNs);
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
  // A year-month is in range when SOME day of it is, so the first and last of the
  // month are what the limits are measured against, not its reference day.
  if (epochDayFromISO(y, m, daysInMonth(y, m)) < MIN_EPOCH_DAY || epochDayFromISO(y, m, 1) > MAX_EPOCH_DAY) {
    throw new RangeError("year-month is outside the representable range: " + formatYear(y) + "-" + pad(m, 2));
  }
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
def(YMP, "toString", function toString() {
  var f = slotOf(this, "PlainYearMonth");
  var show = getShowCalendar(optionsObject(arguments[0], "PlainYearMonth.toString"), "PlainYearMonth.toString");
  // With the calendar shown the reference day has to be printed too, or the
  // string could not be parsed back by a calendar-aware implementation.
  if (show === "always" || show === "critical") {
    return plainDateToString(f) + calendarSuffix(show);
  }
  return yearMonthToString(f);
});
def(YMP, "toJSON", function toJSON() { return yearMonthToString(slotOf(this, "PlainYearMonth")); });
def(YMP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainYearMonth has no primitive value"); });
def(YMP, "equals", function equals(other) {
  var a = slotOf(this, "PlainYearMonth"), b = slotOf(PlainYearMonth.from(other), "PlainYearMonth");
  return a.year === b.year && a.month === b.month;
});
def(YMP, "with", function withFields(o) {
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainYearMonth.with'), 'PlainYearMonth.with');
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
def(YMP, "add", function add(dur) {
  toOverflow(optionsObject(arguments[1], "PlainYearMonth.add"), "PlainYearMonth.add");
  return addYearMonth(slotOf(this, "PlainYearMonth"), Duration.from(dur), false);
});
def(YMP, "subtract", function subtract(dur) {
  toOverflow(optionsObject(arguments[1], "PlainYearMonth.subtract"), "PlainYearMonth.subtract");
  return addYearMonth(slotOf(this, "PlainYearMonth"), Duration.from(dur), true);
});
// A year-month difference is measured from the FIRST of each month: the reference
// day the two operands happen to carry is not part of the comparison.
function yearMonthDifference(a, b, options, where, isSince) {
  var st = differenceSettings(optionsObject(options, where), where, "yearmonth", "year", "month", isSince);
  var total = (b.year * 12 + b.month) - (a.year * 12 + a.month);
  var dur = st.largest === "year"
    ? { years: Math.trunc(total / 12), months: total % 12, weeks: 0, days: 0 }
    : { years: 0, months: total, weeks: 0, days: 0 };
  var start = { year: a.year, month: a.month, day: 1,
    hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 };
  dur = roundCalendarDuration(start, epochDayFromISO(b.year, b.month, 1), 0, dur,
    st.largest, st.smallest, st.increment, st.mode);
  var sign = isSince ? -1 : 1;
  return new Duration(sign * dur.years, sign * dur.months);
}
def(YMP, "until", function until(other, options) {
  var a = slotOf(this, "PlainYearMonth"), b = slotOf(PlainYearMonth.from(other), "PlainYearMonth");
  return yearMonthDifference(a, b, options, "PlainYearMonth.until", false);
});
def(YMP, "since", function since(other, options) {
  var a = slotOf(this, "PlainYearMonth"), b = slotOf(PlainYearMonth.from(other), "PlainYearMonth");
  return yearMonthDifference(a, b, options, "PlainYearMonth.since", true);
});
var YM_RE = /^([+-]\d{6}|\d{4})-(\d{2})$/;
function PlainYearMonthFromValue(item, options, where) {
  if (isObjectLike(item)) {
    var s = item[$slot];
    if (s && s.kind === "PlainYearMonth") {
      toOverflow(options, where);
      return new PlainYearMonth(s.year, s.month, undefined, s.day);
    }
    if (s && (s.kind === "PlainDate" || s.kind === "PlainDateTime" || s.kind === "ZonedDateTime")) {
      toOverflow(options, where);
      var pym = localFieldsOf(s);
      return new PlainYearMonth(pym.year, pym.month);
    }
    toCalendarId(item.calendar);
    var raw = readBagFields(item, YEARMONTH_KEYS);
    if (!raw.$any) throw new TypeError("PlainYearMonth needs a year and a month");
    var r = isoDateFromFields(raw, toOverflow(options, where), "PlainYearMonth");
    return new PlainYearMonth(r.year, r.month);
  }
  var str = requireISOString(item, "PlainYearMonth");
  var ym = YM_RE.exec(str);
  if (ym) {
    checkExtendedYear(ym[1]);
    toOverflow(options, where);
    return new PlainYearMonth(Number(ym[1]), Number(ym[2]));
  }
  var p = parseTemporalISO(str, "PlainYearMonth");
  toOverflow(options, where);
  return new PlainYearMonth(p.year, p.month);
}

def(PlainYearMonth, "from", function from(item) {
  // `options` comes off `arguments`: from.length is 1 in the spec, and a
  // declared second parameter made it 2.
  var options = arguments[1];
  // GetOptionsObject reads no properties, so checking the bag's TYPE here is
  // not observable. Reading `overflow` IS observable and must not happen until
  // the item itself has parsed: PlainYearMonth.from("13-34", observer) throws RangeError
  // without ever touching the bag.
  return PlainYearMonthFromValue(item, optionsObject(options, 'PlainYearMonth.from'), 'PlainYearMonth.from');
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
def(MDP, "toString", function toString() {
  var f = slotOf(this, "PlainMonthDay");
  var show = getShowCalendar(optionsObject(arguments[0], "PlainMonthDay.toString"), "PlainMonthDay.toString");
  // Same reasoning as PlainYearMonth: showing the calendar forces the reference
  // year into the output so the string round trips.
  if (show === "always" || show === "critical") return plainDateToString(f) + calendarSuffix(show);
  return monthDayToString(f);
});
def(MDP, "toJSON", function toJSON() { return monthDayToString(slotOf(this, "PlainMonthDay")); });
def(MDP, "valueOf", function valueOf() { throw new TypeError("Temporal.PlainMonthDay has no primitive value"); });
def(MDP, "equals", function equals(other) {
  var a = slotOf(this, "PlainMonthDay"), b = slotOf(PlainMonthDay.from(other), "PlainMonthDay");
  return a.year === b.year && a.month === b.month && a.day === b.day;
});
def(MDP, "with", function withFields(o) {
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'PlainMonthDay.with'), 'PlainMonthDay.with');
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
function PlainMonthDayFromValue(item, options, where) {
  if (isObjectLike(item)) {
    var s = item[$slot];
    if (s && s.kind === "PlainMonthDay") {
      toOverflow(options, where);
      return new PlainMonthDay(s.month, s.day, undefined, s.year);
    }
    if (s && (s.kind === "PlainDate" || s.kind === "PlainDateTime" || s.kind === "ZonedDateTime")) {
      toOverflow(options, where);
      var pmd = localFieldsOf(s);
      return new PlainMonthDay(pmd.month, pmd.day);
    }
    toCalendarId(item.calendar);
    var raw = readBagFields(item, DATE_KEYS);
    if (!raw.$any) throw new TypeError("PlainMonthDay needs a month and a day");
    // With no year given the reference year is 1972, which is a leap year, so
    // 02-29 exists; a year that IS given still has to make a real date.
    var r = isoDateFromFields(raw, toOverflow(options, where), "PlainMonthDay");
    return new PlainMonthDay(r.month, r.day, undefined, raw.year === undefined ? 1972 : r.year);
  }
  var str = requireISOString(item, "PlainMonthDay");
  if (str.slice(0, 2) === "--" || MD_RE.test(str)) {
    var p2 = parseTemporalISO(str, "PlainMonthDay", { monthDay: true });
    toOverflow(options, where);
    return new PlainMonthDay(p2.month, p2.day);
  }
  var p = parseTemporalISO(str, "PlainMonthDay");
  toOverflow(options, where);
  return new PlainMonthDay(p.month, p.day, undefined, p.year);
}

def(PlainMonthDay, "from", function from(item) {
  // `options` comes off `arguments`: from.length is 1 in the spec, and a
  // declared second parameter made it 2.
  var options = arguments[1];
  // GetOptionsObject reads no properties, so checking the bag's TYPE here is
  // not observable. Reading `overflow` IS observable and must not happen until
  // the item itself has parsed: PlainMonthDay.from("13-34", observer) throws RangeError
  // without ever touching the bag.
  return PlainMonthDayFromValue(item, optionsObject(options, 'PlainMonthDay.from'), 'PlainMonthDay.from');
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
  if (id.toLowerCase() === "utc") return "UTC";
  var ns = parseOffsetNs(id);
  if (ns !== null) return formatOffset(ns);
  // ToTemporalTimeZoneIdentifier also accepts a whole ISO date-time string and
  // takes the zone from its bracketed annotation, falling back to the offset it
  // carries. `Instant.from(s).toString({ timeZone: s })` relies on that.
  if (/^[+-]?\d{4}/.test(id)) {
    var p = parseTemporalISO(id, "TimeZone");
    if (p.tz !== null && p.tz !== undefined) return canonicalZone(p.tz);
    if (p.z) return "UTC";
    if (p.offsetNs !== null) return formatOffset(p.offsetNs);
  }
  throw new RangeError("unsupported time zone: " + id + " (only UTC and fixed offsets are implemented)");
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
def(ZP, "toString", function toString() {
  var f = slotOf(this, "ZonedDateTime");
  var opts = optionsObject(arguments[0], "ZonedDateTime.toString");
  // The read order here is fixed and observable, and it is not the order the
  // options are used in: calendarName, fractionalSecondDigits, offset,
  // roundingMode, smallestUnit, timeZoneName.
  var show = getShowCalendar(opts, "ZonedDateTime.toString");
  var digits = getFractionalSecondDigits(opts, "ZonedDateTime.toString");
  var showOffset = getOption(opts, "offset", ["auto", "never"], "auto", "ZonedDateTime.toString");
  var mode = getOption(opts, "roundingMode", ROUNDING_MODES, "trunc", "ZonedDateTime.toString");
  var p = precisionFromParts(digits, opts, mode, "ZonedDateTime.toString", true);
  var showZone = getOption(opts, "timeZoneName", ["auto", "never", "critical"], "auto", "ZonedDateTime.toString");
  var offNs = parseOffsetNs(f.tz) || 0;
  var rounded = applyRoundingBig(f.ns, BigInt(precisionNs(p)), asIfPositive(p.mode)) + BigInt(offNs);
  var days = rounded / NS_PER_DAY, rem = rounded % NS_PER_DAY;
  if (rem < 0n) { days -= 1n; rem += NS_PER_DAY; }
  var d = isoFromEpochDay(Number(days));
  return plainDateToString(d) + "T" + formatTimeWithPrecision(nsToTime(Number(rem)), p) +
    (showOffset === "never" ? "" : formatOffset(offNs)) +
    (showZone === "never" ? "" : (showZone === "critical" ? "[!" : "[") + f.tz + "]") +
    calendarSuffix(show);
});
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
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'ZonedDateTime.add'), 'ZonedDateTime.add');
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
  // options arrive through `arguments` so this method's .length is unchanged
  toOverflow(optionsObject(arguments[1], 'ZonedDateTime.subtract'), 'ZonedDateTime.subtract');
  var f = slotOf(this, "ZonedDateTime");
  var d = Duration.from(dur);
  var l = zonedLocal(f);
  var shifted = addToDate(l, d, true);
  var off = BigInt(parseOffsetNs(f.tz) || 0);
  var localNs = BigInt(epochDayFromISO(shifted.year, shifted.month, shifted.day)) * NS_PER_DAY + BigInt(timeToNs(l));
  return new ZonedDateTime(localNs - off - BigInt(durationTimeNs(d)), f.tz);
});
function ZonedDateTimeFromValue(item, options, where) {
  if (isObjectLike(item)) {
    var s = item[$slot];
    if (s && s.kind === "ZonedDateTime") {
      toOverflow(options, where);
      return new ZonedDateTime(s.ns, s.tz);
    }
    if (item.timeZone === undefined) throw new TypeError("ZonedDateTime needs a timeZone");
    var tz = toTimeZoneArg(item.timeZone);
    toCalendarId(item.calendar);
    var raw = readBagFields(item, DATETIME_KEYS);
    var overflow = toOverflow(options, where);
    var r = isoDateFromFields(raw, overflow, "ZonedDateTime");
    var t = isoTimeFromFields(raw, overflow);
    var off = BigInt(parseOffsetNs(tz) || 0);
    return new ZonedDateTime(BigInt(epochDayFromISO(r.year, r.month, r.day)) * NS_PER_DAY + BigInt(timeToNs(t)) - off, tz);
  }
  var p = parseTemporalISO(requireISOString(item, "ZonedDateTime"), "ZonedDateTime");
  if (p.tz === null || p.tz === undefined) {
    throw new RangeError("ZonedDateTime string needs a [timeZone] annotation: " + item);
  }
  var zone = canonicalZone(p.tz);
  var localNs = BigInt(epochDayFromISO(p.year, p.month, p.day)) * NS_PER_DAY + BigInt(timeToNs(p));
  // the offset in the string wins for locating the instant; the annotation names
  // the zone the result is expressed in
  var offNs = p.offsetNs === null || p.offsetNs === undefined ? (parseOffsetNs(zone) || 0) : p.offsetNs;
  return new ZonedDateTime(localNs - BigInt(offNs), zone);
}

def(ZonedDateTime, "from", function from(item) {
  // `options` comes off `arguments`: from.length is 1 in the spec, and a
  // declared second parameter made it 2.
  var options = arguments[1];
  // GetOptionsObject reads no properties, so checking the bag's TYPE here is
  // not observable. Reading `overflow` IS observable and must not happen until
  // the item itself has parsed: ZonedDateTime.from("13-34", observer) throws RangeError
  // without ever touching the bag.
  var resolvedOptions = optionsObject(options, 'ZonedDateTime.from');
  var result = ZonedDateTimeFromValue(item, resolvedOptions, 'ZonedDateTime.from');
  return result;
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

// era and eraYear exist on every date-carrying type and answer undefined under
// the ISO calendar — but they have to EXIST: the tests that noticed were reading
// the property descriptor, so an absent getter failed before it could return
// anything. They are still brand checked, like every other accessor here.
// daysInWeek is 7 in every calendar the spec defines.
[[PDP, "PlainDate"], [PDTP, "PlainDateTime"], [YMP, "PlainYearMonth"], [ZP, "ZonedDateTime"]]
  .forEach(function (pair) {
    getter(pair[0], "era", function () { slotOf(this, pair[1]); return undefined; });
    getter(pair[0], "eraYear", function () { slotOf(this, pair[1]); return undefined; });
  });
[[PDP, "PlainDate"], [PDTP, "PlainDateTime"], [ZP, "ZonedDateTime"]]
  .forEach(function (pair) {
    getter(pair[0], "daysInWeek", function () { slotOf(this, pair[1]); return 7; });
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
// The largest increment each unit accepts, and the number it must divide. A
// calendar unit has no dividend: rounding to every fourth year is legal.
var INCREMENT_DIVIDEND = { hour: 24, minute: 60, second: 60, millisecond: 1000, microsecond: 1000, nanosecond: 1000 };
// Instant.round and the round() of the date-time types measure the increment
// against a whole DAY rather than against the next unit up, and accept the
// dividend itself: rounding an instant to 86400 seconds is legal.
var DAY_DIVIDEND = { day: 1, hour: 24, minute: 1440, second: 86400,
  millisecond: 86400000, microsecond: 86400000000, nanosecond: 86400000000000 };
// ToTemporalRoundingIncrement then ValidateTemporalRoundingIncrement. The
// increment is TRUNCATED, not rejected, when it has a fraction: 2.5 means 2.
function castRoundingIncrement(options) {
  if (options === undefined || !isObjectLike(options)) return 1;
  var v = options.roundingIncrement;
  if (v === undefined) return 1;
  var n = toNumberSpec(v, "roundingIncrement");
  if (!Number.isFinite(n)) throw new RangeError("roundingIncrement must be finite");
  var inc = Math.trunc(n);
  if (inc < 1 || inc > 1e9) throw new RangeError("roundingIncrement must be between 1 and 1e9, got " + n);
  return inc;
}
// `style` says which table applies: "round" caps a day at an increment of 1,
// "instant" measures every unit against a whole solar day, and "difference"
// leaves the calendar units unbounded (every fourth year is a legal increment).
function validateIncrement(inc, unit, style) {
  var dividend, inclusive;
  if (unit === "day" && style !== "difference") { dividend = 1; inclusive = true; }
  else if (style === "instant") { dividend = DAY_DIVIDEND[unit]; inclusive = true; }
  else { dividend = INCREMENT_DIVIDEND[unit]; inclusive = false; }
  if (dividend !== undefined) {
    if (inc > (inclusive ? dividend : dividend - 1) || dividend % inc !== 0) {
      throw new RangeError("roundingIncrement " + inc + " does not divide a " + unit);
    }
  }
  return inc;
}
function readRoundingIncrement(options, unit, style) {
  return validateIncrement(castRoundingIncrement(options), unit, style);
}
var ROUNDING_MODES = ["ceil", "floor", "expand", "trunc",
  "halfCeil", "halfFloor", "halfExpand", "halfTrunc", "halfEven"];
function readRoundingMode(options) {
  if (options === undefined || !isObjectLike(options)) return "halfExpand";
  return getOption(options, "roundingMode", ROUNDING_MODES, "halfExpand", "roundingMode");
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
    // a tie goes TOWARD zero, which is floor for a negative quotient and ceil
    // for a positive one — the mirror image of halfExpand below
    case "halfTrunc": r = q < 0 ? Math.floor(q + 0.5) : Math.ceil(q - 0.5); break;
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

// The same rounding over BigInt, for the epoch-nanosecond types. Instant and
// ZonedDateTime carry values well past 2^53, so rounding them through a double
// loses the low digits the toString precision options exist to show.
function applyRoundingBig(value, increment, mode) {
  var down = value / increment;
  if (value % increment !== 0n && value < 0n) down -= 1n;
  var rem = value - down * increment;
  if (rem === 0n) return value;
  var up = down + 1n;
  var pick;
  switch (mode) {
    case "ceil": pick = up; break;
    case "floor": pick = down; break;
    case "trunc": pick = value < 0n ? up : down; break;
    case "expand": pick = value < 0n ? down : up; break;
    default: {
      var twice = rem * 2n;
      if (twice > increment) pick = up;
      else if (twice < increment) pick = down;
      else switch (mode) {
        case "halfCeil": pick = up; break;
        case "halfFloor": pick = down; break;
        case "halfTrunc": pick = value < 0n ? up : down; break;
        case "halfEven": pick = down % 2n === 0n ? down : up; break;
        default: pick = value < 0n ? down : up; break;
      }
    }
  }
  return pick * increment;
}

// --- toString precision ------------------------------------------------------
// Every Temporal toString takes fractionalSecondDigits, roundingMode and
// smallestUnit, and reads them in EXACTLY that order — the order-of-operations
// tests observe each get. None of them was read at all before, so
// `time.toString({ smallestUnit: "minute" })` printed the full nanoseconds.

// GetTemporalFractionalSecondDigitsOption: a Number is range-checked as a number
// and floored; anything else must ToString to exactly "auto".
function getFractionalSecondDigits(options, where) {
  if (options === undefined) return "auto";
  var v = options.fractionalSecondDigits;
  if (v === undefined) return "auto";
  if (typeof v === "number") {
    // The floor happens BEFORE the range check, so 9.7 is nine digits and not
    // out of range, while -0.6 floors to -1 and is.
    if (Number.isNaN(v)) throw new RangeError(where + ": fractionalSecondDigits must be a number between 0 and 9");
    var n = Math.floor(v);
    if (n < 0 || n > 9) {
      throw new RangeError(where + ": fractionalSecondDigits must be between 0 and 9, got " + v);
    }
    return n;
  }
  var s = toStringSpec(v, "fractionalSecondDigits");
  if (s !== "auto") throw new RangeError(where + ": fractionalSecondDigits must be a number or \"auto\", got " + s);
  return "auto";
}
var UNIT_NS = { minute: 60e9, second: 1e9, millisecond: 1e6, microsecond: 1e3, nanosecond: 1 };
var SUBSECOND_PRECISION = {
  second: 0, millisecond: 3, microsecond: 6, nanosecond: 9
};
// ToSecondsStringPrecisionRecord. `digits` is "minute" (print no seconds at all),
// "auto" (print as many as are needed) or a fixed count.
function timeStringPrecision(options, where, allowMinute) {
  var digits = getFractionalSecondDigits(options, where);
  var mode = getOption(options, "roundingMode", ROUNDING_MODES, "trunc", where);
  return precisionFromParts(digits, options, mode, where, allowMinute);
}
// Split out from timeStringPrecision because ZonedDateTime reads `offset`
// between fractionalSecondDigits and roundingMode, and the tests observe it.
function precisionFromParts(digits, options, mode, where, allowMinute) {
  var raw = options === undefined ? undefined : options.smallestUnit;
  if (raw !== undefined) {
    var unit = toDurationUnit(raw, "smallestUnit");
    if (unit === "minute" && allowMinute) return { digits: "minute", unit: "minute", increment: 1, mode: mode };
    if (SUBSECOND_PRECISION[unit] === undefined) {
      throw new RangeError(where + ": smallestUnit " + unit + " is not supported here");
    }
    return { digits: SUBSECOND_PRECISION[unit], unit: unit, increment: 1, mode: mode };
  }
  if (digits === "auto") return { digits: "auto", unit: "nanosecond", increment: 1, mode: mode };
  if (digits === 0) return { digits: 0, unit: "second", increment: 1, mode: mode };
  if (digits <= 3) return { digits: digits, unit: "millisecond", increment: Math.pow(10, 3 - digits), mode: mode };
  if (digits <= 6) return { digits: digits, unit: "microsecond", increment: Math.pow(10, 6 - digits), mode: mode };
  return { digits: digits, unit: "nanosecond", increment: Math.pow(10, 9 - digits), mode: mode };
}
function precisionNs(p) { return UNIT_NS[p.unit] * p.increment; }
// RoundNumberToIncrementAsIfPositive. Rounding an epoch nanosecond count for
// display is always done as though the number were positive: "floor" on
// -000099-12-15T12:00:00.5 goes back in time, not toward the epoch. Only the
// sign-relative modes change.
function asIfPositive(mode) {
  if (mode === "trunc") return "floor";
  if (mode === "expand") return "ceil";
  if (mode === "halfTrunc") return "halfFloor";
  if (mode === "halfExpand") return "halfCeil";
  return mode;
}
function formatSubseconds(ns, digits) {
  if (digits === 0) return "";
  var s = pad(ns, 9);
  if (digits === "auto") {
    s = s.replace(/0+$/, "");
    return s === "" ? "" : "." + s;
  }
  return "." + s.slice(0, digits);
}
function formatTimeWithPrecision(f, p) {
  if (p.digits === "minute") return pad(f.hour, 2) + ":" + pad(f.minute, 2);
  return pad(f.hour, 2) + ":" + pad(f.minute, 2) + ":" + pad(f.second, 2) +
    formatSubseconds(f.millisecond * 1e6 + f.microsecond * 1e3 + f.nanosecond, p.digits);
}

// GetTemporalShowCalendarNameOption. Only the ISO calendar exists here, so "auto"
// (the default) prints nothing; "always" and "critical" still have to emit the
// annotation, because that is how a caller asks for a string that survives a
// round trip through a calendar-aware implementation.
var SHOW_CALENDAR = ["auto", "always", "never", "critical"];
function getShowCalendar(options, where) {
  return getOption(options, "calendarName", SHOW_CALENDAR, "auto", where);
}
function calendarSuffix(show) {
  if (show === "always") return "[u-ca=iso8601]";
  if (show === "critical") return "[!u-ca=iso8601]";
  return "";
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
// The same split, over BigInt. An Instant difference runs to 1.7e22 nanoseconds,
// which a double cannot hold to the nanosecond the result is reported in.
var TIME_PLURAL = { hour: "hours", minute: "minutes", second: "seconds",
  millisecond: "milliseconds", microsecond: "microseconds", nanosecond: "nanoseconds" };
function nsToDurationBig(totalNs, largest, smallest, increment, mode) {
  var li = unitIndex(largest), si = unitIndex(smallest);
  var rounded = applyRoundingBig(totalNs, BigInt(TIME_UNITS[si][1] * increment), mode);
  var neg = rounded < 0n;
  var rest = neg ? -rounded : rounded;
  var f = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 };
  for (var i = li; i < TIME_UNITS.length; i++) {
    var w = BigInt(TIME_UNITS[i][1]);
    var n = rest / w;
    rest -= n * w;
    f[TIME_PLURAL[TIME_UNITS[i][0]]] = (neg ? -1 : 1) * Number(n);
  }
  return makeDuration(f);
}
// `delta` is always measured from `this` to `other`, whichever way round the
// operation reads: `since` mirrors the rounding mode and negates the answer, so
// that rounding a half hour never depends on the direction it was asked in.
function diffTimeLike(delta, options, where, defaultLargest, isSince) {
  var st = differenceSettings(optionsObject(options, where), where, "time", defaultLargest, "nanosecond", isSince);
  var d = typeof delta === "bigint"
    ? nsToDurationBig(delta, st.largest, st.smallest, st.increment, st.mode)
    : nsToDuration(delta, st.largest, st.smallest, st.increment, st.mode);
  return isSince ? d.negated() : d;
}
def(PTP, "until", function until(other) {
  var delta = timeToNs(slotOf(PlainTime.from(other), "PlainTime")) - timeToNs(slotOf(this, "PlainTime"));
  return diffTimeLike(delta, arguments[1], "PlainTime.until", "hour", false);
});
def(PTP, "since", function since(other) {
  var delta = timeToNs(slotOf(PlainTime.from(other), "PlainTime")) - timeToNs(slotOf(this, "PlainTime"));
  return diffTimeLike(delta, arguments[1], "PlainTime.since", "hour", true);
});
def(PTP, "round", function round(options) {
  if (options === undefined) throw new TypeError("round needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : optionsObject(options, "PlainTime.round");
  var smallest = readUnitValued(opts, "smallestUnit", false);
  if (smallest === undefined) throw new RangeError("round needs a smallestUnit");
  if (UNIT_GROUPS.time.indexOf(smallest) < 0) throw new RangeError("PlainTime.round: smallestUnit " + smallest + " is not supported");
  var inc = readRoundingIncrement(opts, smallest);
  var t = nsToTime(applyRounding(timeToNs(slotOf(this, "PlainTime")),
    TIME_UNITS[unitIndex(smallest)][1] * inc, readRoundingMode(opts)));
  return new PlainTime(t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(IP, "until", function until(other) {
  var delta = slotOf(Instant.from(other), "Instant").ns - slotOf(this, "Instant").ns;
  return diffTimeLike(delta, arguments[1], "Instant.until", "second", false);
});
def(IP, "since", function since(other) {
  var delta = slotOf(Instant.from(other), "Instant").ns - slotOf(this, "Instant").ns;
  return diffTimeLike(delta, arguments[1], "Instant.since", "second", true);
});
def(IP, "round", function round(options) {
  if (options === undefined) throw new TypeError("round needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : optionsObject(options, "Instant.round");
  var smallest = readUnitValued(opts, "smallestUnit", false);
  if (smallest === undefined) throw new RangeError("round needs a smallestUnit");
  if (UNIT_GROUPS.time.indexOf(smallest) < 0) throw new RangeError("Instant.round: smallestUnit " + smallest + " is not supported");
  var w = BigInt(TIME_UNITS[unitIndex(smallest)][1] * readRoundingIncrement(opts, smallest, "instant"));
  // An instant is rounded as though it were positive, so "floor" on a date before
  // the epoch still moves back in time rather than toward it.
  return new Instant(applyRoundingBig(slotOf(this, "Instant").ns, w, asIfPositive(readRoundingMode(opts))));
});
function dateTimeTotalNs(f) { return epochDayFromISO(f.year, f.month, f.day) * 86400e9 + timeToNs(f); }
def(PDTP, "until", function until(other, options) {
  return diffDateTimeFields(slotOf(this, "PlainDateTime"), slotOf(PlainDateTime.from(other), "PlainDateTime"),
    options, "until", "day", false);
});
def(PDTP, "since", function since(other, options) {
  return diffDateTimeFields(slotOf(this, "PlainDateTime"), slotOf(PlainDateTime.from(other), "PlainDateTime"),
    options, "since", "day", true);
});
def(PDTP, "round", function round(options) {
  var r = roundDateTimeFields(slotOf(this, "PlainDateTime"), options, "PlainDateTime.round");
  return new PlainDateTime(r.year, r.month, r.day, r.hour, r.minute, r.second, r.millisecond, r.microsecond, r.nanosecond);
});
// PlainDateTime and ZonedDateTime measure a date part in calendar units and a
// time part in exact nanoseconds. Their until/since used to reject year, month,
// week and day outright ("unsupported unit: year"), which is 96 test262 cases and
// the most common thing anyone actually asks these types for.
function negateRoundingMode(mode) {
  if (mode === "ceil") return "floor";
  if (mode === "floor") return "ceil";
  if (mode === "halfCeil") return "halfFloor";
  if (mode === "halfFloor") return "halfCeil";
  return mode;
}
function isDateUnit(u) { return u === "year" || u === "month" || u === "week" || u === "day"; }
function readAnyUnitOption(opts, key, dflt) {
  if (opts === undefined) return dflt;
  var v = opts[key];
  if (v === undefined) return dflt;
  if (typeof v !== "symbol" && String(v) === "auto") return dflt;
  return toDurationUnit(v, key);
}

// DifferenceISODateTime. The date and time halves can disagree in sign — from
// 2000-01-01T12:00 to 2000-01-02T06:00 is 18 hours, not "1 day and -6 hours" —
// so when they do, one day moves out of the date part and into the time part
// before either half is measured.
function diffDateTimeFields(a, b, options, where, defaultLargest, isSince) {
  var opts = optionsObject(options, where);
  var st = differenceSettings(opts, where, "datetime", defaultLargest, "nanosecond", isSince);
  var largest = st.largest, smallest = st.smallest, inc = st.increment, mode = st.mode;
  if (!isDateUnit(largest)) {
    // Days apart times a day of nanoseconds runs past 2^53 for any real date, so
    // the two halves are combined as BigInt rather than as one float subtraction.
    var delta = BigInt(epochDayFromISO(b.year, b.month, b.day) - epochDayFromISO(a.year, a.month, a.day)) * NS_PER_DAY
      + BigInt(timeToNs(b) - timeToNs(a));
    var d = nsToDurationBig(delta, largest, smallest, inc, mode);
    return isSince ? d.negated() : d;
  }
  var dateSign = epochDayFromISO(b.year, b.month, b.day) - epochDayFromISO(a.year, a.month, a.day);
  dateSign = dateSign < 0 ? -1 : dateSign > 0 ? 1 : 0;
  var timeDiff = timeToNs(b) - timeToNs(a);
  var endDate = { year: b.year, month: b.month, day: b.day };
  if (dateSign !== 0 && timeDiff !== 0 && (timeDiff < 0) === (dateSign > 0)) {
    var shifted = balanceISODate(b.year, b.month, b.day - dateSign);
    endDate = { year: shifted.year, month: shifted.month, day: shifted.day };
    timeDiff += dateSign * 86400e9;
  }
  var df = rawDateDifference({ year: a.year, month: a.month, day: a.day }, endDate, largest);
  var timeDur;
  if (isDateUnit(smallest)) {
    // The whole answer is calendar units, so the leftover time is not reported;
    // it only decides where between two calendar boundaries the target sits.
    df = roundCalendarDuration(a, epochDayFromISO(b.year, b.month, b.day), timeToNs(b),
      df, largest, smallest, inc, mode);
    timeDur = { hours: 0, minutes: 0, seconds: 0, milliseconds: 0, microseconds: 0, nanoseconds: 0 };
  } else {
    timeDur = durationFields(nsToDuration(timeDiff, "hour", smallest, inc, mode));
  }
  var out = makeDuration({ years: df.years, months: df.months, weeks: df.weeks, days: df.days,
    hours: timeDur.hours, minutes: timeDur.minutes, seconds: timeDur.seconds,
    milliseconds: timeDur.milliseconds, microseconds: timeDur.microseconds, nanoseconds: timeDur.nanoseconds });
  return isSince ? out.negated() : out;
}

// smallestUnit for round() runs day..nanosecond; week, month and year have no
// fixed length to round to.
function roundDateTimeFields(f, options, where) {
  if (options === undefined) throw new TypeError(where + " needs a smallestUnit");
  var opts = typeof options === "string" ? { smallestUnit: options } : optionsObject(options, where);
  if (opts === undefined) throw new TypeError(where + " needs a smallestUnit");
  var smallest = readAnyUnitOption(opts, "smallestUnit", undefined);
  if (smallest === undefined) throw new RangeError(where + " needs a smallestUnit");
  if (isDateUnit(smallest) && smallest !== "day") {
    throw new RangeError("smallestUnit " + smallest + " has no fixed length to round to");
  }
  var w = ALL_UNITS[allUnitIndex(smallest)][1] * readRoundingIncrement(opts, smallest);
  // Rounding the epoch total loses the low digits outright: a date-time in 2000
  // is 9.4e17 nanoseconds from the epoch and a double stops being exact at 9e15.
  // Only the time of day is rounded, and a carry moves the date on a day.
  var t = applyRounding(timeToNs(f), w, readRoundingMode(opts));
  var carry = Math.floor(t / 86400e9);
  var d = carry === 0 ? f : balanceISODate(f.year, f.month, f.day + carry);
  var time = nsToTime(t);
  return { year: d.year, month: d.month, day: d.day, hour: time.hour, minute: time.minute,
    second: time.second, millisecond: time.millisecond, microsecond: time.microsecond,
    nanosecond: time.nanosecond };
}

// A ZonedDateTime difference in date units is measured on the LOCAL wall clock,
// the same split add/subtract already use.
def(ZP, "until", function until(other, options) {
  return diffDateTimeFields(zonedLocal(slotOf(this, "ZonedDateTime")),
    zonedLocal(slotOf(ZonedDateTime.from(other), "ZonedDateTime")), options, "until", "hour", false);
});
def(ZP, "since", function since(other, options) {
  return diffDateTimeFields(zonedLocal(slotOf(this, "ZonedDateTime")),
    zonedLocal(slotOf(ZonedDateTime.from(other), "ZonedDateTime")), options, "since", "hour", true);
});
def(ZP, "round", function round(options) {
  var f = slotOf(this, "ZonedDateTime");
  return zonedFromLocal(roundDateTimeFields(zonedLocal(f), options, "ZonedDateTime.round"), f.tz);
});

var Temporal = {};
tag(Temporal, "Temporal");
// --- conversions between the plain types, and the `with*` family -------------
// Split out here rather than beside each class because every one of them names a
// type defined further down the file: PlainDate.toZonedDateTime needs
// ZonedDateTime, which needs Instant, which needs PlainDateTime.

// ToTemporalTime with the spec's default: an omitted time is midnight, NOT an
// error. `pd.toPlainDateTime()` and `zdt.withPlainTime()` both rely on this.
function timeOrMidnight(item) {
  if (item === undefined) return { hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 };
  return slotOf(PlainTime.from(item), "PlainTime");
}

// ToTemporalCalendarIdentifier. Named calendars are not implemented, so anything
// but the ISO calendar is a RangeError rather than silently ignored. A Temporal
// object supplies its own calendar, which is always iso8601 here.
function toCalendarIdArg(cal) {
  if (isObjectLike(cal)) {
    var sl = cal[$slot];
    if (sl && sl.kind !== undefined) return "iso8601";
    cal = toStringSpec(cal, "calendar");
  } else if (typeof cal !== "string") {
    // null, undefined, a number and a boolean are all TypeError here, not
    // RangeError: ToTemporalCalendarIdentifier requires a String or an Object
    // and never coerces one of these into a calendar name to then reject.
    throw new TypeError("calendar must be a string or a Temporal object, got " + typeof cal);
  }
  var lower = cal.toLowerCase();
  if (lower !== "iso8601") {
    throw new RangeError("unsupported calendar: " + cal + " (only iso8601 is implemented)");
  }
  return "iso8601";
}

// A zone argument that may be a bare identifier or a ZonedDateTime to borrow one
// from, per ToTemporalTimeZoneIdentifier.
function toTimeZoneArg(tz) {
  if (tz === undefined) throw new TypeError("a time zone is required");
  if (isObjectLike(tz)) {
    var sl = tz[$slot];
    if (sl && sl.kind === "ZonedDateTime") return sl.tz;
  }
  // ToTemporalTimeZoneIdentifier takes a String or an Object and nothing else:
  // null, a number and a boolean are TypeErrors here rather than being coerced
  // into a name that would then be rejected as a RangeError.
  if (typeof tz !== "string") throw new TypeError("time zone must be a string or a Temporal object, got " + typeof tz);
  return canonicalZone(tz);
}

function zonedFromLocal(l, tz) {
  var off = BigInt(parseOffsetNs(tz) || 0);
  return new ZonedDateTime(BigInt(epochDayFromISO(l.year, l.month, l.day)) * NS_PER_DAY + BigInt(timeToNs(l)) - off, tz);
}

// --- PlainDate ---------------------------------------------------------------
def(PDP, "toPlainDateTime", function toPlainDateTime(temporalTime) {
  var f = slotOf(this, "PlainDate");
  var t = timeOrMidnight(temporalTime);
  return new PlainDateTime(f.year, f.month, f.day, t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(PDP, "toPlainYearMonth", function toPlainYearMonth() {
  var f = slotOf(this, "PlainDate");
  return new PlainYearMonth(f.year, f.month);
});
def(PDP, "toPlainMonthDay", function toPlainMonthDay() {
  var f = slotOf(this, "PlainDate");
  return new PlainMonthDay(f.month, f.day);
});
def(PDP, "withCalendar", function withCalendar(cal) {
  var f = slotOf(this, "PlainDate");
  toCalendarIdArg(cal);
  return new PlainDate(f.year, f.month, f.day);
});
// The argument is either a bare time zone or a bag { timeZone, plainTime }. A bag
// without timeZone is a TypeError; the spec does not fall back to the system zone.
def(PDP, "toZonedDateTime", function toZonedDateTime(item) {
  var f = slotOf(this, "PlainDate");
  var tz, t;
  if (isObjectLike(item) && item[$slot] === undefined && !(item instanceof String)) {
    if (item.timeZone === undefined) throw new TypeError("toZonedDateTime needs a timeZone");
    tz = toTimeZoneArg(item.timeZone);
    t = timeOrMidnight(item.plainTime);
  } else {
    tz = toTimeZoneArg(item);
    t = timeOrMidnight(undefined);
  }
  return zonedFromLocal({ year: f.year, month: f.month, day: f.day, hour: t.hour, minute: t.minute,
    second: t.second, millisecond: t.millisecond, microsecond: t.microsecond, nanosecond: t.nanosecond }, tz);
});

// --- PlainDateTime -----------------------------------------------------------
def(PDTP, "withPlainTime", function withPlainTime(temporalTime) {
  var f = slotOf(this, "PlainDateTime");
  var t = timeOrMidnight(temporalTime);
  return new PlainDateTime(f.year, f.month, f.day, t.hour, t.minute, t.second, t.millisecond, t.microsecond, t.nanosecond);
});
def(PDTP, "withCalendar", function withCalendar(cal) {
  var f = slotOf(this, "PlainDateTime");
  toCalendarIdArg(cal);
  return new PlainDateTime(f.year, f.month, f.day, f.hour, f.minute, f.second, f.millisecond, f.microsecond, f.nanosecond);
});
def(PDTP, "toPlainYearMonth", function toPlainYearMonth() {
  var f = slotOf(this, "PlainDateTime");
  return new PlainYearMonth(f.year, f.month);
});
def(PDTP, "toPlainMonthDay", function toPlainMonthDay() {
  var f = slotOf(this, "PlainDateTime");
  return new PlainMonthDay(f.month, f.day);
});
def(PDTP, "toZonedDateTime", function toZonedDateTime(tz, options) {
  var f = slotOf(this, "PlainDateTime");
  var zone = toTimeZoneArg(tz);
  // Only the options bag's type is observable here: with fixed-offset zones there
  // is no gap or repeated hour for `disambiguation` to resolve.
  optionsObject(options, "toZonedDateTime");
  return zonedFromLocal(f, zone);
});

// --- ZonedDateTime -----------------------------------------------------------
// `with` rejects calendar and timeZone outright: they are not fields, and the
// spec makes passing them a TypeError rather than ignoring them.
def(ZP, "with", function withFields(o, options) {
  var f = slotOf(this, "ZonedDateTime");
  if (!isObjectLike(o)) throw new TypeError("with: argument must be an object");
  if (o.calendar !== undefined) throw new TypeError("with: calendar is not a field");
  if (o.timeZone !== undefined) throw new TypeError("with: timeZone is not a field");
  optionsObject(options, "with");
  var l = zonedLocal(f);
  function pick(k) { return o[k] === undefined ? l[k] : o[k]; }
  var pdt = new PlainDateTime(pick("year"), pick("month"), pick("day"), pick("hour"), pick("minute"),
    pick("second"), pick("millisecond"), pick("microsecond"), pick("nanosecond"));
  return zonedFromLocal(slotOf(pdt, "PlainDateTime"), f.tz);
});
def(ZP, "withPlainTime", function withPlainTime(temporalTime) {
  var f = slotOf(this, "ZonedDateTime");
  var l = zonedLocal(f), t = timeOrMidnight(temporalTime);
  return zonedFromLocal({ year: l.year, month: l.month, day: l.day, hour: t.hour, minute: t.minute,
    second: t.second, millisecond: t.millisecond, microsecond: t.microsecond, nanosecond: t.nanosecond }, f.tz);
});
def(ZP, "withCalendar", function withCalendar(cal) {
  var f = slotOf(this, "ZonedDateTime");
  toCalendarIdArg(cal);
  return new ZonedDateTime(f.ns, f.tz);
});
def(ZP, "startOfDay", function startOfDay() {
  var f = slotOf(this, "ZonedDateTime");
  var l = zonedLocal(f);
  return zonedFromLocal({ year: l.year, month: l.month, day: l.day, hour: 0, minute: 0, second: 0,
    millisecond: 0, microsecond: 0, nanosecond: 0 }, f.tz);
});
def(ZP, "toPlainYearMonth", function toPlainYearMonth() {
  var l = zonedLocal(slotOf(this, "ZonedDateTime"));
  return new PlainYearMonth(l.year, l.month);
});
def(ZP, "toPlainMonthDay", function toPlainMonthDay() {
  var l = zonedLocal(slotOf(this, "ZonedDateTime"));
  return new PlainMonthDay(l.month, l.day);
});
// Only UTC and fixed offsets exist here, and neither has an offset transition
// ever, so the answer is always null — but the argument is still validated,
// which is what the tests for this method actually check.
def(ZP, "getTimeZoneTransition", function getTimeZoneTransition(directionParam) {
  slotOf(this, "ZonedDateTime");
  if (directionParam === undefined) throw new TypeError("getTimeZoneTransition needs a direction");
  var direction;
  if (typeof directionParam === "string") {
    direction = directionParam;
  } else {
    var bag = optionsObject(directionParam, "getTimeZoneTransition");
    if (bag === undefined) throw new TypeError("getTimeZoneTransition needs a direction");
    if (bag.direction === undefined) throw new TypeError("getTimeZoneTransition needs a direction");
    direction = String(bag.direction);
  }
  if (direction !== "next" && direction !== "previous") {
    throw new RangeError("direction must be 'next' or 'previous', got " + direction);
  }
  return null;
});

// toLocaleString with no Intl to defer to. The spec lets an implementation
// without Intl fall back to toString, and every one of these types is required to
// HAVE the method — its absence is what the tests notice.
[[DP, "Duration"], [PDP, "PlainDate"], [PTP, "PlainTime"], [PDTP, "PlainDateTime"],
 [YMP, "PlainYearMonth"], [MDP, "PlainMonthDay"], [IP, "Instant"], [ZP, "ZonedDateTime"]]
  .forEach(function (pair) {
    def(pair[0], "toLocaleString", function toLocaleString() {
      slotOf(this, pair[1]);
      return this.toString();
    });
  });

// A built-in's `length` is the number of REQUIRED parameters the spec lists, and
// the implementations here name their optional ones (or all of them, for the
// constructors whose every argument is optional). Fixing the count by dropping
// parameters would mean reaching into `arguments` everywhere; the property is
// configurable, so state it instead.
function setLength(fn, n) {
  Object.defineProperty(fn, "length", { value: n, writable: false, enumerable: false, configurable: true });
}
[[Duration, 0], [PlainTime, 0], [PlainDateTime, 3], [PlainYearMonth, 2], [PlainMonthDay, 2],
 [PDP.until, 1], [PDP.since, 1], [PDTP.until, 1], [PDTP.since, 1], [YMP.until, 1], [YMP.since, 1],
 [ZP.until, 1], [ZP.since, 1], [IP.until, 1], [IP.since, 1], [PTP.until, 1], [PTP.since, 1],
 [PDTP.toZonedDateTime, 1], [PDTP.withPlainTime, 0], [ZP.withPlainTime, 0], [ZP["with"], 1],
 [PDP.toPlainDateTime, 0], [Now.zonedDateTimeISO, 0]].forEach(function (p) { setLength(p[0], p[1]); });

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
    // These are written as ordinary functions, so the engine gives them an
    // ordinary function's writable `prototype`. A built-in constructor's is
    // { writable: false, enumerable: false, configurable: false }.
    Object.defineProperty(c, "prototype", { writable: false, enumerable: false, configurable: false });
  }
})();
