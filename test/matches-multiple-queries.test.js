import assert from "node:assert/strict";
import test from "node:test";

import { UniDB } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("matches several queries with their responses", async (t) => {
  const server = await startTestServer((socket, query) => {
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

  try {
    const results = await Promise.all([
      db.query("CREATE TABLE users (id INT)"),
      db.query("INSERT INTO users VALUES (7)"),
    ]);

    assert.match(results[0].message, /^Ran: CREATE TABLE/);
    assert.match(results[1].message, /^Ran: INSERT INTO/);
  } finally {
    await db.close();
  }
});
