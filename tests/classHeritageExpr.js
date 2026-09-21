// ClassHeritage is any LeftHandSideExpression, evaluated once at class
// creation: a mixin call, a member read (its getter runs), a class expression,
// a parenthesised name, null. A non-constructor heritage is a TypeError with
// node's message.
function t(f) { try { f(); return "ok"; } catch (e) { return e.constructor.name; } }
console.log(t(() => { class C extends 42 {} }), t(() => { class C extends Math.abs {} }), t(() => { class C extends null {} }), t(() => { class C extends undefined {} }), t(() => { class C extends (() => 1) {} }), t(() => { class C extends Object {} }));
const Mixin = (B) => class extends B { m() { return "mixed:" + this.base(); } };
class Base { base() { return "b"; } }
class D extends Mixin(Base) {} console.log(new D().m(), new D() instanceof Base);
const ns = { get Base() { console.log("heritage read"); return Base; } };
class E extends ns.Base { base() { return "e" + super.base(); } } console.log(new E().base());
class F extends class { z() { return 9; } } {} console.log(new F().z());
class G extends null {} console.log(Object.getPrototypeOf(G.prototype), Object.getPrototypeOf(G) === Function.prototype);
class H extends (Base) {} console.log(new H().base());
class I extends Array {} console.log(new I(1, 2).length, Array.isArray(new I()));
for (const f of [()=>{class C extends 42{}}, ()=>{class C extends Math.abs{}}, ()=>{class C extends (()=>1){}}, ()=>{class C extends {}{}}, ()=>{class C extends undefined{}}]) try{f()}catch(e){console.log(e.message)}
