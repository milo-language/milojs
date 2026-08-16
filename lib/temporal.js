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
  if (o === null || typeof o !== "object") throw new TypeError("options must be an object");
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
  if (o === null || typeof o !== "object") throw new TypeError("options must be an object");
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
def(PDP, "until", function until(other) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return new Duration(0, 0, 0, epochDayFromISO(b.year, b.month, b.day) - epochDayFromISO(a.year, a.month, a.day));
});
def(PDP, "since", function since(other) {
  var a = slotOf(this, "PlainDate"), b = slotOf(PlainDate.from(other), "PlainDate");
  return new Duration(0, 0, 0, epochDayFromISO(a.year, a.month, a.day) - epochDayFromISO(b.year, b.month, b.day));
});
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
    return new PlainDate(item.year, mo, item.day);
  }
  var str = String(item);
  var m = DATE_RE.exec(str.length > 10 ? str.slice(0, str.indexOf("T") < 0 ? str.length : str.indexOf("T")) : str);
  if (!m) throw new RangeError("invalid ISO date string: " + str);
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
  if (o === null || typeof o !== "object") throw new TypeError("options must be an object");
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
  if (o === null || typeof o !== "object") throw new TypeError("options must be an object");
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
    return new PlainDateTime(item.year, mo, item.day, item.hour, item.minute, item.second,
      item.millisecond, item.microsecond, item.nanosecond);
  }
  var str = String(item);
  var ti = str.indexOf("T");
  var dm = DATE_RE.exec(ti < 0 ? str : str.slice(0, ti));
  if (!dm) throw new RangeError("invalid ISO date-time string: " + str);
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

var Temporal = {};
tag(Temporal, "Temporal");
def(Temporal, "Duration", Duration);
def(Temporal, "PlainDate", PlainDate);
def(Temporal, "PlainTime", PlainTime);
def(Temporal, "PlainDateTime", PlainDateTime);
def(Temporal, "Instant", Instant);
def(Temporal, "Now", Now);
globalThis.Temporal = Temporal;
})();
