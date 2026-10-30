import { randomUUID } from "node:crypto";

import { UniDB } from "../src/index.js";

export function createIntegrationClient() {
  const port = Number(process.env.UNIDB_PORT ?? 7432);

  return new UniDB({
    host: process.env.UNIDB_HOST ?? "127.0.0.1",
    port,
    connectTimeout: 5000,
    queryTimeout: 5000,
  });
}

export function createUniqueTableName(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export async function withConnectedClient(run) {
  const db = createIntegrationClient();
  await db.connect();

  try {
    return await run(db);
  } finally {
    await db.close();
  }
}
