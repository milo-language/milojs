// A hole is not an undefined element. The engine already modelled holes for
// `in`, Object.keys, hasOwnProperty and delete, but every iteration method
// ignored them: forEach/some/every/reduce visited holes, filter/flat/flatMap
// kept them, map/slice/concat filled them in, indexOf matched one, and sort
// moved elements under a holes list that names INDICES.
function p(n,f){ try { console.log(n, JSON.stringify(f())); } catch(e){ console.log(n,"THREW "+String(e)); } }
p("flat", () => [1,,3].flat());
p("flatMap", () => [1,,3].flatMap(x=>[x]));
p("filter", () => [1,,3].filter(()=>true));
p("forEachCount", () => { let c=0; [1,,3].forEach(()=>c++); return c; });
p("mapSparse", () => { const r=[1,,3].map(x=>x); return 1 in r; });
p("keys", () => Object.keys([1,,3]));
p("in", () => 1 in [1,,3]);
p("hasOwn", () => Object.prototype.hasOwnProperty.call([1,,3],1));
p("json", () => JSON.stringify([1,,3]));
p("join", () => [1,,3].join("-"));
p("delete", () => { const a=[1,2,3]; delete a[1]; return [a.length, 1 in a, Object.keys(a)]; });
p("someEvery", () => [[1,,3].some(x=>x===undefined), [1,,3].every(x=>x!==undefined)]);
p("reduceCount", () => { let c=0; [1,,3].reduce((a,b)=>{c++;return a;},0); return c; });
p("indexOfHole", () => [1,,3].indexOf(undefined));
p("includesHole", () => [1,,3].includes(undefined));
p("sortHoles", () => { const a=[3,,1]; a.sort(); return [a.length, 1 in a, 2 in a, JSON.stringify(a)]; });
p("spread", () => [...[1,,3]]);
p("forOf", () => { const r=[]; for (const v of [1,,3]) r.push(v); return r; });
p("entries", () => [...[1,,3].entries()].length);
p("concatHole", () => { const r=[1,,3].concat([4]); return [r.length, 1 in r]; });
p("sliceHole", () => { const r=[1,,3].slice(); return [r.length, 1 in r]; });
p("reverseHole", () => { const r=[1,,3].reverse(); return [r.length, 1 in r]; });
p("lenGrow", () => { const a=[]; a[3]=1; return [a.length, 0 in a, Object.keys(a)]; });

p("undefLast", () => { const a=["z",undefined,"a"]; a.sort(); return a; });
p("undefWithCmp", () => { const a=[3,undefined,1]; a.sort((x,y)=>x-y); return a; });
p("holesAndUndef", () => { const a=["z",,undefined,"a"]; a.sort(); return [a.length, 0 in a, 1 in a, 2 in a, 3 in a, JSON.stringify(a)]; });
p("stable", () => { const a=[{k:1,v:"a"},{k:1,v:"b"},{k:0,v:"c"}]; a.sort((x,y)=>x.k-y.k); return a.map(e=>e.v).join(""); });
p("numbersDefault", () => [10,9,1,2].sort());
p("cmpDesc", () => [1,5,3].sort((a,b)=>b-a));
p("empty", () => [].sort());
p("single", () => [1].sort());
p("allHoles", () => { const a=[,,,]; a.sort(); return [a.length, 0 in a]; });
p("bigMixed", () => { const a=[5,,3,undefined,1,,2]; a.sort(); return [a.length, JSON.stringify(a), 4 in a, 5 in a, 6 in a]; });
p("toSorted", () => { const a=[3,,1]; const b=a.toSorted(); return [JSON.stringify(b), 2 in b]; });
