import dotenv from "dotenv";
import { createApp } from "./app.js";
import { pool } from "./db/db.js";
import { featureFlags } from "./config/featureFlags.js";
import {
  startEventSubscriber,
  stopEventSubscriber,
} from "./events/eventSubscriber.js";
import { stopEventPublisher } from "./events/eventPublisher.js";

dotenv.config();

if (!featureFlags.receiving) {
  console.log("Receiving module is DISABLED via feature flag.");
}

const app = createApp();
const PORT = Number(process.env.PORT) || 3004;

const server = app.listen(PORT, () => {
  console.log(`Receiving Service running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
});

if (featureFlags.receiving) {
  startEventSubscriber().catch((err) => {
    console.error("Failed to start event subscriber:", err);
  });
}

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);

  const forceExitTimeout = setTimeout(() => {
    console.error("Forced shutdown after 10s timeout.");
    process.exit(1);
  }, 10000);

  try {
    stopEventSubscriber();

    server.close(async () => {
      try {
        await pool.end();
        await stopEventPublisher();
        console.log("Database pool and Redis connection closed.");
        clearTimeout(forceExitTimeout);
        process.exit(0);
      } catch (err) {
        console.error("Error during resource teardown:", err);
        clearTimeout(forceExitTimeout);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error("Error initiating shutdown sequence:", err);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
  process.exit(1);
});
