// URLSearchParams was missing delete, sort, keys, values and size; entries()
// handed back a plain ARRAY rather than an iterator; toString used
// encodeURIComponent instead of the form-urlencoded serialiser (a space is "+",
// not %20); and no method brand-checked its receiver, which node reports as
// ERR_INVALID_THIS and which was the largest failure bucket in the whatwg area.
const sp = new URLSearchParams("a=1&b=2&a=3&c=hello world");
console.log("size:", sp.size);
console.log("keys:", [...sp.keys()].join(","));
console.log("values:", [...sp.values()].join(","));
console.log("entries:", JSON.stringify([...sp.entries()]));
console.log("toString:", sp.toString());
console.log("iterator tag:", Object.prototype.toString.call(sp.entries()));
sp.delete("a");
console.log("after delete a:", sp.toString());
const s2 = new URLSearchParams("c=1&a=2&b=3&a=1");
s2.sort();
console.log("sorted:", s2.toString());
console.log("has(a,2):", s2.has("a", "2"), "has(a,9):", s2.has("a", "9"));
try { URLSearchParams.prototype.get.call({}, "x"); } catch (e) { console.log("brand:", e.code, "|", e.message); }
const u = new URL("http://x/y?q=1");
console.log("toJSON:", u.toJSON(), "| stringify:", JSON.stringify({ u }));
console.log("tag:", Object.prototype.toString.call(u));
