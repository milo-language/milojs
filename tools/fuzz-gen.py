import random, sys
seed = int(sys.argv[1]); random.seed(seed)
V = ["a","b","c","o","arr","f","m","s"]
def val(d=0):
    if d > 2: return random.choice(["1","'x'","null","true","undefined"])
    return random.choice([
        "1","0","-1","'str'","null","undefined","true","NaN",
        "[%s]" % ",".join(val(d+1) for _ in range(random.randint(0,3))),
        "{%s}" % ",".join("k%d:%s" % (i,val(d+1)) for i in range(random.randint(0,3))),
        "new Map([['k',%s]])" % val(d+1),
        "new Set([%s])" % val(d+1),
        "(function(){return %s;})" % val(d+1),
        "Symbol('s')","new Date(0)","/re/g","new Int32Array([1,2])",
        "(()=>%s)" % val(d+1),
    ])
def stmt(d=0):
    v = random.choice(V)
    return random.choice([
        "var %s = %s;" % (v, val()),
        "%s = %s;" % (v, val()),
        "try { %s } catch(e) {}" % stmt(d+1) if d < 2 else "void 0;",
        "for (var i=0;i<3;i++) { %s }" % (stmt(d+1) if d < 2 else "void 0;"),
        "if (%s) { %s }" % (val(), stmt(d+1) if d < 2 else "void 0;"),
        "(function(){ %s })();" % (stmt(d+1) if d < 2 else "void 0;"),
        "[%s].forEach(function(x){ %s });" % (val(), stmt(d+1) if d < 2 else "void 0;"),
        "%s = [%s].map(function(x){ return x; });" % (v, val()),
        "JSON.stringify(%s);" % val(),
        "String(%s);" % val(),
        "Object.keys(Object(%s));" % val(),
        "(%s).toString();" % val(),
        "delete %s.k0;" % v,
        "%s = Object.assign({}, {q:%s});" % (v, val()),
        "function* g(){ yield %s; } [...g()];" % val(),
        "%s = structuredClone({z:%s});" % (v, val()),
    ])
print("var a,b,c,o,arr,f,m,s;")
for _ in range(random.randint(5, 25)):
    print(stmt())
print("console.log('FUZZ_OK');")
