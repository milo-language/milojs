// `delete base.k` on a nullish base must throw a TypeError from the spec's
// ToObject step, before anything is deleted. milojs answered true and deleted
// nothing, so `delete null.a` silently succeeded. The `super` case is the reason
// the fix has to yield to an ALREADY-pending exception: evaluating that base
// raises a ReferenceError, which a blanket TypeError would have masked.
function t(n,f){ try { console.log(n, JSON.stringify(f())); } catch(e){ console.log(n, "threw", e.constructor.name); } }
t("obj", () => { var a={x:1,y:1}; return [delete a.x, "x" in a]; });
t("str-idx", () => delete "abc"[100]);
t("null-prop", () => { delete null.a; return "no-throw"; });
t("super", () => { var a={ f(){ delete super.a; } }; a.f(); return "no-throw"; });
t("undef-prop", () => { delete undefined.a; return "no-throw"; });
t("nonconfig", () => { var o={}; Object.defineProperty(o,"k",{value:1,configurable:false}); return delete o.k; });
