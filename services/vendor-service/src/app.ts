import express, { type Request, type Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import YAML from "yaml";
import { vendorRoutes } from "./routes/vendorRoutes.js";
import vendorProductRoutes from "./routes/vendorProductRoutes.js";
import { featureFlags } from "./config/featureFlags.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const openApiPath = join(__dirname, "../openapi.yaml");

function loadOpenApiSpec() {
  try {
    const file = readFileSync(openApiPath, "utf8");
    return YAML.parse(file);
  } catch (err) {
    console.warn(
      `Could not load OpenAPI spec from ${openApiPath}. /docs will be unavailable.`,
      err,
    );
    return null;
  }
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", service: "vendor-service" });
  });

  const openApiSpec = loadOpenApiSpec();
  if (openApiSpec) {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  }

  if (featureFlags.vendorManagement) {
    app.use("/api/vendors", vendorRoutes);
    app.use("/api/vendors", vendorProductRoutes);
  } else {
    app.use("/api/vendors", (_req: Request, res: Response) => {
      res
        .status(503)
        .json({ error: "Vendor Management module is currently disabled" });
    });
  }

  app.use(errorHandler);

  return app;
}
