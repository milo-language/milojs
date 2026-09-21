// Object.defineProperty / defineProperties / create read the descriptor with
// [[Get]] (an accessor on it runs), a non-configurable accessor keeps its
// get/set, an array index accessor reads back, and create routes its second
// argument through the same ObjectDefineProperties as defineProperties.
var child = {}; Object.defineProperty(child, "writable", { get: function() { return true; } });
var obj = {}; Object.defineProperty(obj, "p", child);
console.log(JSON.stringify(Object.getOwnPropertyDescriptor(obj, "p")));
obj.p = "w"; console.log(obj.p);
var proto = {}; Object.defineProperty(proto, "writable", { get: function() { return false; } });
var c2 = Object.create(proto); Object.defineProperty(c2, "writable", { get: function() { return true; } });
var o2 = {}; Object.defineProperty(o2, "p", c2); o2.p = "w"; console.log(o2.p);
var o4 = {}; Object.defineProperty(o4, "foo", { get: function(){return 10}, set: function(){}, enumerable:false, configurable:false });
try { Object.defineProperties(o4, { foo: { get: function(){return 20} } }); console.log("no throw"); } catch (e) { console.log(e.constructor.name); } console.log(o4.foo);
var a = []; Object.defineProperty(a, "1", { get: function(){return 12}, set: undefined });
try { Object.defineProperty(a, "1", { set: function(){} }); console.log("no throw"); } catch (e) { console.log(e.constructor.name); } console.log(a[1]);
var o5 = {}; Object.defineProperty(o5, "x", { value: 1 }); try { Object.defineProperty(o5, "x", { value: 2 }); console.log("no throw"); } catch (e) { console.log(e.constructor.name); }
var o6 = Object.create({}, { prop: { configurable: {} , value: 3 } }); delete o6.prop; console.log(o6.hasOwnProperty("prop"));
var pr = new Proxy([1, 2, 3, 4], { get(t, k, r) { var junk = ["x" + String(k)]; return Reflect.get(t, k, r); } });
console.log(JSON.stringify(pr.concat([9, { z: 1 }])));
try { Object.create({}, { a: 5 }); } catch (e) { console.log(e.constructor.name); }
try { Object.create({}, null); } catch (e) { console.log(e.constructor.name); }
console.log(Object.keys(Object.create({}, { a: { value: 1, enumerable: true }, b: { value: 2 } })).join(","));
