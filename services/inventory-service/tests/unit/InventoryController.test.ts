import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { InventoryController } from "../../src/controllers/InventoryController.js";

vi.mock("../../src/repositories/InventoryRepository.js", () => {
  return {
    InventoryRepository: vi.fn().mockImplementation(function () {
      return {
        findAll: vi.fn(),
        findById: vi.fn(),
        findBySku: vi.fn(),
        findBySkuAndLocation: vi.fn(),
        findLowStock: vi.fn(),
        create: vi.fn(),
        adjustOnHand: vi.fn(),
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

describe("InventoryController", () => {
  let controller: InventoryController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new InventoryController();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getItems", () => {
    it("returns 200 with all inventory items", async () => {
      const req = {} as Request;
      const res = mockRes();
      const mockItems = [{ id: "inv-1", sku: "SKU-WIDGET-001" }] as any;

      vi.mocked(controller["inventoryRepo"].findAll).mockResolvedValue(
        mockItems,
      );

      await controller.getItems(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockItems);
    });
  });

  describe("createItem", () => {
    const validBody = {
      productName: "Widget",
      sku: "SKU-WIDGET-001",
      quantityOnHand: 100,
      unitValue: "25.00",
      reorderLevel: 10,
    };

    it("returns 400 when productName is missing", async () => {
      const req = { body: { ...validBody, productName: "" } } as Request;
      const res = mockRes();

      await controller.createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "productName is required",
      });
    });

    it("returns 409 when a unique constraint violation occurs on SKU and location", async () => {
      const req = { body: validBody } as Request;
      const res = mockRes();

      const dbError: any = new Error("Unique violation");
      dbError.cause = { code: "23505" };

      vi.mocked(controller["inventoryRepo"].create).mockRejectedValue(dbError);

      await controller.createItem(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error:
          "An inventory item with this SKU already exists at this location",
      });
    });
  });

  describe("adjustStock", () => {
    it("returns 400 when delta is zero or invalid", async () => {
      const req = {
        params: { sku: "SKU-WIDGET-001" },
        body: { delta: 0 },
      } as unknown as Request;
      const res = mockRes();

      await controller.adjustStock(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "delta must be a non-zero integer",
      });
    });

    it("returns 404 when item does not exist at location", async () => {
      const req = {
        params: { sku: "SKU-WIDGET-001" },
        body: { delta: 5, locationId: "MAIN_WAREHOUSE" },
      } as unknown as Request;
      const res = mockRes();

      vi.mocked(
        controller["inventoryRepo"].findBySkuAndLocation,
      ).mockResolvedValue(null);

      await controller.adjustStock(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Inventory item not found at this location",
      });
    });

    it("returns 400 when the delta would reduce On Hand below zero", async () => {
      const req = {
        params: { sku: "SKU-WIDGET-001" },
        body: { delta: -1000, locationId: "MAIN_WAREHOUSE" },
      } as unknown as Request;
      const res = mockRes();

      vi.mocked(
        controller["inventoryRepo"].findBySkuAndLocation,
      ).mockResolvedValue({ quantityOnHand: 45 } as any);

      await controller.adjustStock(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Cannot reduce On Hand below zero (current: 45)",
      });
      expect(controller["inventoryRepo"].adjustOnHand).not.toHaveBeenCalled();
    });

    it("successfully adjusts stock and returns 200 with the updated item", async () => {
      const req = {
        params: { sku: "SKU-WIDGET-001" },
        body: { delta: -30, locationId: "MAIN_WAREHOUSE" },
      } as unknown as Request;
      const res = mockRes();

      vi.mocked(
        controller["inventoryRepo"].findBySkuAndLocation,
      ).mockResolvedValue({ quantityOnHand: 470 } as any);

      const updated = {
        id: "inv-1",
        sku: "SKU-WIDGET-001",
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 440,
        quantityAllocated: 0,
        quantityOnOrder: 0,
        unitValue: "1.25",
        reorderLevel: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(controller["inventoryRepo"].adjustOnHand).mockResolvedValue(
        updated as any,
      );

      await controller.adjustStock(req, res);

      expect(controller["inventoryRepo"].adjustOnHand).toHaveBeenCalledWith(
        "SKU-WIDGET-001",
        "MAIN_WAREHOUSE",
        -30,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it("defaults to MAIN_WAREHOUSE when locationId is not provided", async () => {
      const req = {
        params: { sku: "SKU-WIDGET-001" },
        body: { delta: 10 }, // no locationId
      } as unknown as Request;
      const res = mockRes();

      vi.mocked(
        controller["inventoryRepo"].findBySkuAndLocation,
      ).mockResolvedValue({ quantityOnHand: 100 } as any);
      vi.mocked(controller["inventoryRepo"].adjustOnHand).mockResolvedValue({
        quantityOnHand: 110,
      } as any);

      await controller.adjustStock(req, res);

      expect(
        controller["inventoryRepo"].findBySkuAndLocation,
      ).toHaveBeenCalledWith("SKU-WIDGET-001", "MAIN_WAREHOUSE");
    });
  });
});
