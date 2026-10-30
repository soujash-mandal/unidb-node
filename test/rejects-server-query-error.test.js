import assert from "node:assert/strict";
import test from "node:test";

import { UniDB, UniDBQueryError } from "../src/index.js";
import { startTestServer } from "../test-support/start-test-server.js";

test("turns a server query error into a readable error", async (t) => {
  const server = await startTestServer((socket) => {
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

  try {
    await assert.rejects(db.query("SELEC 1"), (error) => {
      assert.ok(error instanceof UniDBQueryError);
      assert.equal(error.code, "syntax_error");
      assert.equal(error.message, "Unexpected token");
      return true;
    });
  } finally {
    await db.close();
  }
});
