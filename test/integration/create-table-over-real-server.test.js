import assert from "node:assert/strict";
import test from "node:test";

import {
  createUniqueTableName,
  withConnectedClient,
} from "../../test-support/create-integration-client.js";

test("creates a table through the real UniDB TCP server", async () => {
  await withConnectedClient(async (db) => {
    const tableName = createUniqueTableName("e2e_create");

    const result = await db.query(
      `CREATE TABLE ${tableName} (id INT, name TEXT);`,
    );

    assert.equal(result.ok, true);
    assert.equal(result.kind, "command");
    assert.equal(result.message, "Table created");
  });
});
