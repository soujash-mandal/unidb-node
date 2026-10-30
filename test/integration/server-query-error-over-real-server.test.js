import assert from "node:assert/strict";
import test from "node:test";

import { UniDBQueryError } from "../../src/index.js";
import {
  createUniqueTableName,
  withConnectedClient,
} from "../../test-support/create-integration-client.js";

test("converts a real UniDB server query error into UniDBQueryError", async () => {
  await withConnectedClient(async (db) => {
    const missingTable = createUniqueTableName("e2e_missing");

    await assert.rejects(
      db.query(`SELECT * FROM ${missingTable};`),
      (error) => {
        assert.ok(error instanceof UniDBQueryError);
        assert.equal(typeof error.code, "string");
        assert.ok(error.code.length > 0);
        return true;
      },
    );

    // A query error is a response, not a broken TCP connection.
    const tableName = createUniqueTableName("e2e_after_error");
    const result = await db.query(
      `CREATE TABLE ${tableName} (id INT, name TEXT);`,
    );

    assert.equal(result.ok, true);
    assert.equal(result.kind, "command");
  });
});
