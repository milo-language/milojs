// ESM on the runtime, where the module loader also serves CommonJS and the Node
// builtins. A default import of a CommonJS module must yield module.exports
// itself, not module.exports.default — only a module lowered from ESM source
// carries the marker that says otherwise.
import cfg, { shout } from "./esm/util.js";
import path from "node:path";
import { existsSync } from "node:fs";

console.log(shout("milo"), cfg.kind);
console.log(path.join("a", "b"), typeof path.resolve, typeof existsSync);

const dyn = await import("./esm/util.js");
console.log(dyn.default.kind, dyn.shout("dyn"));

setTimeout(() => console.log("event loop still runs"), 0);
