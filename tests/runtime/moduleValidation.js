// Argument validation across the modules that had none. Each of these took
// whatever it was handed and produced something plausible: path.join(1)
// answered "1", new StringDecoder('bogus') survived construction and produced
// wrong bytes at the first write, setTimeout(1) queued a non-function that blew
// up a tick later, dgram.createSocket typos failed at the first send. node
// throws a coded error at the call, and its tests assert the code.
//
// Also here: url.fileURLToPath and url.pathToFileURL, which did not exist at
// all — the ESM idiom for "where am I" runs through them.
const cases = [
  ["zlib.gzipSync(1)", () => require("zlib").gzipSync(1)],
  ["zlib.gzipSync(null)", () => require("zlib").gzipSync(null)],
  ["zlib.createGzip({level:'x'})", () => require("zlib").createGzip({ level: "x" })],
  ["dgram.createSocket(1)", () => require("dgram").createSocket(1)],
  ["dgram.createSocket('bogus')", () => require("dgram").createSocket("bogus")],
  ["querystring.parse(1)", () => require("querystring").parse(1)],
  ["querystring.stringify(1)", () => require("querystring").stringify(1)],
  ["StringDecoder(1)", () => new (require("string_decoder").StringDecoder)(1)],
  ["StringDecoder('bogus')", () => new (require("string_decoder").StringDecoder)("bogus")],
  ["path.join(1)", () => require("path").join(1)],
  ["path.resolve(1)", () => require("path").resolve(1)],
  ["path.basename(1)", () => require("path").basename(1)],
  ["os.setPriority('x')", () => require("os").setPriority("x")],
  ["setTimeout(1)", () => { const t = setTimeout(1, 0); clearTimeout(t); }],
  ["url.fileURLToPath(1)", () => require("url").fileURLToPath(1)],
  ["util.promisify(1)", () => require("util").promisify(1)],
  ["util.inherits(1)", () => require("util").inherits(1, 1)],
  ["util.format()", () => require("util").format()],
];
for (const [label, fn] of cases) {
  try { fn(); console.log("NO THROW  " + label); }
  catch (e) { console.log((e.code || "(nocode)").padEnd(26) + label); }
}
const url = require("url");
function t(l, fn) { try { console.log(l + ":", String(fn())); } catch (e) { console.log(l + ":", e.code, "|", e.message); } }
t("fileURLToPath('file:///a/b.txt')", () => url.fileURLToPath("file:///a/b.txt"));
t("fileURLToPath(URL)", () => url.fileURLToPath(new URL("file:///a/b%20c.txt")));
t("fileURLToPath(1)", () => url.fileURLToPath(1));
t("fileURLToPath('http://x/')", () => url.fileURLToPath("http://x/"));
t("pathToFileURL('/a/b c')", () => url.pathToFileURL("/a/b c"));
t("pathToFileURL(1)", () => url.pathToFileURL(1));
