import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./db/db.js";
import { featureFlags } from "./config/featureFlags.js";
import {
  startEventSubscriber,
  stopEventSubscriber,
} from "./events/eventSubscriber.js";
import { stopEventPublisher } from "./events/eventPublisher.js";

if (!featureFlags.warehouse) {
  console.log("Warehouse module is DISABLED via feature flag.");
}

const app = createApp();
const PORT = Number(process.env.PORT) || 3005;

const server = app.listen(PORT, () => {
  console.log(`Warehouse Service running on port ${PORT} (pid ${process.pid})`);

  if (featureFlags.warehouse) {
    startEventSubscriber().catch((err) => {
      console.error("Failed to start event subscriber:", err);
      process.exit(1);
    });
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} already in use — exiting to prevent duplicate consumers.`,
    );
    process.exit(1);
  }
  console.error("SERVER ERROR:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  stopEventSubscriber();
  server.close(async () => {
    try {
      await pool.end();
      await stopEventPublisher();
      console.log("Database pool and Redis connection closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
