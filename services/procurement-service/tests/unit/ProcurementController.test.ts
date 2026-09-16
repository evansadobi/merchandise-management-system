import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { ProcurementController } from "../../src/controllers/ProcurementController.js";

// Mock the repository to isolate the controller from database calls
vi.mock("../../src/repositories/ProcurementRepository.js", () => {
  return {
    ProcurementRepository: vi.fn().mockImplementation(function () {
      return {
        findAll: vi.fn(),
        findById: vi.fn(),
        create: vi.fn(),
        approve: vi.fn(),
        recordReceipt: vi.fn(),
      };
    }),
  };
});

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("ProcurementController", () => {
  let controller: ProcurementController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new ProcurementController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("getPurchaseOrders", () => {
    it("returns 200 with all purchase orders", async () => {
      const req = {} as Request;
      const res = mockRes();
      const mockPOs = [{ id: "po-1", sku: "SKU-WIDGET-001" }] as any;

      vi.mocked(controller["procurementRepo"].findAll).mockResolvedValue(
        mockPOs,
      );

      await controller.getPurchaseOrders(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockPOs);
    });
  });

  describe("createPurchaseOrder", () => {
    const validBody = {
      vendorId: "4eb2b9f7-c20b-4238-a985-0d277130288b",
      sku: "SKU-WIDGET-001",
      quantity: 50,
    };

    it("returns 400 when required fields are missing", async () => {
      const req = { body: { sku: "SKU-WIDGET-001" } } as Request;
      const res = mockRes();

      await controller.createPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Missing required fields: vendorId, sku, quantity",
      });
    });

    it("returns 400 when quantity is invalid", async () => {
      const req = { body: { ...validBody, quantity: 0 } } as Request;
      const res = mockRes();

      await controller.createPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Quantity must be a positive integer",
      });
    });

    it("locks in unitCost and paymentTerms from Vendor Service, ignoring any client-supplied cost", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();

      // Mock the global fetch call to Vendor Service's supplier lookup.
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            vendorId: "4eb2b9f7-c20b-4238-a985-0d277130288b",
            vendorName: "Acme Supplies Ltd",
            paymentTerms: "Net 30",
            leadTimeDays: 5,
            unitCost: "250.00",
          },
        ],
      }) as unknown as typeof fetch;

      const created = {
        id: "po-1",
        vendorId: validBody.vendorId,
        sku: validBody.sku,
        quantityOrdered: validBody.quantity,
        quantityReceived: 0,
        unitCost: "250.00",
        paymentTerms: "Net 30",
        status: "DRAFT",
        approvedBy: null,
        approvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(controller["procurementRepo"].create).mockResolvedValue(
        created as any,
      );

      await controller.createPurchaseOrder(req, res);

      // The critical assertion: the repository must be called with the
      // PRICE FROM VENDOR SERVICE, never anything the client could have
      // sent. This is the regression test for the original bug where
      // unitCost was trusted directly from req.body.
      expect(controller["procurementRepo"].create).toHaveBeenCalledWith({
        vendorId: validBody.vendorId,
        sku: validBody.sku,
        quantityOrdered: validBody.quantity,
        unitCost: "250.00",
        paymentTerms: "Net 30",
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(created);
    });

    it("returns 400 when the vendor is not an approved supplier for the SKU", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,

        json: async () => [
          {
            vendorId: "some-other-vendor-id",
            vendorName: "A Different Vendor",
            paymentTerms: "Net 15",
            leadTimeDays: 3,
            unitCost: "10.00",
          },
        ],
      }) as unknown as typeof fetch;

      await controller.createPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error:
          "Validation failed: this vendor is not an approved supplier for this SKU",
      });
      expect(controller["procurementRepo"].create).not.toHaveBeenCalled();
    });

    it("returns 502 when Vendor Service is unreachable", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();

      global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

      await controller.createPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        error: "Vendor Service is unavailable",
      });
    });

    it("returns 502 when Vendor Service responds with a non-OK status", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      }) as unknown as typeof fetch;

      await controller.createPurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to verify vendor product catalog",
      });
    });
  });

  describe("approvePurchaseOrder", () => {
    it("returns 400 when approvedBy is missing", async () => {
      const req = {
        params: { id: "347b3264-ec1c-4000-b67e-9e58cfd66518" },
        body: { approvedBy: "" },
      } as unknown as Request;
      const res = mockRes();

      await controller.approvePurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "approvedBy is required",
      });
    });

    it("returns 404 when purchase order does not exist", async () => {
      const req = {
        params: { id: "347b3264-ec1c-4000-b67e-9e58cfd66518" },
        body: { approvedBy: "Evans" },
      } as unknown as Request;
      const res = mockRes();

      vi.mocked(controller["procurementRepo"].findById).mockResolvedValue(null);

      await controller.approvePurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Purchase order not found",
      });
    });

    it("returns 409 when trying to approve a PO not in DRAFT status", async () => {
      const validUuid = "347b3264-ec1c-4000-b67e-9e58cfd66518";
      const req = {
        params: { id: validUuid },
        body: { approvedBy: "Evans" },
      } as unknown as Request;
      const res = mockRes();

      vi.mocked(controller["procurementRepo"].findById).mockResolvedValue({
        id: validUuid,
        status: "APPROVED",
      } as any);

      await controller.approvePurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "Cannot approve a purchase order in status APPROVED",
      });
    });
  });

  describe("receivePurchaseOrder", () => {
    it("returns 400 when quantityReceived is invalid", async () => {
      const req = {
        params: { id: "347b3264-ec1c-4000-b67e-9e58cfd66518" },
        body: { quantityReceived: -5 },
      } as unknown as Request;
      const res = mockRes();

      await controller.receivePurchaseOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "quantityReceived must be a positive integer",
      });
    });
  });
});
