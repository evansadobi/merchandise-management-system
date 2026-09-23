import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import request from "supertest";
import {
  ensureTestDatabaseExists,
  runMigrations,
  truncateAllTables,
  TEST_DATABASE_URL,
} from "./setup.js";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.FEATURE_INVENTORY = "true";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

vi.mock("../../src/events/eventPublisher.js", () => ({
  publishStockLow: vi.fn().mockResolvedValue(undefined),
  stopEventPublisher: vi.fn().mockResolvedValue(undefined),
}));

import { publishStockLow } from "../../src/events/eventPublisher.js";

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
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createItem(
    overrides: Partial<{
      productName: string;
      sku: string;
      locationId: string;
      quantityOnHand: number;
      unitValue: string;
      reorderLevel: number;
    }> = {},
  ) {
    const res = await request(app)
      .post("/api/inventory")
      .send({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 45,
        unitValue: "1.25",
        reorderLevel: 50,
        ...overrides,
      });
    return res.body;
  }

  describe("POST /api/inventory", () => {
    it("creates an inventory item", async () => {
      const res = await request(app).post("/api/inventory").send({
        productName: "Steel Bolt M8",
        sku: "BOLT-STEEL-M8",
        quantityOnHand: 100,
        unitValue: "1.25",
        reorderLevel: 20,
      });

      expect(res.status).toBe(201);
      expect(res.body.locationId).toBe("MAIN_WAREHOUSE"); // default applied
      expect(res.body.quantityOnHand).toBe(100);
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(app).post("/api/inventory").send({ sku: "X" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/inventory", () => {
    it("returns paginated results", async () => {
      await createItem({ sku: "SKU-A" });
      await createItem({ sku: "SKU-B" });

      const res = await request(app).get("/api/inventory?page=1&limit=1");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe("PATCH /api/inventory/sku/:sku/reserve", () => {
    it("reserves stock within available quantity", async () => {
      const item = await createItem();

      const res = await request(app)
        .patch(`/api/inventory/sku/${item.sku}/reserve`)
        .send({ quantity: 10, locationId: "MAIN_WAREHOUSE" });

      expect(res.status).toBe(200);
      expect(res.body.quantityAllocated).toBe(10);
    });

    it("rejects over-reservation at the database level", async () => {
      const item = await createItem(); // quantityOnHand: 45

      await request(app)
        .patch(`/api/inventory/sku/${item.sku}/reserve`)
        .send({ quantity: 10, locationId: "MAIN_WAREHOUSE" });

      const res = await request(app)
        .patch(`/api/inventory/sku/${item.sku}/reserve`)
        .send({ quantity: 40, locationId: "MAIN_WAREHOUSE" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Insufficient available stock/);
    });

    it("returns 404 for a non-existent SKU", async () => {
      const res = await request(app)
        .patch("/api/inventory/sku/DOES-NOT-EXIST/reserve")
        .send({ quantity: 1 });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/inventory/sku/:sku/commit-sale", () => {
    it("commits a sale, deducting on-hand and releasing allocation atomically", async () => {
      const item = await createItem();

      await request(app)
        .patch(`/api/inventory/sku/${item.sku}/reserve`)
        .send({ quantity: 10, locationId: "MAIN_WAREHOUSE" });

      const res = await request(app)
        .patch(`/api/inventory/sku/${item.sku}/commit-sale`)
        .send({ quantity: 10, locationId: "MAIN_WAREHOUSE" });

      expect(res.status).toBe(200);
      expect(res.body.quantityOnHand).toBe(35);
      expect(res.body.quantityAllocated).toBe(0);
    });

    it("publishes StockLow when the sale brings quantity at or below reorderLevel", async () => {
      const item = await createItem({ quantityOnHand: 15, reorderLevel: 10 });

      await request(app)
        .patch(`/api/inventory/sku/${item.sku}/commit-sale`)
        .send({ quantity: 10, locationId: "MAIN_WAREHOUSE" });

      expect(publishStockLow).toHaveBeenCalledWith(
        expect.objectContaining({ sku: item.sku, quantityOnHand: 5 }),
      );
    });

    it("rejects a sale exceeding on-hand quantity", async () => {
      const item = await createItem({ quantityOnHand: 5 });

      const res = await request(app)
        .patch(`/api/inventory/sku/${item.sku}/commit-sale`)
        .send({ quantity: 100, locationId: "MAIN_WAREHOUSE" });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/inventory/sku/:sku/adjust", () => {
    it("adjusts stock up", async () => {
      const item = await createItem();

      const res = await request(app)
        .patch(`/api/inventory/sku/${item.sku}/adjust`)
        .send({ delta: 20, locationId: "MAIN_WAREHOUSE" });

      expect(res.status).toBe(200);
      expect(res.body.quantityOnHand).toBe(65);
    });

    it("rejects an adjustment that would take on-hand below zero", async () => {
      const item = await createItem({ quantityOnHand: 5 });

      const res = await request(app)
        .patch(`/api/inventory/sku/${item.sku}/adjust`)
        .send({ delta: -10, locationId: "MAIN_WAREHOUSE" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/inventory/low-stock", () => {
    it("returns items at or below their reorder level", async () => {
      await createItem({ sku: "LOW-1", quantityOnHand: 5, reorderLevel: 10 });
      await createItem({
        sku: "HIGH-1",
        quantityOnHand: 100,
        reorderLevel: 10,
      });

      const res = await request(app).get("/api/inventory/low-stock");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].sku).toBe("LOW-1");
    });
  });

  describe("GET /api/inventory/sku/:sku", () => {
    it("returns every location row for a SKU", async () => {
      await createItem({ sku: "MULTI", locationId: "MAIN_WAREHOUSE" });
      await createItem({ sku: "MULTI", locationId: "STORE_3_BACKROOM" });

      const res = await request(app).get("/api/inventory/sku/MULTI");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });
});
