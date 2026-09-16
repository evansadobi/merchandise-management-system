import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import dotenv from "dotenv";
import { procurementRoutes } from "./routes/procurementRoutes.js";
import { pool } from "./db/db.js";
import { featureFlags } from "./config/featureFlags.js";

dotenv.config();

const app = express();
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "procurement-service" });
});

if (featureFlags.procurement) {
  app.use("/api/purchase-orders", procurementRoutes);
} else {
  app.use("/api/purchase-orders", (_req: Request, res: Response) => {
    res.status(503).json({ error: "Procurement module is currently disabled" });
  });
  console.log("Procurement module is DISABLED via feature flag.");
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = Number(process.env.PORT) || 3002;

const server = app.listen(PORT, () => {
  console.log(`Procurement Service running on port ${PORT}`);
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
