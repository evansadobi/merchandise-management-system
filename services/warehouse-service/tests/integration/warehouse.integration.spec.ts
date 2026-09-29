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
import RedisModule from "ioredis";
import {
  ensureTestDatabaseExists,
  runMigrations,
  truncateAllTables,
  TEST_DATABASE_URL,
} from "./setup.js";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

vi.mock("../../src/events/eventPublisher.js", () => ({
  publishPutawayTaskCreated: vi.fn().mockResolvedValue(undefined),
  publishStockPlaced: vi.fn().mockResolvedValue(undefined),
  stopEventPublisher: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/clients/InventoryServiceClient.js", () => {
  return {
    InventoryServiceClient: vi.fn().mockImplementation(function (this: any) {
      this.getSkuAttributes = vi.fn(async (sku: string) => {
        if (sku === "HIGH-VELOCITY-SKU") {
          return { sku, salesVelocity: "HIGH", weightKg: "0.1", volumeCm3: 10 };
        }
        if (sku === "LOW-VELOCITY-SKU") {
          return { sku, salesVelocity: "LOW", weightKg: "5", volumeCm3: 1000 };
        }
        return { sku, salesVelocity: null, weightKg: null, volumeCm3: null };
      });
      this.transferStock = vi.fn().mockResolvedValue({
        source: { quantityOnHand: 50 },
        destination: { quantityOnHand: 50 },
      });
    }),
  };
});

vi.mock("../../src/events/eventSubscriber.js", () => ({
  startEventSubscriber: vi.fn().mockResolvedValue(undefined),
  stopEventSubscriber: vi.fn().mockResolvedValue(undefined),
}));

const { createApp } = await import("../../src/app.js");
const { pool } = await import("../../src/db/db.js");

const WH = "MAIN_WAREHOUSE";

describe("Warehouse API (integration)", () => {
  const app = createApp();

  let fastZoneId: string;
  let fastAisleId: string;
  let fastShelfId: string;
  let fastBinId: string;
  let fastBinCode: string;
  let midZoneId: string;
  let midAisleId: string;
  let midShelfId: string;
  let midBinId: string;
  let bulkZoneId: string;
  let bulkAisleId: string;
  let bulkShelfId: string;
  let bulkBinId: string;

  beforeAll(async () => {
    await ensureTestDatabaseExists();
    await runMigrations();
  }, 60000);

  beforeEach(async () => {
    await truncateAllTables(pool);

    // ---- Seed hierarchy ----
    const fastZone = await request(app)
      .post("/api/zones")
      .send({ warehouseId: WH, code: "FAST", description: "Near shipping" });
    fastZoneId = fastZone.body.id;

    const midZone = await request(app)
      .post("/api/zones")
      .send({ warehouseId: WH, code: "MID" });
    midZoneId = midZone.body.id;

    const bulkZone = await request(app)
      .post("/api/zones")
      .send({ warehouseId: WH, code: "BULK" });
    bulkZoneId = bulkZone.body.id;

    const fastAisle = await request(app)
      .post("/api/aisles")
      .send({ zoneId: fastZoneId, code: "A" });
    fastAisleId = fastAisle.body.id;

    const midAisle = await request(app)
      .post("/api/aisles")
      .send({ zoneId: midZoneId, code: "A" });
    midAisleId = midAisle.body.id;

    const bulkAisle = await request(app)
      .post("/api/aisles")
      .send({ zoneId: bulkZoneId, code: "A" });
    bulkAisleId = bulkAisle.body.id;

    const fastShelf = await request(app)
      .post("/api/shelves")
      .send({ aisleId: fastAisleId, code: "01" });
    fastShelfId = fastShelf.body.id;

    const midShelf = await request(app)
      .post("/api/shelves")
      .send({ aisleId: midAisleId, code: "01" });
    midShelfId = midShelf.body.id;

    const bulkShelf = await request(app)
      .post("/api/shelves")
      .send({ aisleId: bulkAisleId, code: "01" });
    bulkShelfId = bulkShelf.body.id;

    const fastBin = await request(app)
      .post("/api/bins")
      .send({ shelfId: fastShelfId, binCode: "01", capacityUnits: 100 });
    fastBinId = fastBin.body.id;
    fastBinCode = fastBin.body.fullCode;

    const midBin = await request(app)
      .post("/api/bins")
      .send({ shelfId: midShelfId, binCode: "01", capacityUnits: 200 });
    midBinId = midBin.body.id;

    const bulkBin = await request(app)
      .post("/api/bins")
      .send({ shelfId: bulkShelfId, binCode: "01", capacityUnits: 1000 });
    bulkBinId = bulkBin.body.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("POST /api/zones", () => {
    it("rejects a duplicate zone code for the same warehouse", async () => {
      // FAST was already created in beforeEach — a second POST must 409.
      const res = await request(app)
        .post("/api/zones")
        .send({ warehouseId: WH, code: "FAST" });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it("rejects invalid zone codes", async () => {
      const res = await request(app)
        .post("/api/zones")
        .send({ warehouseId: WH, code: "INVALID" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/bins", () => {
    it("composes fullCode from the hierarchy", async () => {
      const res = await request(app)
        .post("/api/bins")
        .send({ shelfId: fastShelfId, binCode: "99", capacityUnits: 50 });

      expect(res.status).toBe(201);
      expect(res.body.fullCode).toBe("FAST-A-01-99");
    });

    it("rejects missing shelf", async () => {
      const res = await request(app).post("/api/bins").send({
        shelfId: "00000000-0000-4000-8000-000000000000",
        binCode: "01",
        capacityUnits: 50,
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/putaway/suggest", () => {
    it("picks FAST zone for HIGH velocity SKU", async () => {
      const res = await request(app)
        .post("/api/putaway/suggest")
        .send({ sku: "HIGH-VELOCITY-SKU", quantity: 30 });

      expect(res.status).toBe(200);
      expect(res.body.zone).toBe("FAST");
      expect(res.body.bin.fullCode).toBe(fastBinCode);
    });

    it("picks BULK zone for LOW velocity SKU", async () => {
      const res = await request(app)
        .post("/api/putaway/suggest")
        .send({ sku: "LOW-VELOCITY-SKU", quantity: 500 });

      expect(res.status).toBe(200);
      expect(res.body.zone).toBe("BULK");
    });

    it("falls back to another zone when target zone is full", async () => {
      const res = await request(app)
        .post("/api/putaway/suggest")
        .send({ sku: "HIGH-VELOCITY-SKU", quantity: 150 });

      expect(res.status).toBe(200);
      expect(res.body.bin.fullCode).toMatch(/^(MID|BULK)/);
    });

    it("returns bin=null when nothing fits anywhere", async () => {
      const res = await request(app)
        .post("/api/putaway/suggest")
        .send({ sku: "HIGH-VELOCITY-SKU", quantity: 5000 });

      expect(res.status).toBe(200);
      expect(res.body.bin).toBeNull();
      expect(res.body.reason).toMatch(/Manual intervention/);
    });
  });

  describe("Putaway task lifecycle (direct creation + completion)", () => {
    it("creates, starts, and completes a putaway task; updates bin + placement", async () => {
      const insert = await pool.query(
        `INSERT INTO putaway_tasks
         (grn_id, purchase_order_id, sku, quantity, suggested_bin_id, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING id`,
        [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "HIGH-VELOCITY-SKU",
          25,
          fastBinId,
        ],
      );
      const taskId = insert.rows[0].id;

      const list = await request(app).get("/api/putaway/tasks?status=PENDING");
      expect(list.status).toBe(200);
      expect(list.body.length).toBeGreaterThanOrEqual(1);

      const started = await request(app)
        .post(`/api/putaway/tasks/${taskId}/start`)
        .send({ assignedTo: "Test Worker" });
      expect(started.status).toBe(200);
      expect(started.body.status).toBe("IN_PROGRESS");
      expect(started.body.assignedTo).toBe("Test Worker");

      const completed = await request(app)
        .post(`/api/putaway/tasks/${taskId}/complete`)
        .send({ actualBinId: fastBinId });
      expect(completed.status).toBe(200);
      expect(completed.body.status).toBe("COMPLETED");
      expect(completed.body.actualBinId).toBe(fastBinId);

      const bin = await request(app).get(`/api/bins/${fastBinId}`);
      expect(bin.body.currentUtilization).toBe(25);

      const invariant = await pool.query(
        `SELECT b.full_code, b.current_utilization, COALESCE(SUM(sp.quantity),0) AS placements_sum
         FROM bins b LEFT JOIN stock_placements sp ON sp.bin_id = b.id
         WHERE b.id = $1
         GROUP BY b.id, b.full_code, b.current_utilization`,
        [fastBinId],
      );
      expect(Number(invariant.rows[0].current_utilization)).toBe(
        Number(invariant.rows[0].placements_sum),
      );
    });

    it("rejects completing an already-completed task", async () => {
      const insert = await pool.query(
        `INSERT INTO putaway_tasks
         (grn_id, purchase_order_id, sku, quantity, suggested_bin_id, status, actual_bin_id, completed_at)
         VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $5, now())
         RETURNING id`,
        [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "HIGH-VELOCITY-SKU",
          25,
          fastBinId,
        ],
      );
      const taskId = insert.rows[0].id;

      const res = await request(app)
        .post(`/api/putaway/tasks/${taskId}/complete`)
        .send({ actualBinId: fastBinId });
      expect(res.status).toBe(409);
    });

    it("rejects completing into a bin without enough remaining capacity", async () => {
      const insert = await pool.query(
        `INSERT INTO putaway_tasks
         (grn_id, purchase_order_id, sku, quantity, suggested_bin_id, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING id`,
        [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "HIGH-VELOCITY-SKU",
          5000,
          fastBinId,
        ],
      );
      const taskId = insert.rows[0].id;

      const res = await request(app)
        .post(`/api/putaway/tasks/${taskId}/complete`)
        .send({ actualBinId: fastBinId });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/bins/utilization", () => {
    it("returns zeroed report for empty warehouse", async () => {
      const res = await request(app).get(
        "/api/bins/utilization?warehouseId=EMPTY_WAREHOUSE",
      );
      expect(res.status).toBe(200);
      expect(res.body.totalBins).toBe(0);
      expect(res.body.totalCapacity).toBe(0);
    });

    it("rolls up capacity and utilization by zone", async () => {
      const res = await request(app).get(
        `/api/bins/utilization?warehouseId=${WH}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.totalBins).toBe(3);
      expect(res.body.totalCapacity).toBe(1300);
      const zones = res.body.byZone.map((z: any) => z.zoneCode).sort();
      expect(zones).toEqual(["BULK", "FAST", "MID"]);
    });
  });

  describe("Transfers", () => {
    it("creates a transfer and one picking task per SKU", async () => {
      const res = await request(app)
        .post("/api/transfers")
        .send({
          fromWarehouseId: "MAIN_WAREHOUSE",
          toWarehouseId: "STORE_3_BACKROOM",
          items: [
            { sku: "SKU-A", quantity: 10 },
            { sku: "SKU-B", quantity: 5 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("PENDING");
      expect(res.body.items.length).toBe(2);

      const picking = await request(app).get(
        `/api/picking/tasks?status=PENDING`,
      );
      expect(picking.body.length).toBe(2);
      const skus = picking.body.map((t: any) => t.sku).sort();
      expect(skus).toEqual(["SKU-A", "SKU-B"]);
    });

    it("rejects transfer with same source and destination", async () => {
      const res = await request(app)
        .post("/api/transfers")
        .send({
          fromWarehouseId: "MAIN_WAREHOUSE",
          toWarehouseId: "MAIN_WAREHOUSE",
          items: [{ sku: "SKU-A", quantity: 10 }],
        });
      expect(res.status).toBe(400);
    });

    it("completes a transfer by calling Inventory", async () => {
      const create = await request(app)
        .post("/api/transfers")
        .send({
          fromWarehouseId: "MAIN_WAREHOUSE",
          toWarehouseId: "STORE_3_BACKROOM",
          items: [{ sku: "HIGH-VELOCITY-SKU", quantity: 15 }],
        });
      const transferId = create.body.id;

      const res = await request(app).post(
        `/api/transfers/${transferId}/complete`,
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("COMPLETED");
    });

    it("returns 404 for unknown transfer", async () => {
      const res = await request(app).get(
        "/api/transfers/00000000-0000-4000-8000-000000000000",
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Error cases", () => {
    it("returns 400 for invalid UUID param", async () => {
      const res = await request(app).get("/api/bins/not-a-uuid");
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing required fields on zone creation", async () => {
      const res = await request(app).post("/api/zones").send({});
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown zone", async () => {
      const res = await request(app).get(
        "/api/zones/00000000-0000-4000-8000-000000000000/aisles",
      );
      expect(res.status).toBe(404);
    });
  });
});
