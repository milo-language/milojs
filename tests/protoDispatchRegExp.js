// RegExp methods dispatch through RegExp.prototype, and the regex operations
// run in the spec's direction: String.prototype.match/replace/search/split/
// matchAll hand themselves to the argument's @@match (etc.), and those, like
// test, reach the regex only through its user-visible exec. The native paths
// are a shortcut that holds only while RegExp.prototype is untouched.

function tryIt(label, f) {
  try {
    console.log(label, f());
  } catch (e) {
    console.log(label, e.constructor.name);
  }
}

console.log(Object.getOwnPropertyNames(RegExp.prototype).join());
for (const k of Reflect.ownKeys(RegExp.prototype)) {
  const d = Object.getOwnPropertyDescriptor(RegExp.prototype, k);
  if (typeof d.value === "function" && k !== "constructor") {
    console.log(" ", String(k), d.value.length, d.value.name, d.writable, d.enumerable, d.configurable);
  } else if (d.get) {
    console.log(" ", String(k), "get", d.get.name, d.get.length, d.set, d.enumerable, d.configurable);
  }
}

const re = /b(c)?/g;

// identity, computed access, own properties
console.log("identity:", re.test === RegExp.prototype.test, re.exec === RegExp.prototype.exec, re[Symbol.replace] === RegExp.prototype[Symbol.replace]);
console.log("computed:", /x/["te" + "st"]("axb"), /x/["ex" + "ec"]("x")[0]);
re.label = function () { return "own"; };
console.log("own method:", re.label(), re.hasOwnProperty("label"), re.hasOwnProperty("test"));
delete re.label;

// brand checks: exec and compile need a regex; test and the symbol methods take
// any object and go through its exec
tryIt("exec on plain:", () => RegExp.prototype.exec.call({}, "a"));
tryIt("compile on plain:", () => RegExp.prototype.compile.call({}, "a"));
tryIt("test on primitive:", () => RegExp.prototype.test.call("a", "a"));
tryIt("match on primitive:", () => RegExp.prototype[Symbol.match].call(1, "a"));
tryIt("test on exec-less object:", () => RegExp.prototype.test.call({}, "a"));
console.log("test on exec object:", RegExp.prototype.test.call({ exec(s) { return s === "yes" ? {} : null; } }, "yes"));
tryIt("exec returning a primitive:", () => RegExp.prototype.test.call({ exec() { return 1; } }, "a"));
console.log("toString generic:", RegExp.prototype.toString.call({ source: "src", flags: "fl" }));
tryIt("Object.create receiver:", () => Object.create(RegExp.prototype).exec("a"));
tryIt("Object.create test:", () => Object.create(RegExp.prototype).test("a"));

// override on the prototype
const origTest = RegExp.prototype.test;
RegExp.prototype.test = function () { return "patched test"; };
console.log("test override:", /a/.test("a"), /a/["test"]("a"));
RegExp.prototype.test = origTest;

const origExec = RegExp.prototype.exec;
const seen = [];
RegExp.prototype.exec = function (s) {
  seen.push(this.source + "@" + this.lastIndex);
  return origExec.call(this, s);
};
console.log("test via exec:", /o/.test("foo"));
console.log("replace via exec:", "a-b-c".replace(/-/g, "+"));
console.log("match via exec:", "a1b22".match(/\d+/g));
console.log("search via exec:", "abc".search(/c/));
console.log("split via exec:", "a,b".split(/,/));
console.log("matchAll via exec:", [..."x1y2".matchAll(/\d/g)].map((m) => m[0] + m.index));
console.log("string arg via exec:", "q7".match("\\d")[0]);
console.log("exec calls:", seen.length > 10, seen.slice(0, 4));
RegExp.prototype.exec = origExec;

// an own exec on one regex
const fake = /zzz/;
fake.exec = function () { return { 0: "FAKE", length: 1, index: 1 }; };
console.log("own exec:", fake.test("abc"), "abc".replace(fake, "<$&>"), "abc".match(fake)[0], "abc".search(fake));

// the symbol methods on the argument are what String.prototype calls
const matcher = {
  [Symbol.match](s) { return "match:" + s; },
  [Symbol.replace](s, r) { return "replace:" + s + ":" + r; },
  [Symbol.search](s) { return "search:" + s; },
  [Symbol.split](s, lim) { return "split:" + s + ":" + lim; },
};
console.log("custom:", "abc".match(matcher), "abc".replace(matcher, "R"), "abc".search(matcher), "abc".split(matcher, 3));
console.log("custom matchAll:", "abc".matchAll({ [Symbol.matchAll](s) { return "matchAll:" + s; } }));
// an object with @@match counts as a regex for matchAll, and then needs a "g" in its flags
tryIt("IsRegExp flags:", () => "abc".matchAll({ [Symbol.match]: true, [Symbol.matchAll]() { return 1; } }));
console.log("IsRegExp global:", "abc".matchAll({ [Symbol.match]: true, flags: "g", [Symbol.matchAll]() { return "ok"; } }));
tryIt("non-callable @@match:", () => "abc".match({ [Symbol.match]: 5 }));

// patched symbol methods on RegExp.prototype reach a real regex
const origSplit = RegExp.prototype[Symbol.split];
RegExp.prototype[Symbol.split] = function (s, lim) { return ["patched split", s, lim]; };
console.log("split override:", "a,b".split(/,/, 2));
RegExp.prototype[Symbol.split] = origSplit;
console.log("split restored:", "a,b".split(/,/));

// replace with the spec's GetSubstitution and a function replacer
console.log("substitution:", "abcd".replace(/(b)(c)/, "[$2$1|$&|$`|$'|$$|$3|$10|$<n>]"));
console.log("named:", "2020-01".replace(/(?<y>\d+)-(?<m>\d+)/, "$<m>/$<y>"));
console.log("fn replacer:", "a1b2".replace(/(\d)/g, (m, d, off, s) => "<" + d + off + s.length + ">"));

// a subclass overriding exec or a symbol method
class Counting extends RegExp {
  exec(s) {
    this.count = (this.count || 0) + 1;
    return super.exec(s);
  }
}
const cr = new Counting("a", "g");
console.log("subclass slots:", cr.source, cr.flags, cr.global, cr.lastIndex);
console.log("subclass exec:", "banana".replace(cr, "o"), cr.count, cr instanceof RegExp, Object.prototype.toString.call(cr));
class Custom extends RegExp {
  [Symbol.match]() { return "CUSTOM"; }
}
console.log("subclass symbol:", "abc".match(new Custom("b")));

// replaceAll and matchAll reject a non-global regex
tryIt("replaceAll non-global:", () => "aa".replace(/a/, "b") + "aa".replaceAll(/a/, "b"));
tryIt("matchAll non-global:", () => "aa".matchAll(/a/));
console.log("replaceAll global:", "aa".replaceAll(/a/g, "b"));

// @@matchAll on a non-global regex yields one match
const it = RegExp.prototype[Symbol.matchAll].call(/a/, "aaa");
console.log("matchAll iterator:", Object.prototype.toString.call(it), [...it].length);

// deleting a method removes it
const savedTest = RegExp.prototype.test;
delete RegExp.prototype.test;
tryIt("deleted test:", () => /a/.test("a"));
console.log("in:", "test" in /a/);
RegExp.prototype.test = savedTest;
console.log("put back:", /a/.test("a"));
const savedMatch = RegExp.prototype[Symbol.match];
delete RegExp.prototype[Symbol.match];
tryIt("deleted @@match:", () => "a/a/".match(/a/));
RegExp.prototype[Symbol.match] = savedMatch;
