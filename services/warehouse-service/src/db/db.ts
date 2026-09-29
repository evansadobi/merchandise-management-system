import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:password@localhost:5437/warehouse_db";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
