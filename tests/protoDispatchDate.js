// Date methods dispatch through Date.prototype: an override is honoured on
// instances and subclasses, extracted methods are the prototype's own functions,
// and a receiver without a [[DateValue]] slot is a TypeError. The direct call
// used to go straight to the native whatever Date.prototype held.

function tryIt(label, f) {
  try {
    console.log(label, f());
  } catch (e) {
    console.log(label, e.constructor.name);
  }
}

const names = Object.getOwnPropertyNames(Date.prototype);
console.log(names.length, names.join());
for (const k of names) {
  const d = Object.getOwnPropertyDescriptor(Date.prototype, k);
  if (typeof d.value === "function" && k !== "constructor") {
    console.log(" ", k, d.value.length, d.value.name, d.writable, d.enumerable, d.configurable);
  }
}
const tp = Object.getOwnPropertyDescriptor(Date.prototype, Symbol.toPrimitive);
console.log("toPrimitive:", tp.value.name, tp.value.length, tp.writable, tp.enumerable, tp.configurable);

const d = new Date(Date.UTC(2020, 1, 3, 4, 5, 6, 7));

// own properties on a date are ordinary
d.label = function () { return "own"; };
console.log("own method:", d.label(), d.hasOwnProperty("label"), d.hasOwnProperty("getTime"), d.propertyIsEnumerable("label"));

// identity and computed access
console.log("identity:", d.getTime === Date.prototype.getTime, d.toISOString === Date.prototype.toISOString, d["get" + "Time"] === d.getTime);
console.log("computed:", d["get" + "Time"](), d["to" + "ISOString"]());
console.log("symbol:", d[Symbol.toPrimitive] === Date.prototype[Symbol.toPrimitive], d[Symbol.toPrimitive]("number"));

// brand checks
tryIt("getTime on plain:", () => Date.prototype.getTime.call({}));
tryIt("getTime on number:", () => Date.prototype.getTime.call(5));
tryIt("toISOString on Map:", () => Date.prototype.toISOString.call(new Map()));
tryIt("setTime on array:", () => Date.prototype.setTime.call([], 1));
tryIt("valueOf on undefined:", () => Date.prototype.valueOf.call(undefined));
tryIt("Object.create receiver:", () => Object.create(Date.prototype).getTime());
tryIt("Object.create toString:", () => String(Object.create(Date.prototype)));
tryIt("extracted:", () => { const g = d.getUTCFullYear; return g.call(new Date(0)); });
tryIt("extracted unbound:", () => { const g = d.getUTCFullYear; return g(); });

// the generic Object.prototype methods reach a date receiver
console.log("generic:", Object.prototype.hasOwnProperty.call(d, "label"), Object.prototype.toString.call(d));

// override on the prototype
const origGetTime = Date.prototype.getTime;
Date.prototype.getTime = function () { return 42; };
console.log("override:", new Date(0).getTime(), d.getTime(), d["getTime"]());
console.log("other methods intact:", d.getUTCFullYear(), d.toISOString());
Date.prototype.getTime = origGetTime;
console.log("restored:", d.getTime());

// valueOf override drives arithmetic through ToPrimitive
const origValueOf = Date.prototype.valueOf;
Date.prototype.valueOf = function () { return 1000; };
console.log("valueOf override:", d - 0, +d);
Date.prototype.valueOf = origValueOf;

// toISOString override is what toJSON calls
const origISO = Date.prototype.toISOString;
Date.prototype.toISOString = function () { return "ISO!"; };
console.log("toJSON sees override:", d.toJSON(), JSON.stringify({ d }));
Date.prototype.toISOString = origISO;

// subclass prototype override
class D extends Date {
  getTime() { return "sub " + super.getTime(); }
  describe() { return this.getUTCDate(); }
}
const sd = new D(0);
console.log("subclass:", sd.getTime(), sd.describe(), sd instanceof Date, sd.getFullYear === Date.prototype.getFullYear);
console.log("subclass tag:", Object.prototype.toString.call(sd), sd.valueOf());

// deleting a method removes it
const savedGetDay = Date.prototype.getDay;
delete Date.prototype.getDay;
tryIt("deleted:", () => d.getDay());
console.log("in:", "getDay" in d);
console.log("saved still works:", savedGetDay.call(new Date(Date.UTC(2020, 1, 3))) >= 0);
Date.prototype.getDay = savedGetDay;
console.log("put back:", typeof d.getDay());

// an own property shadows the prototype
d.getTime = () => "shadow";
console.log("shadow:", d.getTime(), delete d.getTime, d.getTime() > 0);

// a date whose prototype was swapped out does not reach Date.prototype
const lone = new Date(0);
Object.setPrototypeOf(lone, null);
tryIt("null proto:", () => lone.getTime());
Object.setPrototypeOf(lone, { getTime() { return "custom proto"; } });
console.log("custom proto:", lone.getTime(), Date.prototype.getTime.call(lone));

// toJSON and @@toPrimitive are generic over any object
console.log("toJSON generic:", Date.prototype.toJSON.call({ toISOString() { return "fake"; } }));
console.log("toJSON non-finite:", Date.prototype.toJSON.call({ valueOf() { return NaN; }, toISOString() { return "no"; } }), new Date(NaN).toJSON());
tryIt("toJSON null:", () => Date.prototype.toJSON.call(null));
tryIt("toJSON no toISOString:", () => Date.prototype.toJSON.call({}));
const tpf = Date.prototype[Symbol.toPrimitive];
console.log("toPrimitive generic:", tpf.call({ valueOf() { return 7; }, toString() { return "s"; } }, "number"), tpf.call({ toString() { return "s"; } }, "default"));
tryIt("toPrimitive primitive:", () => tpf.call(1, "number"));
tryIt("toPrimitive bad hint:", () => tpf.call(d, "bogus"));
console.log("gmt:", Date.prototype.toGMTString === Date.prototype.toUTCString, d.toGMTString());
