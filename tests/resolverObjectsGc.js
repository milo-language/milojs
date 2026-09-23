// A promise's resolve/reject functions are heap objects of their own. Under a
// collector running at every safepoint they must survive the gap between being
// made and being bound as parameters: through a bound executor, a proxied one,
// and a thenable's `then`, each of which runs code before the binding.
function executor(tag, res, rej) {
  const junk = [];
  for (let i = 0; i < 20; i++) junk.push({ i });
  res.tag = tag;
  res(tag + ":" + junk.length + ":" + typeof rej);
}
const bound = executor.bind(null, "bound");
const proxied = new Proxy(function (res, rej) { executor("proxy", res, rej); }, {
  apply(target, self, args) {
    const junk = [];
    for (let i = 0; i < 20; i++) junk.push([i]);
    return Reflect.apply(target, self, args);
  },
});
const thenable = {
  then(res, rej) {
    const junk = [];
    for (let i = 0; i < 20; i++) junk.push("x" + i);
    res("thenable:" + junk.length + ":" + (res === rej));
  },
};

const seen = new Set();
async function main() {
  for (let round = 0; round < 3; round++) {
    console.log(await new Promise(bound));
    console.log(await new Promise(proxied));
    console.log(await thenable);
    await new Promise((res) => { seen.add(res); res(); });
  }
  console.log("distinct resolvers:", seen.size);
}
main();
