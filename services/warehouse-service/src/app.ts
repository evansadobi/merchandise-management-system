import express from "express";
import cors from "cors";
import { warehouseRoutes } from "./routes/warehouseRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { featureFlags } from "./config/featureFlags.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "warehouse-service",
      featureEnabled: featureFlags.warehouse,
    });
  });

  if (featureFlags.warehouse) {
    app.use("/api", warehouseRoutes);

    app.use("/api", (_req, res) => {
      res.status(503).json({
        message: "Warehouse Operations module is disabled",
      });
    });
  }

  app.use(errorHandler);

  return app;
}
