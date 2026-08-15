// console.log / util.inspect rendering, pinned byte-exact to node. milojs used
// to reproduce BUN here (double-quoted nested strings, every object broken across
// lines with a trailing comma, no array column grouping), which made 17 of the
// engine fixtures' .expected files disagree with node. This is the regression lock
// for node's util.inspect defaults: depth 2, breakLength 80, compact 3.
//
// Still divergent, deliberately not covered here (see docs/backlog.md):
//   class Foo{}            node: [class Foo]                milojs: [Function: Foo]
//   Object.create(null)    node: [Object: null prototype] { … }
const cases = [
  [1,2,3], ['a','b'], [], {}, {x:1}, {x:1,y:2}, {x:1,y:2,z:3},
  {a:'hi'}, {'a-b':1}, {'0':1}, {$x:1,_y:2},
  [1,2,3,4,5,6,7], [1,2,3,4,5,6], ['aaaa','bbbb','cccc','dddd','eeee','ffff','gggg'],
  {nested:{a:1,b:2}}, {deep:{a:{b:{c:1}}}},
  [[1,2],[3,4]], [{a:1},{b:2}],
  {s:"it's"}, {s:'say "hi"'}, {s:`both ' and "`}, {s:'tab\there'}, {s:'nl\nhere'},
  {n:null,u:undefined,t:true,f:false,z:0,neg:-0,nan:NaN,inf:Infinity},
  {big:10n}, {sym:Symbol('s')}, {fn:function foo(){}}, {arrow:()=>1}, {anon:function(){}},
  new Map([['a',1]]), new Set([1,2]), new Date(0), /ab+c/gi,
  {longish:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
  {a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8},
  [1,'two',{three:3}],
];
for (const c of cases) console.log(c);

const cs = [
  {a:{b:{c:{d:1}}}}, [[[[1]]]], {a:[1,2],b:{c:[3,4]}},
  Array.from({length:20},(_,i)=>i), Array.from({length:30},(_,i)=>i*1000),
  Array.from({length:8},(_,i)=>'s'+i), Array.from({length:7},(_,i)=>i*11111),
  ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','b','c','d','e','f','g'],
  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],
  {'':1}, {'a b':2}, {'123abc':3}, {'_ok':4}, {'a0':5},
  {s:'\x00\x1b\x7f'}, {s:'back\\slash'}, {s:"quote'and\"both`tick"},
  {arr:['x','y'],o:{p:'q'}},
{m:new Map()}, {se:new Set()},
  new Map([['k',{a:1}],['j',[1,2]]]),
  new Set(['a','b']),
  {re:/x/g}, {d:new Date(86400000)},
  {u:undefined}, [undefined,null], [,,1],
  {a:1,b:'two',c:[3],d:{e:4},f:null},

  {veryLongKeyNameHere:'and a fairly long value string here too ok'},
  [{aaa:1,bbb:2},{ccc:3,ddd:4},{eee:5,fff:6}],
];
for (const c of cs) console.log(c);
console.log('multi', {a:1}, [1,2], 'end');
