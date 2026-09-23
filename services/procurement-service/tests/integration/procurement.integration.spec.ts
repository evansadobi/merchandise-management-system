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
process.env.FEATURE_PROCUREMENT = "true";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

vi.mock("../../src/clients/VendorServiceClient.js", () => {
  return {
    VendorServiceClient: vi.fn().mockImplementation(function (this: any) {
      this.getApprovedSuppliersForSku = vi.fn(async (sku: string) => {
        if (sku === "BOLT-STEEL-M8") {
          return [
            {
              vendorId: "4eb2b9f7-c20b-4238-a985-0d277130288b",
              vendorName: "Acme Supplies Ltd",
              paymentTerms: "Net 30",
              leadTimeDays: 5,
              unitCost: "12.50",
            },
          ];
        }
        return [];
      });
    }),
  };
});
vi.mock("../../src/events/eventPublisher.js", () => ({
  publishPurchaseOrderApproved: vi.fn().mockResolvedValue(undefined),
  stopEventPublisher: vi.fn().mockResolvedValue(undefined),
}));

const { createApp } = await import("../../src/app.js");
const { pool } = await import("../../src/db/db.js");

const APPROVED_VENDOR_ID = "4eb2b9f7-c20b-4238-a985-0d277130288b";

describe("Procurement API (integration)", () => {
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

  async function createDraftPo(quantity = 50) {
    const res = await request(app).post("/api/purchase-orders").send({
      vendorId: APPROVED_VENDOR_ID,
      sku: "BOLT-STEEL-M8",
      quantity,
    });
    return res.body;
  }

  describe("POST /api/purchase-orders", () => {
    it("creates a PO with cost/terms locked in from Vendor Service", async () => {
      const res = await request(app).post("/api/purchase-orders").send({
        vendorId: APPROVED_VENDOR_ID,
        sku: "BOLT-STEEL-M8",
        quantity: 50,
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("DRAFT");
      expect(res.body.unitCost).toBe("12.50");
      expect(res.body.paymentTerms).toBe("Net 30");
    });

    it("returns 400 when the vendor is not approved for the SKU", async () => {
      const res = await request(app).post("/api/purchase-orders").send({
        vendorId: "00000000-0000-0000-0000-000000000000",
        sku: "BOLT-STEEL-M8",
        quantity: 50,
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for an invalid vendorId format", async () => {
      const res = await request(app).post("/api/purchase-orders").send({
        vendorId: "not-a-uuid",
        sku: "BOLT-STEEL-M8",
        quantity: 50,
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for a non-positive quantity", async () => {
      const res = await request(app).post("/api/purchase-orders").send({
        vendorId: APPROVED_VENDOR_ID,
        sku: "BOLT-STEEL-M8",
        quantity: 0,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/purchase-orders/:id/approve", () => {
    it("approves a DRAFT PO", async () => {
      const po = await createDraftPo();

      const res = await request(app)
        .patch(`/api/purchase-orders/${po.id}/approve`)
        .send({ approvedBy: "Test User" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("APPROVED");
      expect(res.body.approvedBy).toBe("Test User");
    });

    it("returns 409 when approving an already-approved PO", async () => {
      const po = await createDraftPo();
      await request(app)
        .patch(`/api/purchase-orders/${po.id}/approve`)
        .send({ approvedBy: "Test User" });

      const res = await request(app)
        .patch(`/api/purchase-orders/${po.id}/approve`)
        .send({ approvedBy: "Someone Else" });

      expect(res.status).toBe(409);
    });

    it("returns 404 for a non-existent PO", async () => {
      const res = await request(app)
        .patch(
          "/api/purchase-orders/00000000-0000-0000-0000-000000000000/approve",
        )
        .send({ approvedBy: "Test User" });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/purchase-orders/:id/receive", () => {
    async function createApprovedPo(quantity = 50) {
      const po = await createDraftPo(quantity);
      const approveRes = await request(app)
        .patch(`/api/purchase-orders/${po.id}/approve`)
        .send({ approvedBy: "Test User" });
      return approveRes.body;
    }

    it("records a partial receipt and sets status to PARTIALLY_RECEIVED", async () => {
      const po = await createApprovedPo(50);

      const res = await request(app)
        .patch(`/api/purchase-orders/${po.id}/receive`)
        .send({ quantityReceived: 30 });

      expect(res.status).toBe(200);
      expect(res.body.quantityReceived).toBe(30);
      expect(res.body.status).toBe("PARTIALLY_RECEIVED");
    });

    it("sets status to RECEIVED once the full quantity is received", async () => {
      const po = await createApprovedPo(50);

      const res = await request(app)
        .patch(`/api/purchase-orders/${po.id}/receive`)
        .send({ quantityReceived: 50 });

      expect(res.status).toBe(200);
      expect(res.body.quantityReceived).toBe(50);
      expect(res.body.status).toBe("RECEIVED");
    });

    it("rejects receiving more than the remaining open quantity", async () => {
      const po = await createApprovedPo(50);
      await request(app)
        .patch(`/api/purchase-orders/${po.id}/receive`)
        .send({ quantityReceived: 30 });

      const res = await request(app)
        .patch(`/api/purchase-orders/${po.id}/receive`)
        .send({ quantityReceived: 30 }); // only 20 remaining

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/remaining open quantity/);
    });

    it("returns 409 when trying to receive against a DRAFT (unapproved) PO", async () => {
      const po = await createDraftPo();

      const res = await request(app)
        .patch(`/api/purchase-orders/${po.id}/receive`)
        .send({ quantityReceived: 10 });

      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/purchase-orders", () => {
    it("returns all purchase orders", async () => {
      await createDraftPo(10);
      await createDraftPo(20);

      const res = await request(app).get("/api/purchase-orders");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });
});
