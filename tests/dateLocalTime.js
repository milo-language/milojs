// milojs had no local timezone: getTimezoneOffset() was 0 and every "local"
// accessor decomposed in UTC, so local time WAS UTC engine-wide. std's
// fromEpochLocal is the host's real localtime, DST included, so the local and UTC
// families can differ correctly now. Get, set, the field constructor, toString and
// Date.parse all had to move together: splitting only some of them is what makes
// `d.setHours(d.getHours())` shift the date.
//
// Everything below is TIMEZONE-INDEPENDENT on purpose. Absolute local values would
// pin this to the machine node was run on; these check RELATIONSHIPS, which hold
// under any TZ (including TZ=UTC, where every offset is 0).
var samples = [0, 1589736030000, 1700000000000, 1720000000000, -86400000];

// The local/UTC field gap is exactly getTimezoneOffset.
console.log("offset-consistent:", samples.map(function (t) {
  var d = new Date(t);
  var localAsUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(),
                            d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return (t - localAsUtc) / 60000 === d.getTimezoneOffset();
}).join(","));

// The field constructor reads its arguments as LOCAL, so it round-trips.
console.log("ctor-roundtrip:", samples.map(function (t) {
  var d = new Date(t);
  var r = new Date(d.getFullYear(), d.getMonth(), d.getDate(),
                   d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  return r.getTime() === t;
}).join(","));

// Reading a local field and writing it straight back must not move the instant.
console.log("set-get-identity:", samples.map(function (t) {
  var d = new Date(t); d.setHours(d.getHours()); return d.getTime() === t;
}).join(","));
console.log("set-get-identity-utc:", samples.map(function (t) {
  var d = new Date(t); d.setUTCHours(d.getUTCHours()); return d.getTime() === t;
}).join(","));

// A date-TIME with no designator is local; the same string with Z is UTC. The gap
// between them is the offset at that instant.
console.log("parse-noZ-is-local:", (function () {
  var withZ = Date.parse("2020-05-17T10:20:30Z");
  var bare = Date.parse("2020-05-17T10:20:30");
  // local is LATER than UTC by the offset west of Greenwich, and
  // getTimezoneOffset is the minutes to add to local to reach UTC
  return (bare - withZ) / 60000 === new Date(bare).getTimezoneOffset();
})());

// A date-ONLY form is UTC even with no designator.
console.log("date-only-is-utc:", Date.parse("2020-05-17") === Date.UTC(2020, 4, 17));

// Explicit offsets are absolute, so these are the same instant everywhere.
console.log("explicit-offsets:",
  Date.parse("2020-05-17T10:20:30+05:00") === Date.parse("2020-05-17T05:20:30Z"),
  Date.parse("2020-05-17T10:20:30-08:00") === Date.parse("2020-05-17T18:20:30Z"));

// The UTC family and toISOString are unaffected by the host zone.
var d = new Date("2020-05-17T17:20:30.000Z");
console.log("utc-family:", d.toISOString(), d.getUTCHours(), d.getUTCDate(), d.toUTCString());

// toString renders local: its numeric offset must agree with getTimezoneOffset.
console.log("tostring-offset-agrees:", (function () {
  var m = /GMT([+-])(\d\d)(\d\d)/.exec(new Date(1589736030000).toString());
  if (!m) return "no offset in toString";
  var mins = (+m[2]) * 60 + (+m[3]);
  if (m[1] === "-") mins = -mins;
  return -mins === new Date(1589736030000).getTimezoneOffset();
})());
