// Two bugs in Array.prototype.join, both about nesting.
//
// The separator applies only at the level it was given: a nested array is
// converted by ToString, which is its own toString, which is join() with the
// DEFAULT comma. milojs recursed with the outer separator, so `[1,[2,3]].join("-")`
// came out "1-2-3" instead of "1-2,3".
//
// The cycle guard compared against the immediate receiver, which catches
// `a.push(a)` but not `a.push([a])`. An INDIRECT cycle recursed until the native
// stack died and the process exited 0 having printed nothing. It now tracks every
// array currently being joined, and pops on the way out so that the SAME array
// appearing twice at one level (repeat-sibling below) is not mistaken for a cycle.
function t(n,f){ try{ console.log(n, JSON.stringify(f())); }catch(e){ console.log(n,"ERR",e.constructor.name); } }
t("nested-sep", () => [1,[2,[3]]].join("-"));
t("nested-default", () => [1,[2,[3]]].join());
t("tostring", () => String([1,[2,3]]));
t("self-cycle", () => { var a=[1]; a.push(a); return a.join("-"); });
t("indirect-cycle", () => { var a=[1]; var b=[a]; a.push(b); return a.join("-"); });
t("deep-cycle", () => { var a=[1],b=[a],c=[b]; a.push(c); return a.join("|"); });
t("nulls", () => [null,undefined,1,[null]].join("-"));
t("empty-nested", () => [[],[[]],1].join("-"));
t("numeric-sep", () => [1,[2,3]].join(0));
t("repeat-sibling", () => { var inner=[1,2]; return [inner,inner].join("-"); });
