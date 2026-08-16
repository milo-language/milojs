// An argument passed explicitly as `undefined` must behave like an absent one
// wherever the built-in has a default for it — the shape a forwarded optional
// parameter produces. Also pins substring's own clamping (negatives go to 0,
// out-of-order ends swap), which is NOT slice's, and lastIndexOf's fromIndex.
function p(n, f) { try { console.log(n, JSON.stringify(f())); } catch (e) { console.log(n, "THREW " + e); } }

const a = [1, 2, 3, 4];
const s = "abcd";

p("arr.slice", () => a.slice(1, undefined));
p("arr.fill", () => [1, 2, 3, 4].fill(9, 1, undefined));
p("arr.copyWithin", () => [1, 2, 3, 4].copyWithin(0, 2, undefined));
p("arr.join", () => a.join(undefined));
p("arr.flat", () => [1, [2, [3]]].flat(undefined));
p("arr.lastIndexOf", () => a.lastIndexOf(2, undefined));
p("str.slice", () => s.slice(1, undefined));
p("str.substring", () => s.substring(1, undefined));
p("str.substr", () => s.substr(1, undefined));
p("str.padStart", () => s.padStart(6, undefined));
p("str.padEnd", () => s.padEnd(6, undefined));
p("ta.subarray", () => Array.from(new Int8Array([1, 2, 3, 4]).subarray(1, undefined)));
p("ta.slice", () => Array.from(new Int8Array([1, 2, 3, 4]).slice(1, undefined)));
p("ta.fill", () => Array.from(new Int8Array([1, 2, 3, 4]).fill(9, 1, undefined)));
p("ta.join", () => new Int8Array([1, 2]).join(undefined));

// substring is not slice
const t = "abcdef";
const pairs = [[-2], [1, -1], [-3, -1], [2, 1], [-1, -3], [0, 100], [100], [-100, 2]];
for (const c of pairs) {
  console.log("slice(" + c + ")=" + JSON.stringify(t.slice.apply(t, c)) +
    " substring(" + c + ")=" + JSON.stringify(t.substring.apply(t, c)));
}

// lastIndexOf's fromIndex is the last index searched
const d = [1, 2, 3, 2];
console.log(d.lastIndexOf(2, 0), d.lastIndexOf(2, 2), d.lastIndexOf(2, -2), d.lastIndexOf(2));
