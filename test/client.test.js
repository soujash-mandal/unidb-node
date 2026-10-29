import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";

import {
  UniDB,
  UniDBConnectionError,
  UniDBProtocolError,
  UniDBQueryError,
} from "../src/index.js";

async function startServer(onQuery) {
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
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("connects and returns rows from SELECT", async (t) => {
  const server = await startServer((socket, query) => {
    assert.equal(query, "SELECT * FROM users");
    socket.write(
      `${JSON.stringify({
        ok: true,
        kind: "rows",
        columns: [{ name: "id", type: "int" }],
        rows: [[7]],
      })}\n`,
    );
  });
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();
  const result = await db.query("SELECT * FROM users");

  assert.deepEqual(result.rows, [[7]]);
  assert.deepEqual(result.columns, [{ name: "id", type: "int" }]);
  await db.close();
});

test("matches several queries with their responses", async (t) => {
  const server = await startServer((socket, query) => {
    socket.write(
      `${JSON.stringify({
        ok: true,
        kind: "command",
        message: `Ran: ${query}`,
        affected_rows: 0,
      })}\n`,
    );
  });
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();

  const results = await Promise.all([
    db.query("CREATE TABLE users (id INT)"),
    db.query("INSERT INTO users VALUES (7)"),
  ]);

  assert.match(results[0].message, /^Ran: CREATE TABLE/);
  assert.match(results[1].message, /^Ran: INSERT INTO/);
  await db.close();
});

test("turns a server error into a readable query error", async (t) => {
  const server = await startServer((socket) => {
    socket.write(
      `${JSON.stringify({
        ok: false,
        error: { code: "syntax_error", message: "Unexpected token" },
      })}\n`,
    );
  });
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();

  await assert.rejects(db.query("SELEC 1"), (error) => {
    assert.ok(error instanceof UniDBQueryError);
    assert.equal(error.code, "syntax_error");
    assert.equal(error.message, "Unexpected token");
    return true;
  });
  await db.close();
});

test("closes the connection after an invalid JSON response", async (t) => {
  const server = await startServer((socket) => socket.write("not json\n"));
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();
  await assert.rejects(db.query("SELECT 1"), UniDBProtocolError);
  await db.close();
});

test("closes the connection when a query times out", async (t) => {
  const server = await startServer(() => {});
  t.after(() => server.close());

  const db = new UniDB({ port: server.port, queryTimeout: 30 });
  await db.connect();

  await assert.rejects(db.query("SELECT 1"), (error) => {
    assert.ok(error instanceof Error);
    assert.equal(error.code, "QUERY_TIMEOUT");
    return true;
  });
  await db.close();
});

test("rejects multi-line statements before sending them", async (t) => {
  const server = await startServer(() => {});
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();
  await assert.rejects(db.query("SELECT 1\nSELECT 2"), TypeError);
  await db.close();
});

test("reports connection failures clearly", async (t) => {
  const server = await startServer(() => {});
  const port = server.port;
  await server.close();
  t.after(() => server.close());

  const db = new UniDB({ port, connectTimeout: 500 });
  await assert.rejects(db.connect(), UniDBConnectionError);
});
