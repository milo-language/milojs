// Date.prototype had 20 of node's 47 methods. The set*/setUTC* families were
// already implemented in dateMethod but never listed on the prototype, and
// toTimeString/toGMTString/getYear/setYear did not exist at all.
//
// It also disagreed with itself: the local getters decomposed in the HOST
// timezone while the setters decomposed in UTC and getTimezoneOffset reported 0
// — so `d.setHours(d.getHours())` shifted the date by the host offset. milojs
// carries no timezone database, so everything is UTC now: it behaves as node
// run under TZ=UTC. That is why this fixture only asserts the TZ-independent
// surface (getUTC*/setUTC*/toISOString/toUTCString) — the local-time forms are
// deliberately not pinned here, because node's output for them depends on where
// the capture ran.
const mk = () => new Date(Date.UTC(2020, 4, 15, 10, 30, 45, 123));
const d = mk();
console.log(d.toISOString(), d.toJSON(), d.getTime(), d.valueOf());
console.log(d.toUTCString());
console.log(d.toGMTString());
console.log(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCDay());
console.log(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());

const t = (label, f) => { const x = mk(); f(x); console.log(label, x.toISOString()); };
t('setUTCFullYear', x => x.setUTCFullYear(1999));
t('setUTCFullYear multi', x => x.setUTCFullYear(2001, 11, 25));
t('setUTCMonth', x => x.setUTCMonth(0));
t('setUTCDate', x => x.setUTCDate(1));
t('setUTCHours', x => x.setUTCHours(0));
t('setUTCHours multi', x => x.setUTCHours(1, 2, 3, 4));
t('setUTCMinutes', x => x.setUTCMinutes(5));
t('setUTCSeconds', x => x.setUTCSeconds(7));
t('setUTCMilliseconds', x => x.setUTCMilliseconds(9));
t('setTime', x => x.setTime(0));
// the round-trip that used to shift by the host offset
t('roundtrip', x => x.setUTCHours(x.getUTCHours()));

// invalid dates
const bad = new Date(NaN);
console.log(bad.getTime(), bad.toUTCString(), bad.toString(), bad.toDateString());

// the prototype's shape
console.log(Object.getPrototypeOf(mk()) === Date.prototype, mk() instanceof Date);
console.log(Object.getOwnPropertyNames(Date.prototype).length);
console.log(Date.prototype.getTime.name, Date.prototype.getTime.length);
console.log(Date.prototype.setHours.length, Date.prototype.setFullYear.length, Date.prototype.toISOString.length);
console.log(Date.name, Date.length, Date.UTC.length, Date.now.length, Date.parse.length);
console.log(typeof Date.prototype.getUTCSeconds, typeof Date.prototype.setUTCMilliseconds, typeof Date.prototype.toTimeString);
// generic dispatch through the prototype, uncurried
const getISO = Function.prototype.call.bind(Date.prototype.toISOString);
console.log(getISO(mk()));
