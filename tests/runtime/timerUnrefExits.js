// An unref'd interval must not keep the process alive: with nothing else
// pending the loop exits right away instead of ticking forever.
setInterval(() => { console.log("never"); }, 1000).unref();
console.log("done");
