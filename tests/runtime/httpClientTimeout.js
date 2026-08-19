// req.setTimeout and req.abort. setTimeout was a no-op returning `this`, so no
// 'timeout' event ever fired on any request; abort left end() free to open a
// socket to a server the caller had already decided not to contact, and that
// socket then held the event loop open.
const http = require("http");

// 1. A server that accepts and never answers. The idle timer is the only thing
//    that can end the wait.
const silent = http.createServer(() => {});
silent.listen(0, () => {
  const req = http.request({ host: "127.0.0.1", port: silent.address().port, path: "/" });
  req.on("socket", () => console.log("socket event"));
  // Destroying a live request is a connection reset, and node reports it. The
  // handler is not decoration: without it node exits on an unhandled 'error'.
  req.on("error", (e) => console.log("req error:", e.code, "|", e.message));
  req.setTimeout(80, () => {
    console.log("timeout fired");
    req.destroy();
    silent.close();
    setTimeout(second, 30);
  });
  req.on("response", () => console.log("unexpected response"));
  req.end();
});

// 2. abort() before end() must not contact the server at all.
function second() {
  const never = http.createServer(() => { console.log("SERVER WAS CONTACTED"); });
  never.listen(0, () => {
    const req = http.request({ host: "127.0.0.1", port: never.address().port, path: "/" });
    req.on("abort", () => {
      console.log("abort event, aborted =", req.aborted);
      never.close();
      third();
    });
    req.on("error", () => console.log("unexpected error"));
    req.abort();
    req.end();
    console.log("write after abort returned:", req.write("x"));
  });
}

// 3. The socket's own idle timer, independent of any request.
function third() {
  const net = require("net");
  const srv = net.createServer(() => {});
  srv.listen(0, () => {
    const s = net.connect(srv.address().port, "127.0.0.1", () => {
      s.setTimeout(60, () => {
        console.log("socket timeout fired, socket.timeout =", s.timeout);
        s.destroy();
        srv.close();
      });
    });
  });
}
