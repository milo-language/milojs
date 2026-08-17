// The awaited promise is a TEMPORARY: nothing but the evaluator's own local
// refers to it. Awaiting one drains microtasks first, and a collection in that
// window used to sweep the promise together with the value being awaited, so
// the catch block received an object with no message. Allocating first makes
// the collection land inside the window rather than depending on where the
// prelude happens to leave the heap.
(async () => {
  for (let i = 0; i < 200; i++) ({ pad: new Array(8).fill(i) });
  try {
    await Promise.reject(new Error("temp-reject"));
  } catch (e) {
    console.log("rejected:", e.message, e instanceof Error);
  }
  const v = await Promise.resolve({ deep: { value: 7 } });
  console.log("resolved:", v.deep.value);
})();
