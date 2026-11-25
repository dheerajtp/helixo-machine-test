import { setTimeout as sleep } from "node:timers/promises";
import mongoose from "mongoose";

const OPTIONS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  writeConcern: { w: "majority" },
};

let stop = new AbortController();

export async function connect(uri, { logger = console } = {}) {
  stop = new AbortController();
  const { signal } = stop;

  mongoose.set("strictQuery", true);
  mongoose.set("maxTimeMS", 2000);
  // Production indexes are built by migrations, never at startup.
  mongoose.set("autoIndex", process.env.NODE_ENV === "test");

  for (let delay = 1000; !signal.aborted; delay = Math.min(delay * 2, 30000)) {
    try {
      await mongoose.connect(uri, OPTIONS);
      if (signal.aborted) await mongoose.disconnect();
      return;
    } catch (error) {
      if (signal.aborted) return;
      // Name only: driver messages can quote parts of the URI.
      logger.warn(
        `MongoDB connection failed (${error.codeName ?? error.name}), retrying in ${delay} ms`
      );
      await sleep(delay, undefined, { signal }).catch(() => {}); // rejects only on abort
    }
  }
}

export async function isReady() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    await mongoose.connection.db.admin().command({ ping: 1, maxTimeMS: 1000 });
    return true;
  } catch {
    return false;
  }
}

export async function disconnect() {
  stop.abort();
  await mongoose.disconnect();
}
