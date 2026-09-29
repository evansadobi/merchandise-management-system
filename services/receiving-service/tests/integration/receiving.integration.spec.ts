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
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const APPROVED_PO_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_PO_ID = "22222222-2222-4222-8222-222222222222";
const SUPPLIER_ID = "4eb2b9f7-c20b-4238-a985-0d277130288b";

vi.mock("../../src/clients/ProcurementServiceClient.js", () => {
  return {
    ProcurementServiceClient: vi.fn().mockImplementation(function (this: any) {
      this.getPurchaseOrder = vi.fn(async (poId: string) => {
        if (poId === APPROVED_PO_ID) {
          return {
            id: APPROVED_PO_ID,
            sku: "BOLT-STEEL-M8",
            quantityOrdered: 50,
            quantityReceived: 0,
            status: "APPROVED",
          };
        }
        if (poId === DRAFT_PO_ID) {
          return {
            id: DRAFT_PO_ID,
            sku: "BOLT-STEEL-M8",
            quantityOrdered: 50,
            quantityReceived: 0,
            status: "DRAFT",
          };
        }
        return null;
      });
      this.recordReceipt = vi.fn().mockResolvedValue(true);
    }),
  };
});

vi.mock("../../src/events/eventPublisher.js", () => ({
  publishGoodsReceived: vi.fn().mockResolvedValue(undefined),
  stopEventPublisher: vi.fn().mockResolvedValue(undefined),
}));

const { createApp } = await import("../../src/app.js");
const { pool } = await import("../../src/db/db.js");

describe("Receiving API (integration)", () => {
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

  describe("POST /api/grn", () => {
    it("successfully records GRN with live calculation, null expectedDeliveryId, and damage quarantine", async () => {
      const res = await request(app)
        .post("/api/grn")
        .send({
          purchaseOrderId: APPROVED_PO_ID,
          supplierId: SUPPLIER_ID,
          receivedBy: "Dock Clerk Test",
          items: [
            {
              sku: "BOLT-STEEL-M8",
              receivedQuantity: 20,
              damagedQuantity: 2,
              conditionNotes: "2 crushed units quarantined",
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("DISCREPANCY");

      const item = res.body.items[0];
      expect(item.expectedDeliveryId).toBeNull();
      expect(item.orderedQuantity).toBe(50);
      expect(item.receivedQuantity).toBe(20);
      expect(item.damagedQuantity).toBe(2);
      expect(item.sellableQuantity).toBe(18); // 20 - 2
      expect(item.discrepancyType).toBe("SHORTAGE");
    });

    it("returns 409 Conflict when attempting to receive against a DRAFT PO", async () => {
      const res = await request(app)
        .post("/api/grn")
        .send({
          purchaseOrderId: DRAFT_PO_ID,
          supplierId: SUPPLIER_ID,
          receivedBy: "Dock Clerk Test",
          items: [
            {
              sku: "BOLT-STEEL-M8",
              receivedQuantity: 20,
            },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/not been approved yet/);
    });

    it("returns 400 Validation error if damagedQuantity exceeds receivedQuantity", async () => {
      const res = await request(app)
        .post("/api/grn")
        .send({
          purchaseOrderId: APPROVED_PO_ID,
          supplierId: SUPPLIER_ID,
          receivedBy: "Dock Clerk Test",
          items: [
            {
              sku: "BOLT-STEEL-M8",
              receivedQuantity: 10,
              damagedQuantity: 12,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Damaged quantity.*cannot exceed/);
    });
  });
});
