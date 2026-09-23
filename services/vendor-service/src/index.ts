import dotenv from "dotenv";
import { createApp } from "./app.js";
import { pool } from "./db/db.js";
import { featureFlags } from "./config/featureFlags.js";

dotenv.config();

if (!featureFlags.vendorManagement) {
  console.log("Vendor Management module is DISABLED via feature flag.");
}

const app = createApp();
const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  console.log(`Vendor Service running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log("Database pool closed.");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
