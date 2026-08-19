// A streaming response, and the server noticing that its client left.
//
// res.write() used to buffer until end(), so a handler that wrote a chunk and
// kept the connection open sent nothing at all. And the accepted connection was
// a bare integer with no Socket around it, so a client disconnect was invisible
// and req 'aborted' could never fire.
const http = require("http");

const server = http.createServer((req, res) => {
  console.log("server: request");
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("first");
  req.on("aborted", () => {
    console.log("server: aborted, req.aborted =", req.aborted);
    server.close();
    second();
  });
});

server.listen(0, () => {
  const req = http.get({ port: server.address().port, path: "/" }, (res) => {
    console.log("client: status", res.statusCode, "chunked:", res.headers["transfer-encoding"]);
    res.on("data", (chunk) => {
      console.log("client: chunk", JSON.stringify(String(chunk)));
      req.abort();
    });
  });
  req.on("error", () => {});
});

// An HTTP/1.0 client gets no chunked framing: it does not understand it, and
// would read the size lines as body. The connection close delimits instead.
function second() {
  const net = require("net");
  const srv = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("hello");
    res.end();
  });
  srv.listen(0, () => {
    const c = net.connect(srv.address().port, "127.0.0.1", () => {
      c.write("GET / HTTP/1.0\r\n\r\n");
    });
    let raw = "";
    c.on("data", (d) => { raw += d; });
    c.on("end", () => {
      console.log("1.0 chunked framing used:", /transfer-encoding/i.test(raw));
      console.log("1.0 body:", JSON.stringify(raw.split("\r\n\r\n")[1]));
      srv.close();
    });
  });
}
