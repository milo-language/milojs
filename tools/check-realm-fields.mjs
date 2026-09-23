// Every per-realm intrinsic must travel in both directions and be a GC root.
//
// Interp caches the running realm's intrinsics in its own fields, and
// src/engine/realm.milo copies them in and out on a realm switch. saveRealm
// builds a RealmIntrinsics literal, so the compiler already refuses a field it
// forgets. The other two lists are ordinary statements the compiler cannot
// check: loadRealm, which copies each field back, and markRealms in
// src/engine/runtime.milo, which roots each handle. A field missing from
// loadRealm would leave the PREVIOUS realm's intrinsic in the cache after a
// switch; one missing from markRealms would be swept while its realm is not
// running. Neither fails loudly. This does.
import { readFileSync } from "fs";

const REALM = "src/engine/realm.milo";
const RUNTIME = "src/engine/runtime.milo";

// Fields of RealmIntrinsics that are not object handles, and so are not marked
// as objects: a binding count, the typed-array prototype range bounds, and the
// guards. globalScope is a scope index and is marked with markScope.
const NOT_OBJECT = new Set(["builtinGlobals", "taProtoLo", "taProtoHi", "globalScope"]);

function body(src, header, file) {
  const at = src.indexOf(header);
  if (at < 0) {
    console.error(`check-realm-fields: '${header}' not found in ${file}; the check is broken, not clean`);
    process.exit(1);
  }
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i);
  }
  console.error(`check-realm-fields: unterminated '${header}' in ${file}`);
  process.exit(1);
}

const realmSrc = readFileSync(REALM, "utf-8");
const runtimeSrc = readFileSync(RUNTIME, "utf-8");

const fields = [...body(realmSrc, "pub struct RealmIntrinsics", REALM).matchAll(/^\s*([a-zA-Z]+)\s*:\s*([a-z0-9]+)\s*,/gm)]
  .map((m) => ({ name: m[1], type: m[2] }));
// Anti-vacuity: the struct has ~28 fields; a parse that finds a handful means the
// regex stopped matching, and a gate reading nothing would pass forever.
if (fields.length < 20) {
  console.error(`check-realm-fields: parsed only ${fields.length} RealmIntrinsics fields; the parse is broken`);
  process.exit(1);
}

const load = body(realmSrc, "fn loadRealm(", REALM);
const mark = body(runtimeSrc, "fn markRealms(", RUNTIME);
let bad = 0;
for (const f of fields) {
  const assign = new RegExp(`\\bst\\.${f.name}\\s*=\\s*st\\.realms\\[r\\]\\.intr\\.${f.name}\\b`);
  if (!assign.test(load)) {
    console.error(`check-realm-fields: loadRealm does not restore '${f.name}'; after a realm switch Interp would keep the previous realm's value`);
    bad++;
  }
  if (f.type === "i64" && !NOT_OBJECT.has(f.name) && !new RegExp(`\\.intr\\.${f.name}\\b`).test(mark)) {
    console.error(`check-realm-fields: markRealms (${RUNTIME}) does not root '${f.name}'; it would be swept while its realm is not running`);
    bad++;
  }
}
if (!/\.intr\.globalScope\b/.test(mark)) {
  console.error("check-realm-fields: markRealms does not root each realm's global scope");
  bad++;
}
if (bad) process.exit(1);
console.log(`check-realm-fields: ${fields.length} realm fields, each restored by loadRealm and every handle rooted by markRealms`);
