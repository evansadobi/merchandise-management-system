import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../../src/db/schema.js";

const ADMIN_URL =
  process.env.TEST_ADMIN_DATABASE_URL ||
  "postgres://postgres:password@localhost:5433/postgres";

const TEST_DB_NAME = "receiving_db_test";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  `postgres://postgres:password@localhost:5433/${TEST_DB_NAME}`;

export async function ensureTestDatabaseExists() {
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  try {
    const exists = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [TEST_DB_NAME],
    );
    if (exists.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function runMigrations() {
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  try {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [TEST_DB_NAME],
    );
    await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await adminPool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await adminPool.end();
  }

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}

export async function truncateAllTables(pool: Pool) {
  await pool.query(
    'TRUNCATE TABLE "receiving_items", "goods_received_notes", "expected_deliveries" RESTART IDENTITY CASCADE',
  );
}
