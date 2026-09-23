import { describe, it, expect, vi, beforeEach } from "vitest";
import { InventoryService } from "../../src/services/InventoryService.js";
import { InventoryRepository } from "../../src/repositories/InventoryRepository.js";
import { NotFoundError, BadRequestError } from "../../src/types.js";

vi.mock("../../src/repositories/InventoryRepository.js");
vi.mock("../../src/events/eventPublisher.js", () => ({
  publishStockLow: vi.fn().mockResolvedValue(undefined),
}));

import { publishStockLow } from "../../src/events/eventPublisher.js";

describe("InventoryService", () => {
  let service: InventoryService;
  let mockRepo: {
    findAll: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findBySku: ReturnType<typeof vi.fn>;
    findBySkuAndLocation: ReturnType<typeof vi.fn>;
    findLowStock: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    adjustOnHand: ReturnType<typeof vi.fn>;
    allocate: ReturnType<typeof vi.fn>;
    releaseAllocation: ReturnType<typeof vi.fn>;
    commitSale: ReturnType<typeof vi.fn>;
    incrementOnOrder: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const sku = "BOLT-STEEL-M8";
  const location = "MAIN_WAREHOUSE";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findAll: vi.fn(),
      count: vi.fn(),
      findById: vi.fn(),
      findBySku: vi.fn(),
      findBySkuAndLocation: vi.fn(),
      findLowStock: vi.fn(),
      create: vi.fn(),
      adjustOnHand: vi.fn(),
      allocate: vi.fn(),
      releaseAllocation: vi.fn(),
      commitSale: vi.fn(),
      incrementOnOrder: vi.fn(),
      delete: vi.fn(),
    };

    service = new InventoryService(mockRepo as unknown as InventoryRepository);
  });

  describe("listItems", () => {
    it("returns paginated items", async () => {
      const items = [{ id: "1", sku }];
      mockRepo.findAll.mockResolvedValue(items);
      mockRepo.count.mockResolvedValue(1);

      const result = await service.listItems(1, 20);

      expect(result).toEqual({
        data: items,
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });
  });

  describe("getItemById", () => {
    it("throws NotFoundError when item does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getItemById("x")).rejects.toThrow(NotFoundError);
    });
  });

  describe("getItemsBySku", () => {
    it("throws NotFoundError when no rows exist for the SKU", async () => {
      mockRepo.findBySku.mockResolvedValue([]);
      await expect(service.getItemsBySku(sku)).rejects.toThrow(NotFoundError);
    });

    it("returns all location rows for the SKU", async () => {
      const rows = [
        { sku, locationId: "MAIN_WAREHOUSE" },
        { sku, locationId: "STORE_3" },
      ];
      mockRepo.findBySku.mockResolvedValue(rows);
      const result = await service.getItemsBySku(sku);
      expect(result).toEqual(rows);
    });
  });

  describe("getLowStockItems", () => {
    it("returns an empty array as a valid result, not an error", async () => {
      mockRepo.findLowStock.mockResolvedValue([]);
      const result = await service.getLowStockItems();
      expect(result).toEqual([]);
    });
  });

  describe("adjustStock", () => {
    it("adjusts stock successfully when the atomic write succeeds", async () => {
      const updated = {
        sku,
        locationId: location,
        quantityOnHand: 40,
        reorderLevel: 10,
      };
      mockRepo.adjustOnHand.mockResolvedValue(updated);

      const result = await service.adjustStock(sku, 10, location);

      expect(mockRepo.adjustOnHand).toHaveBeenCalledWith(sku, location, 10);
      expect(result).toEqual(updated);
      expect(publishStockLow).not.toHaveBeenCalled();
    });

    it("throws BadRequestError when the atomic write is blocked by the negative-guard (item exists)", async () => {
      mockRepo.adjustOnHand.mockResolvedValue(null);
      mockRepo.findBySkuAndLocation.mockResolvedValue({
        sku,
        locationId: location,
        quantityOnHand: 5,
      });

      await expect(service.adjustStock(sku, -10, location)).rejects.toThrow(
        BadRequestError,
      );
    });

    it("throws NotFoundError when the item doesn't exist at all", async () => {
      mockRepo.adjustOnHand.mockResolvedValue(null);
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      await expect(service.adjustStock(sku, -10, location)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("publishes StockLow when the resulting quantity is at or below reorderLevel", async () => {
      const updated = {
        sku,
        locationId: location,
        quantityOnHand: 5,
        reorderLevel: 10,
      };
      mockRepo.adjustOnHand.mockResolvedValue(updated);

      await service.adjustStock(sku, -5, location);

      expect(publishStockLow).toHaveBeenCalledWith({
        sku,
        locationId: location,
        quantityOnHand: 5,
        reorderLevel: 10,
      });
    });

    it("defaults to MAIN_WAREHOUSE when no locationId is given", async () => {
      mockRepo.adjustOnHand.mockResolvedValue({
        sku,
        locationId: "MAIN_WAREHOUSE",
        quantityOnHand: 10,
        reorderLevel: 5,
      });

      await service.adjustStock(sku, 5);

      expect(mockRepo.adjustOnHand).toHaveBeenCalledWith(
        sku,
        "MAIN_WAREHOUSE",
        5,
      );
    });
  });

  describe("reserveStock", () => {
    it("reserves stock successfully when within available quantity", async () => {
      const updated = { sku, locationId: location, quantityAllocated: 10 };
      mockRepo.allocate.mockResolvedValue(updated);

      const result = await service.reserveStock(sku, 10, location);

      expect(mockRepo.allocate).toHaveBeenCalledWith(sku, location, 10);
      expect(result).toEqual(updated);
    });

    it("throws BadRequestError with the available quantity when over-reserving", async () => {
      mockRepo.allocate.mockResolvedValue(null);
      mockRepo.findBySkuAndLocation.mockResolvedValue({
        sku,
        locationId: location,
        quantityOnHand: 45,
        quantityAllocated: 10,
      });

      await expect(service.reserveStock(sku, 40, location)).rejects.toThrow(
        "Insufficient available stock for SKU BOLT-STEEL-M8 (available: 35)",
      );
    });

    it("throws NotFoundError when the item doesn't exist", async () => {
      mockRepo.allocate.mockResolvedValue(null);
      mockRepo.findBySkuAndLocation.mockResolvedValue(null);

      await expect(service.reserveStock(sku, 10, location)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("releaseReservation", () => {
    it("releases a reservation successfully", async () => {
      const updated = { sku, locationId: location, quantityAllocated: 0 };
      mockRepo.releaseAllocation.mockResolvedValue(updated);

      const result = await service.releaseReservation(sku, 10, location);

      expect(result).toEqual(updated);
    });

    it("throws NotFoundError when the item doesn't exist", async () => {
      mockRepo.releaseAllocation.mockResolvedValue(null);
      await expect(
        service.releaseReservation(sku, 10, location),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("commitSale", () => {
    it("commits a sale successfully, deducting on-hand and releasing allocation atomically", async () => {
      const updated = {
        sku,
        locationId: location,
        quantityOnHand: 35,
        quantityAllocated: 0,
        reorderLevel: 10,
      };
      mockRepo.commitSale.mockResolvedValue(updated);

      const result = await service.commitSale(sku, 10, location);

      expect(mockRepo.commitSale).toHaveBeenCalledWith(sku, location, 10);
      expect(result).toEqual(updated);
      expect(publishStockLow).not.toHaveBeenCalled();
    });

    it("throws BadRequestError when there's insufficient on-hand quantity", async () => {
      mockRepo.commitSale.mockResolvedValue(null);

      await expect(service.commitSale(sku, 100, location)).rejects.toThrow(
        BadRequestError,
      );
    });

    it("publishes StockLow when the sale brings quantity at or below reorderLevel", async () => {
      const updated = {
        sku,
        locationId: location,
        quantityOnHand: 8,
        quantityAllocated: 0,
        reorderLevel: 10,
      };
      mockRepo.commitSale.mockResolvedValue(updated);

      await service.commitSale(sku, 10, location);

      expect(publishStockLow).toHaveBeenCalledWith({
        sku,
        locationId: location,
        quantityOnHand: 8,
        reorderLevel: 10,
      });
    });
  });

  describe("deleteItem", () => {
    it("throws NotFoundError when the item doesn't exist", async () => {
      mockRepo.delete.mockResolvedValue(null);
      await expect(service.deleteItem("x")).rejects.toThrow(NotFoundError);
    });

    it("deletes successfully", async () => {
      const deleted = { id: "1", sku };
      mockRepo.delete.mockResolvedValue(deleted);
      const result = await service.deleteItem("1");
      expect(result).toEqual(deleted);
    });
  });
});
