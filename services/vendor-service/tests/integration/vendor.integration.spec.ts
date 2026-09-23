import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import request from "supertest";
import * as schema from "../../src/db/schema.js";
import {
  ensureTestDatabaseExists,
  runMigrations,
  truncateAllTables,
  TEST_DATABASE_URL,
} from "./setup.js";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.FEATURE_VENDOR_MANAGEMENT = "true";

const { createApp } = await import("../../src/app.js");
const { pool } = await import("../../src/db/db.js");

describe("Vendor API (integration)", () => {
  const app = createApp();

  beforeAll(async () => {
    await ensureTestDatabaseExists();
    await runMigrations();
  }, 30000);

  beforeEach(async () => {
    await truncateAllTables(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/vendors", () => {
    it("creates a vendor and defaults status to PENDING", async () => {
      const res = await request(app).post("/api/vendors").send({
        name: "Acme Corp",
        contactEmail: "acme@example.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("PENDING");
      expect(res.body.id).toBeDefined();
    });

    it("returns 409 when contactEmail is not unique", async () => {
      const payload = {
        name: "Acme Corp",
        contactEmail: "dupe@example.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
      };

      await request(app).post("/api/vendors").send(payload).expect(201);
      const second = await request(app).post("/api/vendors").send(payload);

      expect(second.status).toBe(409);
    });

    it("returns 400 for invalid payload", async () => {
      const res = await request(app).post("/api/vendors").send({
        name: "",
        contactEmail: "not-an-email",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/vendors", () => {
    it("returns paginated results", async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/vendors")
          .send({
            name: `Vendor ${i}`,
            contactEmail: `vendor${i}@example.com`,
            contactPhone: "+254712345678",
            paymentTerms: "Net 30",
            leadTimeDays: 5,
          });
      }

      const res = await request(app).get("/api/vendors?page=1&limit=2");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });
  });

  describe("DELETE /api/vendors/:id", () => {
    it("deletes an existing vendor", async () => {
      const created = await request(app).post("/api/vendors").send({
        name: "To Delete",
        contactEmail: "delete-me@example.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
      });

      const res = await request(app).delete(`/api/vendors/${created.body.id}`);

      expect(res.status).toBe(200);

      const getAfterDelete = await request(app).get(
        `/api/vendors/${created.body.id}`,
      );
      expect(getAfterDelete.status).toBe(404);
    });

    it("returns 404 when deleting a non-existent vendor", async () => {
      const res = await request(app).delete(
        "/api/vendors/123e4567-e89b-12d3-a456-426614174000",
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Vendor product supplier lookup", () => {
    it("defaults to APPROVED vendors only when no status filter is given", async () => {
      const approved = await request(app).post("/api/vendors").send({
        name: "Approved Vendor",
        contactEmail: "approved@example.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
      });

      await request(app)
        .patch(`/api/vendors/${approved.body.id}`)
        .send({ status: "APPROVED" });

      const suspended = await request(app).post("/api/vendors").send({
        name: "Suspended Vendor",
        contactEmail: "suspended@example.com",
        contactPhone: "+254712345678",
        paymentTerms: "Net 30",
        leadTimeDays: 5,
      });

      await request(app)
        .patch(`/api/vendors/${suspended.body.id}`)
        .send({ status: "SUSPENDED" });

      await request(app)
        .post(`/api/vendors/${approved.body.id}/products`)
        .send({ sku: "SKU-001", unitCost: "10.00" });

      await request(app)
        .post(`/api/vendors/${suspended.body.id}/products`)
        .send({ sku: "SKU-001", unitCost: "8.00" });

      const res = await request(app).get("/api/vendors/sku/SKU-001/suppliers");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].vendorId).toBe(approved.body.id);
    });
  });
});
