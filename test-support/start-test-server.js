import net from "node:net";

export async function startTestServer(onQuery) {
  const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const query = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        onQuery(socket, query);
        newline = buffer.indexOf("\n");
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    port: server.address().port,

    close() {
      if (!server.listening) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}
