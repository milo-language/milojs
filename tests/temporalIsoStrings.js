// Temporal ISO strings carry ANNOTATIONS: the bracketed suffixes holding the time
// zone and the calendar. Each type used to have its own regex and none of them
// knew the grammar, so every real-world Temporal string was a RangeError.
// node has no Temporal, so this fixture is checked against the spec via test262
// and listed in tests/.node-oracle-exempt.
const accept = [
  "2000-05-02[u-ca=iso8601]",
  "2000-05-02[UTC][u-ca=iso8601]",
  "2000-05-02T15:23[!u-ca=iso8601]",
  "2000-05-02T15:23[u-ca=iso8601][u-ca=discord]",
  "2000-05-02[foo=bar]",
  "2000-05-02T15:23[UTC][foo=bar][u-ca=iso8601]",
  "2000-05-02t15:23",
  "2000-05-02 15:23",
  "2000-05-02T00+00",
  "2000-05-02T00+000000.000000000",
  "2000-05-02T00-02:30[America/St_Johns]",
  "20000502",
];
for (const s of accept) console.log("ok  ", s, "->", Temporal.PlainDate.from(s).toString());

const reject = [
  "1976-11-18T15:23:30.12−02:00",   // U+2212 minus, not ASCII
  "−009999-11-18T15:23:30.12",
  "2022-09-15Z",                          // an offset needs a time
  "2022-09-15+00:00",
  "2000-05-02T15:23[!foo=bar]",           // unknown annotation marked critical
  "2000-05-02T15:23[UTC][UTC]",           // two time zone annotations
  "2000-05-02T15:23[!u-ca=iso8601][u-ca=iso8601]",
];
for (const s of reject) {
  try { Temporal.PlainDate.from(s); console.log("SHOULD REJECT", JSON.stringify(s)); }
  catch (e) { console.log("rej ", JSON.stringify(s), e.constructor.name); }
}

// the same grammar reaches every type
console.log(Temporal.PlainDateTime.from("2000-05-02T15:23:30.5[u-ca=iso8601]").toString());
console.log(Temporal.PlainTime.from("15:23:30").toString(), Temporal.PlainTime.from("2000-05-02T15:23").toString());
console.log(Temporal.PlainYearMonth.from("2000-05").toString(), Temporal.PlainMonthDay.from("--05-02").toString());
// :60 is a leap second on the wire and clamps to :59
console.log(Temporal.PlainDateTime.from("2016-12-31T23:59:60").toString());
