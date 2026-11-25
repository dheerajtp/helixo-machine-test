// Usage: npm run migrate -w shopify-app-template-node [-- up|down]
// up (default) applies every pending migration in order; down reverses the last applied one.
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import mongoose from "mongoose";

import { loadDbConfig, loadEnvFile } from "../src/config.js";
import { connect, disconnect } from "../src/db/connection.js";
import { createLogger } from "../src/http/logger.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
// connect() retries forever; the script gives up after this.
const TIME_LIMIT_MS = 120_000;

async function listMigrations(dir) {
  const files = (await readdir(dir)).filter((f) => /^\d+-[\w-]+\.js$/.test(f)).sort();
  return files.map((file) => ({ name: file.slice(0, -3), path: join(dir, file) }));
}

const load = (path) => import(pathToFileURL(path).href);

export async function migrateUp(db, dir = MIGRATIONS_DIR) {
  const records = db.collection("migrations");
  const applied = new Set(
    (await records.find({}, { projection: { _id: 0, name: 1 } }).toArray()).map((r) => r.name)
  );
  const done = [];
  for (const { name, path } of await listMigrations(dir)) {
    if (applied.has(name)) continue;
    await (await load(path)).up(db);
    await records.updateOne(
      { name },
      { $setOnInsert: { name, appliedAt: new Date() } },
      { upsert: true, writeConcern: { w: "majority" } }
    );
    done.push(name);
  }
  return done;
}

export async function migrateDown(db, dir = MIGRATIONS_DIR) {
  const records = db.collection("migrations");
  const [last] = await records
    .find({}, { projection: { _id: 0, name: 1 } })
    .sort({ appliedAt: -1, name: -1 })
    .limit(1)
    .toArray();
  if (!last) return [];
  const migration = (await listMigrations(dir)).find((m) => m.name === last.name);
  if (!migration) throw new Error(`Migration file for ${last.name} not found`);
  await (await load(migration.path)).down(db);
  await records.deleteOne({ name: last.name }, { writeConcern: { w: "majority" } });
  return [last.name];
}

async function main(direction = "up") {
  const logger = createLogger();
  if (!["up", "down"].includes(direction)) {
    logger.fatal(`Unknown direction "${direction}", expected up or down`);
    process.exit(1);
  }
  setTimeout(() => {
    logger.fatal(`Migration did not finish within ${TIME_LIMIT_MS} ms`);
    process.exit(1);
  }, TIME_LIMIT_MS).unref();

  try {
    loadEnvFile();
    const config = loadDbConfig();
    // connect() logs only error names, never the URI.
    await connect(config.MONGO_URI, { logger });
    const db = mongoose.connection.db;
    const names = direction === "down" ? await migrateDown(db) : await migrateUp(db);
    logger.info({ direction, migrations: names }, "Migrations finished");
    await disconnect();
  } catch (error) {
    // Name, code and message only: driver errors carry payloads in other properties.
    logger.fatal(
      { err: { type: error?.name, code: error?.codeName ?? error?.code, message: error?.message } },
      "Migration failed"
    );
    process.exit(1);
  }
}

if (import.meta.main) await main(process.argv[2]);
