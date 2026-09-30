import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { financialsSchema } from "./schema.js";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:password@localhost:5440/financials_db";

export const pool = new Pool({ connectionString });

export const db = drizzle(pool, {
  schema: financialsSchema,
});
