import assert from "node:assert/strict";
import test from "node:test";

import { UniDB } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("rejects multi-line statements before sending them", async (t) => {
  const server = await startTestServer(() => {});
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();

  try {
    await assert.rejects(db.query("SELECT 1\nSELECT 2"), TypeError);
  } finally {
    await db.close();
  }
});
