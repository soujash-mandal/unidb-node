import assert from "node:assert/strict";
import test from "node:test";

import {
  createUniqueTableName,
  withConnectedClient,
} from "../../test-support/create-integration-client.js";

test("selects rows inserted through the real UniDB TCP server", async () => {
  await withConnectedClient(async (db) => {
    const tableName = createUniqueTableName("e2e_select");

    await db.query(`CREATE TABLE ${tableName} (id INT, name TEXT);`);
    await db.query(
      `INSERT INTO ${tableName} (id, name) VALUES (7, 'Ada');`,
    );
    await db.query(
      `INSERT INTO ${tableName} (id, name) VALUES (8, 'Grace');`,
    );

    const result = await db.query(`SELECT * FROM ${tableName};`);

    assert.equal(result.ok, true);
    assert.equal(result.kind, "rows");
    assert.deepEqual(
      result.columns.map((column) => column.name),
      ["id", "name"],
    );
    assert.deepEqual(result.rows, [
      [7, "Ada"],
      [8, "Grace"],
    ]);
  });
});
