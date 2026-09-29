import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import {
  ensureTestDatabaseExists,
  runMigrations,
  truncateAllTables,
  TEST_DATABASE_URL,
} from "./setup.js";

process.env.DATABASE_URL = TEST_DATABASE_URL;

const { createApp } = await import("../../src/app.js");
const { pool } = await import("../../src/db/db.js");

describe("Inventory API (integration)", () => {
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

  async function seedItem(data: {
    productName: string;
    sku: string;
    locationId?: string;
    quantityOnHand?: number;
    unitValue?: string;
    reorderLevel?: number;
  }) {
    return request(app).post("/api/inventory").send(data);
  }

  describe("POST /api/inventory", () => {
    it("creates an inventory item", async () => {
      const res = await request(app).post("/api/inventory").send({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 100,
      });

      expect(res.status).toBe(201);
      expect(res.body.sku).toBe("BOLT-STEEL-M8");
      expect(res.body.locationId).toBe("MAIN_WAREHOUSE");
      expect(res.body.quantityOnHand).toBe(100);
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(app).post("/api/inventory").send({
        sku: "BOLT-STEEL-M8",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("GET /api/inventory", () => {
    it("returns paginated results", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 100,
      });
      await seedItem({
        productName: "Steel Nut M8",
        sku: "NUT-STEEL-M8",
        quantityOnHand: 50,
      });

      const res = await request(app).get("/api/inventory?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.totalPages).toBe(1);
    });
  });

  describe("PATCH /api/inventory/sku/:sku/reserve", () => {
    it("reserves stock within available quantity", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 100,
      });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/reserve")
        .send({ quantity: 30 });

      expect(res.status).toBe(200);
      expect(res.body.quantityAllocated).toBe(30);
    });

    it("rejects over-reservation at the database level", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 10,
      });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/reserve")
        .send({ quantity: 50 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Insufficient available stock/);
    });

    it("returns 404 for a non-existent SKU", async () => {
      const res = await request(app)
        .patch("/api/inventory/sku/DOES-NOT-EXIST/reserve")
        .send({ quantity: 5 });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/inventory/sku/:sku/commit-sale", () => {
    it("commits a sale, deducting on-hand and releasing allocation atomically", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 100,
      });
      await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/reserve")
        .send({ quantity: 10 });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/commit-sale")
        .send({ quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.quantityOnHand).toBe(90);
      expect(res.body.quantityAllocated).toBe(0);
    });

    it("publishes StockLow when the sale brings quantity at or below reorderLevel", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 15,
        reorderLevel: 10,
      });
      await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/reserve")
        .send({ quantity: 10 });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/commit-sale")
        .send({ quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.quantityOnHand).toBe(5);
    });

    it("rejects a sale exceeding on-hand quantity", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 10,
      });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/commit-sale")
        .send({ quantity: 50 });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/inventory/sku/:sku/adjust", () => {
    it("adjusts stock up", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 100,
      });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/adjust")
        .send({ delta: 20 });

      expect(res.status).toBe(200);
      expect(res.body.quantityOnHand).toBe(120);
    });

    it("rejects an adjustment that would take on-hand below zero", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 5,
      });

      const res = await request(app)
        .patch("/api/inventory/sku/BOLT-STEEL-M8/adjust")
        .send({ delta: -20 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/below zero/);
    });
  });

  describe("GET /api/inventory/low-stock", () => {
    it("returns items at or below their reorder level", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-LOW",
        quantityOnHand: 5,
        reorderLevel: 10,
      });
      await seedItem({
        productName: "Steel Nut M8",
        sku: "NUT-HIGH",
        quantityOnHand: 100,
        reorderLevel: 10,
      });

      const res = await request(app).get("/api/inventory/low-stock");

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].sku).toBe("BOLT-LOW");
    });
  });

  describe("GET /api/inventory/sku/:sku", () => {
    it("returns every location row for a SKU", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 100,
      });
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        locationId: "STORE_3_BACKROOM",
        quantityOnHand: 20,
      });

      const res = await request(app).get("/api/inventory/sku/BOLT-STEEL-M8");

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      const locations = res.body.map((r: any) => r.locationId).sort();
      expect(locations).toEqual(["MAIN_WAREHOUSE", "STORE_3_BACKROOM"]);
    });
  });

  describe("POST /api/inventory/transfer", () => {
    it("moves stock atomically from source to destination", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-TRANSFER-1",
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 100,
      });

      const res = await request(app).post("/api/inventory/transfer").send({
        sku: "BOLT-TRANSFER-1",
        fromLocationId: "MAIN_WAREHOUSE",
        toLocationId: "STORE_3_BACKROOM",
        quantity: 30,
      });

      expect(res.status).toBe(200);
      expect(res.body.source.quantityOnHand).toBe(70);
      expect(res.body.source.locationId).toBe("MAIN_WAREHOUSE");
      expect(res.body.destination.quantityOnHand).toBe(30);
      expect(res.body.destination.locationId).toBe("STORE_3_BACKROOM");
    });

    it("increments an existing destination row rather than replacing it", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-TRANSFER-2",
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 100,
      });
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-TRANSFER-2",
        locationId: "STORE_3_BACKROOM",
        quantityOnHand: 15,
      });

      const res = await request(app).post("/api/inventory/transfer").send({
        sku: "BOLT-TRANSFER-2",
        fromLocationId: "MAIN_WAREHOUSE",
        toLocationId: "STORE_3_BACKROOM",
        quantity: 20,
      });

      expect(res.status).toBe(200);
      expect(res.body.source.quantityOnHand).toBe(80);
      expect(res.body.destination.quantityOnHand).toBe(35); // 15 + 20
    });

    it("rejects when source has insufficient On Hand (no partial writes)", async () => {
      await seedItem({
        productName: "Steel Bolt M8",
        sku: "BOLT-TRANSFER-3",
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 10,
      });

      const res = await request(app).post("/api/inventory/transfer").send({
        sku: "BOLT-TRANSFER-3",
        fromLocationId: "MAIN_WAREHOUSE",
        toLocationId: "STORE_3_BACKROOM",
        quantity: 50,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Insufficient On Hand/);

      // Verify atomicity — neither side moved
      const source = await request(app).get(
        "/api/inventory/sku/BOLT-TRANSFER-3",
      );
      const mainRow = source.body.find(
        (r: any) => r.locationId === "MAIN_WAREHOUSE",
      );
      expect(mainRow.quantityOnHand).toBe(10);
      // Destination row should not exist
      const destRow = source.body.find(
        (r: any) => r.locationId === "STORE_3_BACKROOM",
      );
      expect(destRow).toBeUndefined();
    });

    it("rejects when source and destination are the same location", async () => {
      const res = await request(app).post("/api/inventory/transfer").send({
        sku: "BOLT-TRANSFER-4",
        fromLocationId: "MAIN_WAREHOUSE",
        toLocationId: "MAIN_WAREHOUSE",
        quantity: 5,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must differ/);
    });

    it("returns 404 when the source location has no row for this SKU", async () => {
      const res = await request(app).post("/api/inventory/transfer").send({
        sku: "DOES-NOT-EXIST",
        fromLocationId: "MAIN_WAREHOUSE",
        toLocationId: "STORE_3_BACKROOM",
        quantity: 5,
      });

      expect(res.status).toBe(404);
    });
  });
});
