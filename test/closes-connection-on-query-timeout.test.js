import assert from "node:assert/strict";
import test from "node:test";

import { UniDB } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("closes the connection when a query times out", async (t) => {
  const server = await startTestServer(() => {});
  t.after(() => server.close());

  const db = new UniDB({ port: server.port, queryTimeout: 30 });
  await db.connect();

  try {
    await assert.rejects(db.query("SELECT 1"), (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.code, "QUERY_TIMEOUT");
      return true;
    });
  } finally {
    await db.close();
  }
});
