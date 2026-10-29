import assert from "node:assert/strict";
import test from "node:test";

import { UniDB } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("SELECT returns column metadata and rows", async (t) => {
  const server = await startTestServer((socket, query) => {
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

  try {
    const result = await db.query("SELECT * FROM users");

    assert.deepEqual(result.rows, [[7]]);
    assert.deepEqual(result.columns, [{ name: "id", type: "int" }]);
  } finally {
    await db.close();
  }
});
