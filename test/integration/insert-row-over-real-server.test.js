import assert from "node:assert/strict";
import test from "node:test";

import {
  createUniqueTableName,
  withConnectedClient,
} from "../../test-support/create-integration-client.js";

test("inserts a row through the real UniDB TCP server", async () => {
  await withConnectedClient(async (db) => {
    const tableName = createUniqueTableName("e2e_insert");

    await db.query(`CREATE TABLE ${tableName} (id INT, name TEXT);`);

    const result = await db.query(
      `INSERT INTO ${tableName} (id, name) VALUES (7, 'Ada');`,
    );

    assert.equal(result.ok, true);
    assert.equal(result.kind, "command");
    assert.equal(result.affected_rows, 1);
  });
});
