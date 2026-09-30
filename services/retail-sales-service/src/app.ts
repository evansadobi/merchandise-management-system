import express, { type Request, type Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import YAML from "yaml";
import { retailSalesRoutes } from "./routes/retailSalesRoutes.js";
import { featureFlags } from "./config/featureFlags.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiPath = join(__dirname, "../openapi.yaml");

function loadOpenApiSpec() {
  try {
    const file = readFileSync(openApiPath, "utf8");
    return YAML.parse(file);
  } catch (error) {
    console.warn("Retail Sales OpenAPI spec unavailable:", error);
    return null;
  }
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "retail-sales-service" });
  });

  const openApiSpec = loadOpenApiSpec();
  if (openApiSpec) {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  }

  if (featureFlags.retailSales) {
    app.use("/api/retail-sales", retailSalesRoutes);
  } else {
    app.use("/api/retail-sales", (_req: Request, res: Response) => {
      res
        .status(503)
        .json({ error: "Retail sales module is currently disabled" });
    });
  }

  app.use((error: Error, _req: Request, res: Response, _next: () => void) => {
    res.status(500).json({ error: error.message });
  });

  return app;
}
