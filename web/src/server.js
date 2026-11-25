import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

import { createApp } from "./app.js";
import { loadConfig, loadEnvFile } from "./config.js";
import { connect, disconnect, isReady } from "./db/connection.js";
import { createLogger } from "./http/logger.js";

const DRAIN_MS = 10_000;

export async function start() {
  const logger = createLogger();
  // Name, message and stack only: driver and HTTP errors carry payloads in other properties.
  const fail = (message, error) => {
    logger.fatal(
      { err: { type: error?.name, message: error?.message, stack: error?.stack } },
      message
    );
    process.exit(1);
  };
  process.on("unhandledRejection", (error) => fail("Unhandled rejection", error));
  process.on("uncaughtException", (error) => fail("Uncaught exception", error));

  let config;
  try {
    loadEnvFile();
    config = loadConfig();
  } catch (error) {
    logger.fatal(error.message);
    process.exit(1);
  }

  // shopify.js reads the environment at import, so it must come after loadEnvFile().
  const { default: shopify } = await import("../shopify.js");

  let shuttingDown = false;
  const app = createApp({
    shopify,
    config,
    logger,
    isShuttingDown: () => shuttingDown,
    isDbReady: isReady,
  });

  const server = app.listen(config.PORT, (error) => {
    if (error) fail("Server failed to start", error);
    logger.info({ port: server.address().port }, "Listening");
  });

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    const closed = once(server, "close");
    server.close();
    await Promise.race([closed, sleep(DRAIN_MS, undefined, { ref: false })]);
    server.closeAllConnections();
    await disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Not awaited: it retries until MongoDB is reachable, and /ready reports the state meanwhile.
  connect(config.MONGO_URI, { logger }).catch((error) =>
    fail("MongoDB connection failed", error)
  );
}
