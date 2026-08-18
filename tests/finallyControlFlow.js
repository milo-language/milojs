// How an abrupt completion crosses `finally`. execTry carried `return` and a
// pending throw across the finally block but dropped `break` and `continue`, so
// `for(;;){ try { break } finally {} }` swallowed the break and HUNG. The last
// four cases are the ones that pin the precedence rule: a finally that completes
// abruptly REPLACES whatever try/catch left pending.
function t(name, fn) { try { console.log(name, JSON.stringify(fn())); } catch (e) { console.log(name, "threw", e.message); } }
t("break-thru", () => { var s=""; for(;;){ try { s+="t"; break; } finally { s+="f"; } } return s; });
t("cont-thru", () => { var s=""; for(var i=0;i<3;i++){ try { if(i==1) continue; s+=i; } finally { s+="f"; } } return s; });
t("labeled-break", () => { var s=""; outer: for(var i=0;i<3;i++){ for(var j=0;j<3;j++){ try { s+="x"; break outer; } finally { s+="f"; } } } return s; });
t("fin-overrides-break", () => { var s=""; for(var i=0;i<3;i++){ try { break; } finally { s+="f"; continue; } } return s; });
t("fin-overrides-ret", () => { function g(){ try { return "a"; } finally { return "b"; } } return g(); });
t("ret-thru", () => { function g(){ var s=""; try { return "r"; } finally { s+="f"; } } return g(); });
t("throw-thru", () => { var s=""; try { try { throw new Error("e"); } finally { s+="f"; } } catch(e){ s+="c"; } return s; });
t("break-in-catch", () => { var s=""; for(;;){ try { throw new Error("x"); } catch(e) { s+="c"; break; } finally { s+="f"; } } return s; });
t("nested-fin", () => { var s=""; for(;;){ try { try { break; } finally { s+="i"; } } finally { s+="o"; } } return s; });
t("cont-in-catch", () => { var s=""; for(var i=0;i<2;i++){ try { throw 1; } catch(e){ continue; } finally { s+="f"; } } return s; });
