// Spec-derived assertions for Temporal. NOT a tests/ fixture, and deliberately
// so: every fixture in tests/ is diffed byte-for-byte against node, and this
// node has no Temporal at all — the differential oracle simply does not reach
// here. test262's Temporal tree is the real gate; this file is the fast local
// check that the arithmetic is right, with each expectation traceable to the
// spec rather than to another implementation.
var failures = 0, checks = 0;
function eq(actual, expected, what) {
  checks++;
  var a = String(actual);
  if (a !== String(expected)) { failures++; console.log("FAIL " + what + ": got " + a + ", want " + expected); }
}
function throws(fn, ctor, what) {
  checks++;
  try { fn(); failures++; console.log("FAIL " + what + ": no throw"); }
  catch (e) { if (!(e instanceof ctor)) { failures++; console.log("FAIL " + what + ": " + e.constructor.name); } }
}

var T = Temporal;
// PlainDate: the civil-calendar algorithm, at the boundaries that catch an
// off-by-one in the era arithmetic
eq(new T.PlainDate(2026, 8, 16).toString(), "2026-08-16", "PlainDate.toString");
eq(T.PlainDate.from("2024-02-29").day, 29, "leap day");
throws(function () { T.PlainDate.from("2023-02-29"); }, RangeError, "non-leap Feb 29");
eq(new T.PlainDate(2026, 8, 16).dayOfWeek, 7, "dayOfWeek Sunday");
eq(new T.PlainDate(2026, 8, 17).dayOfWeek, 1, "dayOfWeek Monday");
eq(new T.PlainDate(2026, 12, 31).dayOfYear, 365, "dayOfYear non-leap");
eq(new T.PlainDate(2024, 12, 31).dayOfYear, 366, "dayOfYear leap");
eq(new T.PlainDate(1900, 3, 1).dayOfWeek, 4, "1900 is not a leap year");
eq(new T.PlainDate(2000, 3, 1).dayOfWeek, 3, "2000 is a leap year");
eq(new T.PlainDate(-1, 1, 1).toString(), "-000001-01-01", "negative year format");
eq(new T.PlainDate(275760, 9, 13).toString(), "+275760-09-13", "six-digit year format");
// month arithmetic clamps into the target month, days do not
eq(new T.PlainDate(2026, 1, 31).add({ months: 1 }).toString(), "2026-02-28", "add month clamps");
eq(new T.PlainDate(2024, 1, 31).add({ months: 1 }).toString(), "2024-02-29", "add month clamps in leap year");
eq(new T.PlainDate(2026, 12, 30).add({ days: 5 }).toString(), "2027-01-04", "add days crosses year");
eq(new T.PlainDate(2024, 2, 29).subtract({ years: 1 }).toString(), "2023-02-28", "subtract year off leap day");
eq(new T.PlainDate(2026, 3, 1).subtract({ days: 1 }).toString(), "2026-02-28", "subtract day");
eq(T.PlainDate.compare("2026-01-01", "2025-01-01"), 1, "compare later");
eq(T.PlainDate.compare("2025-01-01", "2025-01-01"), 0, "compare equal");
eq(new T.PlainDate(2026, 1, 1).until("2026-03-01").days, 59, "until days");
eq(new T.PlainDate(2026, 3, 1).since("2026-01-01").days, 59, "since days");

// PlainTime
eq(new T.PlainTime(1, 2, 3).toString(), "01:02:03", "PlainTime.toString");
eq(new T.PlainTime(0, 0, 0, 1).toString(), "00:00:00.001", "millisecond fraction");
eq(new T.PlainTime(0, 0, 0, 0, 0, 1).toString(), "00:00:00.000000001", "nanosecond fraction");
eq(T.PlainTime.from("12:34:56.789").millisecond, 789, "parse fraction");
eq(new T.PlainTime(23, 59, 59).add({ seconds: 1 }).toString(), "00:00:00", "time wraps at midnight");
eq(new T.PlainTime(0, 0, 0).subtract({ nanoseconds: 1 }).toString(), "23:59:59.999999999", "time wraps backwards");
throws(function () { new T.PlainTime(24); }, RangeError, "hour 24");

// PlainDateTime
eq(T.PlainDateTime.from("2026-08-16T12:30:45").toString(), "2026-08-16T12:30:45", "PlainDateTime round trip");
eq(new T.PlainDateTime(2026, 8, 16, 23, 30).add({ hours: 1 }).toString(), "2026-08-17T00:30:00", "hour carries the date");
eq(new T.PlainDateTime(2026, 8, 16, 0, 30).subtract({ hours: 1 }).toString(), "2026-08-15T23:30:00", "hour borrows the date");
eq(T.PlainDateTime.from("2026-08-16T12:00").toPlainDate().toString(), "2026-08-16", "toPlainDate");

// Duration
eq(T.Duration.from("P1Y2M3DT4H5M6S").toString(), "P1Y2M3DT4H5M6S", "duration round trip");
eq(T.Duration.from({ hours: 1, minutes: 30 }).toString(), "PT1H30M", "duration from fields");
eq(new T.Duration().toString(), "PT0S", "zero duration");
eq(T.Duration.from("PT1.5S").milliseconds, 500, "fractional seconds");
eq(T.Duration.from({ hours: -1 }).sign, -1, "negative sign");
eq(new T.Duration().blank, true, "blank");
throws(function () { new T.Duration(1, -1); }, RangeError, "mixed signs");

// Instant: epoch nanoseconds must stay exact past 2^53
eq(T.Instant.from("1970-01-01T00:00:00Z").epochNanoseconds, 0n, "epoch");
eq(T.Instant.from("2026-08-16T12:00:00Z").epochNanoseconds, 1786881600000000000n, "instant ns exact");
eq(T.Instant.fromEpochMilliseconds(1000).epochNanoseconds, 1000000000n, "fromEpochMilliseconds");
eq(T.Instant.from("2026-08-16T12:00:00Z").toString(), "2026-08-16T12:00:00Z", "instant round trip");
eq(T.Instant.from("2026-08-16T12:00:00+02:00").toString(), "2026-08-16T10:00:00Z", "offset applied");
eq(T.Instant.from("1969-12-31T23:59:59Z").epochNanoseconds, -1000000000n, "negative epoch");
eq(T.Instant.from("1969-12-31T23:59:59Z").toString(), "1969-12-31T23:59:59Z", "negative epoch round trip");
throws(function () { new T.Instant(1); }, TypeError, "Instant needs a BigInt");

// shape: branding, tags, and valueOf refusing to be a primitive
eq(Object.prototype.toString.call(new T.PlainDate(2026, 1, 1)), "[object Temporal.PlainDate]", "toStringTag");
throws(function () { new T.PlainDate(2026, 1, 1).valueOf(); }, TypeError, "PlainDate.valueOf");
throws(function () { Object.getOwnPropertyDescriptor(T.PlainDate.prototype, "year").get.call({}); }, TypeError, "brand check");
throws(function () { T.PlainDate(2026, 1, 1); }, TypeError, "PlainDate needs new");

// PlainYearMonth
eq(new T.PlainYearMonth(2026, 8).toString(), "2026-08", "PlainYearMonth.toString");
eq(T.PlainYearMonth.from("2024-02").daysInMonth, 29, "leap February length");
eq(T.PlainYearMonth.from("2023-02").daysInMonth, 28, "non-leap February length");
eq(new T.PlainYearMonth(2026, 12).add({ months: 1 }).toString(), "2027-01", "year-month rolls over");
eq(new T.PlainYearMonth(2026, 1).subtract({ months: 1 }).toString(), "2025-12", "year-month rolls back");
eq(new T.PlainYearMonth(2026, 1).until("2027-03").months, 14, "year-month until");
eq(T.PlainYearMonth.compare("2026-02", "2026-01"), 1, "year-month compare");
eq(new T.PlainYearMonth(2026, 8).toPlainDate({ day: 16 }).toString(), "2026-08-16", "year-month toPlainDate");

// PlainMonthDay: the reference year is 1972 so that 02-29 exists
eq(new T.PlainMonthDay(8, 16).toString(), "08-16", "PlainMonthDay.toString");
eq(T.PlainMonthDay.from("--02-29").day, 29, "Feb 29 month-day");
eq(new T.PlainMonthDay(2, 29).toString(), "02-29", "Feb 29 needs no reference year");
eq(new T.PlainMonthDay(8, 16).toPlainDate({ year: 2026 }).toString(), "2026-08-16", "month-day toPlainDate");
throws(function () { new T.PlainMonthDay(2, 30); }, RangeError, "Feb 30");

// ZonedDateTime: UTC and fixed offsets
eq(T.ZonedDateTime.from("2026-08-16T12:00:00Z[UTC]").toString(), "2026-08-16T12:00:00+00:00[UTC]", "zoned round trip");
eq(T.ZonedDateTime.from("2026-08-16T12:00:00Z[UTC]").epochNanoseconds, 1786881600000000000n, "zoned epoch");
eq(T.ZonedDateTime.from("2026-08-16T12:00:00+02:00[+02:00]").toString(), "2026-08-16T12:00:00+02:00[+02:00]", "fixed offset round trip");
eq(T.ZonedDateTime.from("2026-08-16T12:00:00+02:00[+02:00]").toInstant().toString(), "2026-08-16T10:00:00Z", "offset to instant");
eq(T.ZonedDateTime.from("2026-08-16T12:00:00Z[UTC]").withTimeZone("+05:30").hour, 17, "withTimeZone shifts the wall clock");
eq(T.ZonedDateTime.from("2026-08-16T12:00:00Z[UTC]").withTimeZone("+05:30").epochNanoseconds, 1786881600000000000n, "withTimeZone keeps the instant");
eq(T.ZonedDateTime.from("2026-08-16T23:30:00Z[UTC]").add({ hours: 1 }).toString(), "2026-08-17T00:30:00+00:00[UTC]", "zoned add crosses the day");
eq(T.ZonedDateTime.from("2026-08-16T12:00:00Z[UTC]").toPlainDate().toString(), "2026-08-16", "zoned toPlainDate");
// a named zone is REFUSED rather than silently treated as UTC
throws(function () { T.ZonedDateTime.from("2026-08-16T12:00:00Z[America/New_York]"); }, RangeError, "named zone refused");
throws(function () { T.ZonedDateTime.from("2026-08-16T12:00:00Z"); }, RangeError, "zoned needs an annotation");

console.log(failures === 0 ? ("temporal-checks: " + checks + " checks, all ok") : ("temporal-checks: " + failures + " of " + checks + " FAILED"));
