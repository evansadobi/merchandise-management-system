import dotenv from "dotenv";
import { createApp } from "./app.js";
import { pool } from "./db/db.js";
import { featureFlags } from "./config/featureFlags.js";
import { stopEventPublisher } from "./events/eventPublisher.js";

dotenv.config();

if (!featureFlags.procurement) {
  console.log("Procurement module is DISABLED via feature flag.");
}

const app = createApp();
const PORT = Number(process.env.PORT) || 3002;

const server = app.listen(PORT, () => {
  console.log(`Procurement Service running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
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
