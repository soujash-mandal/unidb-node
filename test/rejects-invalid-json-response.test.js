import assert from "node:assert/strict";
import test from "node:test";

import { UniDB, UniDBProtocolError } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("rejects an invalid JSON response", async (t) => {
  const server = await startTestServer((socket) => {
    socket.write("not json\n");
  });
  t.after(() => server.close());

  const db = new UniDB({ port: server.port });
  await db.connect();

  try {
    await assert.rejects(db.query("SELECT 1"), UniDBProtocolError);
  } finally {
    await db.close();
  }
});
