import assert from "node:assert/strict";
import test from "node:test";

import { UniDB, UniDBConnectionError } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("reports connection failures clearly", async (t) => {
  const server = await startTestServer(() => {});
  const port = server.port;
  await server.close();

  const db = new UniDB({ port, connectTimeout: 500 });

  await assert.rejects(db.connect(), UniDBConnectionError);
});
