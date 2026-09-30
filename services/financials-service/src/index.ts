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

if (!featureFlags.financials) {
  console.log("Financials module is DISABLED via feature flag.");
}

const app = createApp();
const PORT = Number(process.env.PORT) || 3008;

const server = app.listen(PORT, () => {
  console.log(`Financials service running on port ${PORT}`);

  if (featureFlags.financials) {
    startEventSubscriber().catch((error) => {
      console.error("Failed to start financials event subscriber:", error);
    });
  }
});

server.on("error", (error: Error) => {
  console.error("Financials server error:", error);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  stopEventSubscriber();
  server.close(async () => {
    try {
      await pool.end();
      await stopEventPublisher();
      process.exit(0);
    } catch (error) {
      console.error("Financials shutdown error:", error);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
